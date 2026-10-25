-- Six Nations Guesser: Supabase Auth (magic link) migration.
--
-- Run once in the Supabase SQL editor. It is idempotent, so re-running is safe.
--
-- What it does:
--   * links competitors (public.users) to Supabase Auth accounts via auth_user_id
--   * removes the legacy password_hash column
--   * replaces the "allow all" RLS policies with real ones:
--       - everyone (including guests) can read leaderboard data
--       - signed-in competitors can only change their own profile / predictions / jokers
--       - admins (users listed in admin_usernames and linked to an account) can change everything
--   * adds RPCs used by the app: my_competitor, create_my_profile,
--     admin_list_accounts, admin_link_competitor
--
-- Before running, in Supabase dashboard:
--   Authentication > Providers > Email: enable "Email" (password sign-in can be off;
--     magic links work with the provider enabled).
--   Authentication > URL Configuration: set Site URL to where the app is hosted and add
--     it (plus any local dev URL) to Redirect URLs.
--
-- After running, bootstrap your first admin (admin_usernames rows from before the migration
-- are kept, so if your old admin competitor still exists you only need to link it):
--   1. Open the app, enter your email, click the magic link.
--   2a. If your old competitor row still exists, link it in the SQL editor:
--         update public.users
--            set auth_user_id = (select id from auth.users where email = 'you@example.com')
--          where username = 'yourusername';
--   2b. Otherwise create your profile in the app, then make yourself admin:
--         insert into public.admin_usernames (username) values ('yourusername')
--         on conflict (username) do nothing;
--   From then on admins can link the other competitors from the Competitors tab.

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

alter table public.users
    add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.users drop column if exists password_hash;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can use them without
-- needing direct access to users.auth_user_id)
-- ---------------------------------------------------------------------------

create or replace function public.current_competitor_id()
returns integer
language sql stable security definer set search_path = public as $$
    select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1
          from public.users u
          join public.admin_usernames a on a.username = u.username
         where u.auth_user_id = auth.uid()
    )
$$;

-- The competitor linked to the signed-in account (no row = profile not set up / not linked yet).
create or replace function public.my_competitor()
returns table (username text, nickname text)
language sql stable security definer set search_path = public as $$
    select u.username::text, u.nickname::text
      from public.users u
     where u.auth_user_id = auth.uid()
$$;

-- Self-service profile creation for a signed-in account with no competitor yet.
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
    if exists (select 1 from public.users where auth_user_id = auth.uid()) then
        raise exception 'Your account already has a competitor profile.';
    end if;
    if v_username !~ '^[a-z0-9]+$' or length(v_username) > 30 then
        raise exception 'Username can only contain letters and numbers (max 30).';
    end if;
    if v_username = 'guest' then
        raise exception 'That username is reserved.';
    end if;
    if v_nickname = '' or length(v_nickname) > 60 then
        raise exception 'Display name is required (max 60 characters).';
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

-- Admin: list every auth account and which competitor (if any) it is linked to.
create or replace function public.admin_list_accounts()
returns table (
    auth_user_id uuid,
    email text,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    linked_username text
)
language plpgsql security definer set search_path = public, auth as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    return query
        select au.id, au.email::text, au.created_at, au.last_sign_in_at, u.username::text
          from auth.users au
          left join public.users u on u.auth_user_id = au.id
         order by au.created_at desc;
end;
$$;

