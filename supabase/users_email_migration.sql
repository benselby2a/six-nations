-- Six Nations Guesser: keep each competitor's sign-in email on the users table.
--
-- Run once in the Supabase SQL editor, AFTER invitations_migration.sql. Idempotent.
--
-- Before: registered emails lived in competitor_emails and pending invitations in invited_emails.
-- Now:    users.email holds it. Clients cannot read or write that column (column privileges, the same
--         way auth_user_id is hidden); admins use the RPCs below. An invitation is simply a users row with
--         the email set and no display name yet: when that person signs in, the account links to the row
--         by email and they complete their own name and teams.
--
-- What it does:
--   * users.email                 unique (case-insensitive), hidden from everyone but the admin RPCs
--   * data moved                  competitor_emails -> users.email; accounts already linked get their login email;
--                                 invited_emails -> placeholder users rows (neutral usernames like player12, so
--                                 nothing about the email is visible); then both old tables are dropped
--   * my_competitor()             links the account to the unlinked users row whose email matches the account's
--                                 confirmed email, and returns it (nickname is null until the profile is completed)
--   * check_login_email()         registered = a users row has that email, or an account linked to a competitor does
--   * admin_set_competitor_email / admin_list_competitor_emails / admin_invite_email   for the Competitors screen
--   * complete_my_profile()       replaces create_my_profile: an invited person fills in their own display name and
--                                 teams on the row that was made for them. It cannot create anyone
--   * removed                     admin_import_competitor_emails, am_i_invited, admin_list_invites, admin_remove_invite,
--                                 create_my_profile (deleting the card deletes a pending invitation)

-- ---------------------------------------------------------------------------
-- The column (no grants: clients can neither read nor write it)
-- ---------------------------------------------------------------------------

alter table public.users add column if not exists email text;
create unique index if not exists users_email_key on public.users (lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- Neutral username for an invitation (nothing derived from the email)
-- ---------------------------------------------------------------------------

create or replace function public._next_player_username()
returns text
language plpgsql set search_path = public as $$
declare
    v_n integer := 1;
begin
    while exists (select 1 from public.users where username = 'player' || v_n)
          or exists (select 1 from public.admin_usernames where username = 'player' || v_n) loop
        v_n := v_n + 1;
    end loop;
    return 'player' || v_n;
end;
$$;

revoke execute on function public._next_player_username() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Move the data (only if the old tables are still there)
-- ---------------------------------------------------------------------------

do $$
declare
    v_row record;
begin
    if to_regclass('public.competitor_emails') is not null then
        update public.users u
           set email = lower(ce.email)
          from public.competitor_emails ce
         where ce.user_id = u.id
           and u.email is null
           and not exists (select 1 from public.users x where lower(x.email) = lower(ce.email));
    end if;

    -- Accounts already linked to a competitor: their login email is their registered email
    update public.users u
       set email = lower(au.email)
      from auth.users au
     where au.id = u.auth_user_id
       and au.email is not null
       and u.email is null
       and not exists (select 1 from public.users x where lower(x.email) = lower(au.email));

    if to_regclass('public.invited_emails') is not null then
        for v_row in
            select lower(i.email) as email from public.invited_emails i
             where not exists (select 1 from public.users x where lower(x.email) = lower(i.email))
             order by i.created_at
        loop
            insert into public.users (username, email) values (public._next_player_username(), v_row.email);
        end loop;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Functions (all read users.email)
-- ---------------------------------------------------------------------------

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
             where lower(u.email) = v_email
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

create or replace function public.check_login_email(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
               select 1 from public.users u
                where lower(u.email) = lower(trim(coalesce(p_email, '')))
           )
        or exists (
               select 1
                 from public.users u
                 join auth.users au on au.id = u.auth_user_id
                where lower(au.email) = lower(trim(coalesce(p_email, '')))
           )
$$;

revoke execute on function public.check_login_email(text) from public;
grant execute on function public.check_login_email(text) to anon, authenticated;

-- Set (or, with an empty email, clear) the email a competitor signs in with.
-- Changing or clearing it for someone who has already signed up releases their old account.
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
        update public.users set email = null, auth_user_id = null where id = v_user.id;
        return;
    end if;

    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;

    if exists (select 1 from public.users where lower(email) = v_email and id <> v_user.id)
       or exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id
                   where lower(au.email) = v_email and u.id <> v_user.id) then
        raise exception '% is already registered to another competitor.', v_email;
    end if;

    update public.users set email = v_email where id = v_user.id;

    -- If they are signed up under a different email, release that account: signing in with the new
    -- email links to this competitor automatically (my_competitor)
    update public.users u
       set auth_user_id = null
     where u.id = v_user.id
       and u.auth_user_id is not null
       and not exists (select 1 from auth.users au where au.id = u.auth_user_id and lower(au.email) = v_email);
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
        select u.username::text, u.email, (u.auth_user_id is not null)
          from public.users u
         where u.email is not null
         order by u.username;
