-- Six Nations Guesser: sign-in only for pre-registered emails.
--
-- Run once in the Supabase SQL editor, AFTER auth_migration.sql, years_migration.sql and
-- preregistered_emails_migration.sql. Idempotent.
--
-- What it does:
--   * check_login_email(email)   callable by anyone: is this email registered for the game? The login screen
--                                asks this BEFORE sending a code, and shows an "ask an admin" pop-up if not.
--                                An email counts as registered when it is on a competitor (competitor_emails) or
--                                belongs to an account already linked to a competitor
--   * login_admin_names()        callable by anyone: the display names of the admins, for that pop-up
--   * backfill                   accounts already linked to a competitor get their email registered, so the
--                                Competitors screen shows it and it keeps working
--   * self-signup removed        create_my_profile is dropped and the allow_self_signup setting deleted: the only
--                                way in is an email an admin has registered
--   * admin_set_competitor_email changing or clearing the email of a competitor who has already signed up moves
--                                the login: the old account is unlinked (the new email links on its first sign-in).
--                                An admin cannot change their OWN email, so they cannot lock themselves out
--   * hook_before_user_created   OPTIONAL hard stop: if you enable it (Authentication > Hooks > Before User
--                                Created > Postgres function > public.hook_before_user_created) Supabase refuses to
--                                create an account for an unregistered email at all. Without it an unregistered
--                                person cannot get a code through the app, but someone calling the API directly
--                                could still create a bare account (which can do nothing).

-- ---------------------------------------------------------------------------
-- Register the emails of accounts that are already linked
-- ---------------------------------------------------------------------------

insert into public.competitor_emails (user_id, email)
select u.id, lower(au.email)
  from public.users u
  join auth.users au on au.id = u.auth_user_id
 where au.email is not null
   and not exists (select 1 from public.competitor_emails ce where ce.user_id = u.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Public checks used by the login screen
-- ---------------------------------------------------------------------------

create or replace function public.check_login_email(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
               select 1 from public.competitor_emails ce
                where lower(ce.email) = lower(trim(coalesce(p_email, '')))
           )
        or exists (
               select 1
                 from public.users u
                 join auth.users au on au.id = u.auth_user_id
                where lower(au.email) = lower(trim(coalesce(p_email, '')))
           )
$$;

create or replace function public.login_admin_names()
returns text[]
language sql stable security definer set search_path = public as $$
    select coalesce(
        array_agg(coalesce(nullif(u.nickname, ''), u.username) order by lower(coalesce(nullif(u.nickname, ''), u.username))),
        '{}'::text[]
    )
      from public.admin_usernames a
      join public.users u on u.username = a.username
$$;

revoke execute on function public.check_login_email(text) from public;
revoke execute on function public.login_admin_names() from public;
grant execute on function public.check_login_email(text) to anon, authenticated;
grant execute on function public.login_admin_names() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- No self-signup
-- ---------------------------------------------------------------------------

drop function if exists public.create_my_profile(text, text, text);
delete from public.settings where key = 'allow_self_signup';

-- ---------------------------------------------------------------------------
-- Editing a competitor's sign-in email moves their login
-- ---------------------------------------------------------------------------

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

    -- An admin must not cut off their own access (a typo would lock them out for good)
    if v_user.auth_user_id is not null and v_user.auth_user_id = auth.uid()
       and not exists (select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = v_email) then
        raise exception 'Ask another admin to change your own sign-in email, so you cannot lock yourself out.';
    end if;

    if v_email = '' then
        -- Removing the email removes their access
        delete from public.competitor_emails where user_id = v_user.id;
        update public.users set auth_user_id = null where id = v_user.id;
        return;
    end if;

    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;

    if exists (select 1 from public.competitor_emails where lower(email) = v_email and user_id <> v_user.id)
       or exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id
                   where lower(au.email) = v_email and u.id <> v_user.id) then
        raise exception '% is already registered to another competitor.', v_email;
    end if;

    insert into public.competitor_emails (user_id, email) values (v_user.id, v_email)
    on conflict (user_id) do update set email = excluded.email;

    -- If they are signed up under a different email, release that account: signing in with the new
    -- email links to this competitor automatically (my_competitor)
    update public.users u
       set auth_user_id = null
     where u.id = v_user.id
       and u.auth_user_id is not null
       and not exists (select 1 from auth.users au where au.id = u.auth_user_id and lower(au.email) = v_email);
end;
$$;

revoke execute on function public.admin_set_competitor_email(text, text) from public, anon;
grant execute on function public.admin_set_competitor_email(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Optional: refuse to create accounts for unregistered emails
-- ---------------------------------------------------------------------------

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    if public.check_login_email(event -> 'user' ->> 'email') then
        return '{}'::jsonb;
    end if;
    return jsonb_build_object('error', jsonb_build_object(
        'message', 'This email is not registered for the game. Ask an admin to add it.',
        'http_code', 403
    ));
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
        grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
    end if;
end
$$;