-- Admin: link a competitor to an account (or unlink with p_auth_user_id = null).
-- If the account already owns a brand-new, empty competitor (no predictions or jokers),
-- that empty row is removed so the account can take over the existing competitor.
create or replace function public.admin_link_competitor(p_username text, p_auth_user_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
    v_username text := lower(trim(coalesce(p_username, '')));
    v_target public.users%rowtype;
    v_other public.users%rowtype;
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;

    select * into v_target from public.users where username = v_username;
    if not found then
        raise exception 'Competitor % not found.', v_username;
    end if;

    if p_auth_user_id is null then
        update public.users set auth_user_id = null where id = v_target.id;
        return;
    end if;

    if not exists (select 1 from auth.users where id = p_auth_user_id) then
        raise exception 'Account not found.';
    end if;

    select * into v_other from public.users where auth_user_id = p_auth_user_id and id <> v_target.id;
    if found then
        if exists (select 1 from public.predictions where user_id = v_other.id)
           or exists (select 1 from public.user_joker_selections where user_id = v_other.id)
           or v_other.total_tries is not null then
            raise exception 'This account already owns competitor "%". Unlink it first.', v_other.username;
        end if;
        delete from public.admin_usernames where username = v_other.username;
        delete from public.users where id = v_other.id;
    end if;

    update public.users set auth_user_id = p_auth_user_id where id = v_target.id;
end;
$$;

revoke execute on function public.admin_list_accounts() from public, anon;
revoke execute on function public.admin_link_competitor(text, uuid) from public, anon;
revoke execute on function public.create_my_profile(text, text, text) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_link_competitor(text, uuid) to authenticated;
grant execute on function public.create_my_profile(text, text, text) to authenticated;
grant execute on function public.my_competitor() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_competitor_id() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers on users
-- ---------------------------------------------------------------------------

-- Only admins may change identity columns through the API.
create or replace function public.users_guard_identity()
returns trigger
language plpgsql as $$
begin
    if current_user in ('anon', 'authenticated') and not public.is_admin() then
        if new.id is distinct from old.id
           or new.username is distinct from old.username
           or new.auth_user_id is distinct from old.auth_user_id then
            raise exception 'Only admins can change usernames or account links.';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists users_guard_identity on public.users;
create trigger users_guard_identity
    before update on public.users
    for each row execute function public.users_guard_identity();

-- Keep admin_usernames in step when a competitor is renamed.
create or replace function public.users_sync_admin_rename()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.username is distinct from old.username then
        update public.admin_usernames set username = new.username where username = old.username;
    end if;
    return new;
end;
$$;

drop trigger if exists users_sync_admin_rename on public.users;
create trigger users_sync_admin_rename
    after update of username on public.users
    for each row execute function public.users_sync_admin_rename();

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

-- users: nobody can read auth_user_id directly (use my_competitor / admin_list_accounts).
revoke all on public.users from anon, authenticated;
grant select (id, username, nickname, total_tries, supported_teams, created_at) on public.users to anon, authenticated;
grant insert (username, nickname, total_tries, supported_teams) on public.users to authenticated;
grant update (username, nickname, total_tries, supported_teams) on public.users to authenticated;
grant delete on public.users to authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.predictions enable row level security;
alter table public.matches enable row level security;
alter table public.admin_usernames enable row level security;
alter table public.settings enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.scoring_close_tiers enable row level security;
alter table public.user_joker_selections enable row level security;
alter table public.usage_events enable row level security;

-- Drop the old permissive policies and any previous run of this migration.
do $$
declare
    pol record;
begin
    for pol in
        select schemaname, tablename, policyname
          from pg_policies
         where schemaname = 'public'
           and tablename in ('users', 'predictions', 'matches', 'admin_usernames', 'settings',
                             'scoring_rules', 'scoring_close_tiers', 'user_joker_selections', 'usage_events')
    loop
        execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end
$$;

-- users
create policy users_select on public.users for select to anon, authenticated using (true);
create policy users_insert on public.users for insert to authenticated with check (public.is_admin());
create policy users_update on public.users for update to authenticated
    using (id = public.current_competitor_id() or public.is_admin())
    with check (id = public.current_competitor_id() or public.is_admin());
create policy users_delete on public.users for delete to authenticated using (public.is_admin());

-- predictions and joker selections: public read, own-or-admin write
create policy predictions_select on public.predictions for select to anon, authenticated using (true);
create policy predictions_write on public.predictions for all to authenticated
    using (user_id = public.current_competitor_id() or public.is_admin())
    with check (user_id = public.current_competitor_id() or public.is_admin());

create policy jokers_select on public.user_joker_selections for select to anon, authenticated using (true);
create policy jokers_write on public.user_joker_selections for all to authenticated
    using (user_id = public.current_competitor_id() or public.is_admin())
    with check (user_id = public.current_competitor_id() or public.is_admin());

-- fixtures, settings and scoring rules: public read, admin write
create policy matches_select on public.matches for select to anon, authenticated using (true);
create policy matches_write on public.matches for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

create policy settings_select on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

create policy scoring_rules_select on public.scoring_rules for select to anon, authenticated using (true);
create policy scoring_rules_write on public.scoring_rules for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

create policy scoring_tiers_select on public.scoring_close_tiers for select to anon, authenticated using (true);
create policy scoring_tiers_write on public.scoring_close_tiers for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- admin list: admins only
create policy admin_usernames_all on public.admin_usernames for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- usage events: anyone can log, only admins can read or clear
create policy usage_events_insert on public.usage_events for insert to anon, authenticated with check (true);
create policy usage_events_select on public.usage_events for select to authenticated using (public.is_admin());
create policy usage_events_delete on public.usage_events for delete to authenticated using (public.is_admin());