end;
$$;

-- Invite someone by email alone: a users row with the email and no name yet
create or replace function public.admin_invite_email(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_email text := lower(trim(coalesce(p_email, '')));
    v_existing public.users%rowtype;
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;

    select * into v_existing from public.users where lower(email) = v_email;
    if found then
        if v_existing.nickname is null and v_existing.auth_user_id is null then
            raise exception '% has already been invited.', v_email;
        end if;
        raise exception '% already belongs to a competitor.', v_email;
    end if;
    if exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id where lower(au.email) = v_email) then
        raise exception '% already belongs to a competitor.', v_email;
    end if;

    insert into public.users (username, email) values (public._next_player_username(), v_email);
end;
$$;

-- First sign-in: the invited person fills in their own details on the row made for them
create or replace function public.complete_my_profile(p_nickname text, p_supported_teams text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
    v_user public.users%rowtype;
    v_nickname text := trim(coalesce(p_nickname, ''));
    v_teams text := nullif(trim(coalesce(p_supported_teams, '')), '');
    v_team text;
    v_base text;
    v_username text;
    v_n integer := 1;
begin
    if auth.uid() is null then
        raise exception 'Please sign in first.';
    end if;

    -- Make sure the account is linked to its invited row (it normally already is)
    perform 1 from public.my_competitor();

    select * into v_user from public.users where auth_user_id = auth.uid();
    if not found then
        raise exception 'Your email has not been invited. Ask an admin to add it.';
    end if;
    if coalesce(v_user.nickname, '') <> '' then
        raise exception 'Your profile is already set up.';
    end if;

    if v_nickname = '' or length(v_nickname) > 60 then
        raise exception 'Display name is required (max 60 characters).';
    end if;
    if v_nickname ~ '[<>"]' then
        raise exception 'Display name cannot contain < > or " characters.';
    end if;
    if exists (select 1 from public.users where lower(nickname) = lower(v_nickname) and id <> v_user.id) then
        raise exception 'This display name is already taken.';
    end if;

    if v_teams is not null then
        if array_length(string_to_array(v_teams, ','), 1) > 2 then
            raise exception 'Choose up to 2 supported teams.';
        end if;
        foreach v_team in array string_to_array(v_teams, ',') loop
            if v_team not in ('England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales') then
                raise exception 'Unknown team: %.', v_team;
            end if;
        end loop;
    end if;

    -- A tidy internal username from the display name, made unique
    v_base := left(regexp_replace(lower(v_nickname), '[^a-z0-9]', '', 'g'), 26);
    if v_base = '' then
        v_base := 'player';
    end if;
    v_username := v_base;
    while v_username = 'guest'
          or exists (select 1 from public.users where username = v_username and id <> v_user.id)
          or exists (select 1 from public.admin_usernames where username = v_username) loop
        v_n := v_n + 1;
        v_username := v_base || v_n;
    end loop;

    update public.users
       set nickname = v_nickname, supported_teams = v_teams, username = v_username
     where id = v_user.id;

    return v_username;
end;
$$;

-- ---------------------------------------------------------------------------
-- Old objects out, grants in
-- ---------------------------------------------------------------------------

drop function if exists public.admin_import_competitor_emails(jsonb);
drop function if exists public.am_i_invited();
drop function if exists public.admin_list_invites();
drop function if exists public.admin_remove_invite(text);
drop function if exists public.create_my_profile(text, text);
drop function if exists public.create_my_profile(text, text, text);

drop table if exists public.competitor_emails;
drop table if exists public.invited_emails;

revoke execute on function public.admin_set_competitor_email(text, text) from public, anon;
revoke execute on function public.admin_list_competitor_emails() from public, anon;
revoke execute on function public.admin_invite_email(text) from public, anon;
revoke execute on function public.complete_my_profile(text, text) from public, anon;
grant execute on function public.admin_set_competitor_email(text, text) to authenticated;
grant execute on function public.admin_list_competitor_emails() to authenticated;
grant execute on function public.admin_invite_email(text) to authenticated;
grant execute on function public.complete_my_profile(text, text) to authenticated;
