-- Six Nations Guesser: pre-registered competitor emails, auto-link on first sign-in,
-- closed self-signup, and input hardening.
--
-- Run once in the Supabase SQL editor, AFTER auth_migration.sql and years_migration.sql. Idempotent.
--
-- What it does:
--   * competitor_emails        admin-only table: the email each competitor is expected to sign in with
--   * my_competitor()          when a signed-in account has no competitor yet, links it automatically to the
--                              unlinked competitor whose pre-registered email matches the account's
--                              confirmed email
--   * allow_self_signup        settings flag (default off). When off, create_my_profile refuses, so only
--                              pre-registered (or admin-linked) people can play
--   * admin RPCs              admin_set_competitor_email, admin_import_competitor_emails,
--                              admin_list_competitor_emails
--   * guests are read-only     anonymous visitors can read (the leaderboard) but write nothing, anywhere.
--                              usage_events used to accept inserts from anyone, so the log could be spammed or
--                              forged; now only signed-in people can add events, under their own name
--                              (admins may log on behalf of a competitor, e.g. when editing their predictions)
--   * hardening               create_my_profile no longer accepts a username that is on the admin list
--                              (a stale admin row could otherwise hand admin rights to a new sign-up) and
--                              rejects display names containing < > "; the same rules are added as
--                              constraints on users (not enforced on existing rows until they change)

-- ---------------------------------------------------------------------------
-- Pre-registered emails (private to admins)
-- ---------------------------------------------------------------------------

create table if not exists public.competitor_emails (
    user_id integer primary key references public.users(id) on delete cascade,
    email text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists competitor_emails_email_key on public.competitor_emails (lower(email));

alter table public.competitor_emails enable row level security;
revoke all on public.competitor_emails from anon;

drop policy if exists competitor_emails_admin on public.competitor_emails;
create policy competitor_emails_admin on public.competitor_emails for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- Set (or, with an empty email, clear) the email a competitor will sign in with.
create or replace function public.admin_set_competitor_email(p_username text, p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_user public.users%rowtype;
    v_email text := lower(trim(coalesce(p_email, '')));
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;

    select * into v_user from public.users where username = lower(trim(coalesce(p_username, '')));
    if not found then
        raise exception 'Competitor "%" not found.', p_username;
    end if;

    if v_email = '' then
        delete from public.competitor_emails where user_id = v_user.id;
        return;
    end if;

    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;

    if exists (select 1 from public.competitor_emails where lower(email) = v_email and user_id <> v_user.id) then
        raise exception '% is already registered to another competitor.', v_email;
    end if;

    insert into public.competitor_emails (user_id, email) values (v_user.id, v_email)
    on conflict (user_id) do update set email = excluded.email;
end;
$$;

-- Bulk version: p_rows is a JSON array of {"username": "...", "email": "..."}.
-- Returns {"applied": n, "skipped": [{"row": i, "username": "...", "reason": "..."}]}.
create or replace function public.admin_import_competitor_emails(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_item jsonb;
    v_index integer := 0;
    v_applied integer := 0;
    v_skipped jsonb := '[]'::jsonb;
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    if jsonb_typeof(p_rows) is distinct from 'array' then
        raise exception 'Expected a list of rows.';
    end if;

    for v_item in select * from jsonb_array_elements(p_rows) loop
        v_index := v_index + 1;
        begin
            perform public.admin_set_competitor_email(v_item ->> 'username', v_item ->> 'email');
            v_applied := v_applied + 1;
        exception when others then
            v_skipped := v_skipped || jsonb_build_object(
                'row', v_index,
                'username', v_item ->> 'username',
                'reason', sqlerrm
            );
        end;
    end loop;

    return jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
end;
$$;

create or replace function public.admin_list_competitor_emails()
returns table (username text, email text, linked boolean)
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    return query
        select u.username::text, ce.email, (u.auth_user_id is not null)
          from public.competitor_emails ce
          join public.users u on u.id = ce.user_id
         order by u.username;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-link on first sign-in
-- ---------------------------------------------------------------------------

-- The competitor for the signed-in account. If there is none yet, link the unlinked competitor whose
-- pre-registered email equals this account's CONFIRMED email (magic links and codes confirm it).
create or replace function public.my_competitor()
returns table (username text, nickname text)
language plpgsql security definer set search_path = public as $$
declare
    v_linked_id integer;
    v_email text;
begin
    if auth.uid() is null then
        return;
    end if;

    select id into v_linked_id from public.users where auth_user_id = auth.uid();

    if v_linked_id is null then
        select lower(au.email) into v_email
          from auth.users au
         where au.id = auth.uid() and au.email_confirmed_at is not null;

        if v_email is not null then
            update public.users u
               set auth_user_id = auth.uid()
              from public.competitor_emails ce
             where ce.user_id = u.id
               and lower(ce.email) = v_email
               and u.auth_user_id is null;
        end if;
    end if;

    return query
        select u.username::text, u.nickname::text
          from public.users u
         where u.auth_user_id = auth.uid();
end;
$$;

grant execute on function public.my_competitor() to authenticated;
revoke execute on function public.admin_set_competitor_email(text, text) from public, anon;
revoke execute on function public.admin_import_competitor_emails(jsonb) from public, anon;
revoke execute on function public.admin_list_competitor_emails() from public, anon;
grant execute on function public.admin_set_competitor_email(text, text) to authenticated;
grant execute on function public.admin_import_competitor_emails(jsonb) to authenticated;
grant execute on function public.admin_list_competitor_emails() to authenticated;

-- ---------------------------------------------------------------------------
-- Self-signup: closed unless an admin opens it; safer usernames and display names
-- ---------------------------------------------------------------------------

create or replace function public.create_my_profile(
    p_username text,
    p_nickname text,
    p_supported_teams text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_username text := lower(trim(coalesce(p_username, '')));
    v_nickname text := trim(coalesce(p_nickname, ''));
begin
    if auth.uid() is null then
        raise exception 'Please sign in first.';
    end if;
    if coalesce((select value from public.settings where key = 'allow_self_signup'), 'false') <> 'true' then
        raise exception 'New sign-ups are closed. Ask an admin to add your email.';
    end if;
    if exists (select 1 from public.users where auth_user_id = auth.uid()) then
        raise exception 'Your account already has a competitor profile.';
    end if;
    if v_username !~ '^[a-z0-9]+$' or length(v_username) > 30 then
        raise exception 'Username can only contain letters and numbers (max 30).';
    end if;
    if v_username = 'guest' or exists (select 1 from public.admin_usernames where username = v_username) then
        raise exception 'That username is reserved.';
    end if;
    if v_nickname = '' or length(v_nickname) > 60 then
        raise exception 'Display name is required (max 60 characters).';
    end if;
    if v_nickname ~ '[<>"]' then
        raise exception 'Display name cannot contain < > or " characters.';
    end if;
    if exists (select 1 from public.users where username = v_username) then
        raise exception 'This username is already taken. If this is you from a previous year, ask an admin to link your account.';
    end if;
    if exists (select 1 from public.users where lower(nickname) = lower(v_nickname)) then
        raise exception 'This display name is already taken.';
    end if;

    insert into public.users (username, nickname, supported_teams, auth_user_id)
    values (v_username, v_nickname, nullif(trim(coalesce(p_supported_teams, '')), ''), auth.uid());
end;
$$;

revoke execute on function public.create_my_profile(text, text, text) from public, anon;
grant execute on function public.create_my_profile(text, text, text) to authenticated;

-- Same rules as table constraints. NOT VALID: existing rows are not checked until they are next changed.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'users_nickname_safe') then
        alter table public.users
            add constraint users_nickname_safe check (nickname is null or nickname !~ '[<>"]') not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'users_username_safe') then
        alter table public.users
            add constraint users_username_safe check (username ~ '^[a-z0-9]+$') not valid;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Guests are read-only
-- ---------------------------------------------------------------------------

-- Anonymous visitors only ever need to read. Row level security already blocks their writes everywhere
-- except usage_events; remove the write privileges as a second layer.
revoke insert, update, delete, truncate on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

drop policy if exists usage_events_insert on public.usage_events;
create policy usage_events_insert on public.usage_events for insert to authenticated
    with check (
        public.is_admin()
        or actor = (select u.username from public.users u where u.id = public.current_competitor_id())
    );
