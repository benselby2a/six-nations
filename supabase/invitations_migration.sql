-- Six Nations Guesser: invite by email. Admins add just an email; the person fills in their own details
-- (display name, teams) the first time they sign in.
--
-- Run once in the Supabase SQL editor, AFTER registered_logins_migration.sql. Idempotent.
--
-- What it does:
--   * invited_emails            emails an admin has invited that have no competitor yet (admin-only table)
--   * check_login_email         now also recognises an invited email, so it can get a code
--   * am_i_invited()            signed-in accounts: is my confirmed email invited?
--   * create_my_profile(...)    an invited person creates their own competitor on first sign-in. The server
--                               picks the username from their email, links their account, registers their
--                               email on the new competitor and uses up the invitation. Only an invited,
--                               confirmed email can do this: it is NOT open self-signup
--   * admin_invite_email, admin_list_invites, admin_remove_invite   for the Competitors screen
--   * admin_set_competitor_email  refuses an email that has a pending invitation

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table if not exists public.invited_emails (
    email text primary key,
    created_at timestamptz not null default now()
);

create unique index if not exists invited_emails_lower_key on public.invited_emails (lower(email));

alter table public.invited_emails enable row level security;
revoke all on public.invited_emails from anon;

drop policy if exists invited_emails_admin on public.invited_emails;
create policy invited_emails_admin on public.invited_emails for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- The public email check also recognises invitations
-- ---------------------------------------------------------------------------

create or replace function public.check_login_email(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
               select 1 from public.competitor_emails ce
                where lower(ce.email) = lower(trim(coalesce(p_email, '')))
           )
        or exists (
               select 1 from public.invited_emails i
                where lower(i.email) = lower(trim(coalesce(p_email, '')))
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

-- ---------------------------------------------------------------------------
-- Admin: invite, list, remove
-- ---------------------------------------------------------------------------

create or replace function public.admin_invite_email(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_email text := lower(trim(coalesce(p_email, '')));
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;
    if exists (select 1 from public.invited_emails where lower(email) = v_email) then
        raise exception '% has already been invited.', v_email;
    end if;
    if exists (select 1 from public.competitor_emails where lower(email) = v_email)
       or exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id where lower(au.email) = v_email) then
        raise exception '% already belongs to a competitor.', v_email;
    end if;

    insert into public.invited_emails (email) values (v_email);
end;
$$;

create or replace function public.admin_list_invites()
returns table (email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    return query select i.email, i.created_at from public.invited_emails i order by i.created_at desc;
end;
$$;

create or replace function public.admin_remove_invite(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    delete from public.invited_emails where lower(email) = lower(trim(coalesce(p_email, '')));
end;
$$;

-- An existing competitor's email cannot be set to one that is still waiting as an invitation
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
    if exists (select 1 from public.invited_emails where lower(email) = v_email) then
        raise exception '% has a pending invitation. Remove the invitation first.', v_email;
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

revoke execute on function public.admin_invite_email(text) from public, anon;
revoke execute on function public.admin_list_invites() from public, anon;
revoke execute on function public.admin_remove_invite(text) from public, anon;
revoke execute on function public.admin_set_competitor_email(text, text) from public, anon;
grant execute on function public.admin_invite_email(text) to authenticated;
grant execute on function public.admin_list_invites() to authenticated;
grant execute on function public.admin_remove_invite(text) to authenticated;
grant execute on function public.admin_set_competitor_email(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- First sign-in: an invited person fills in their own details
-- ---------------------------------------------------------------------------

create or replace function public.am_i_invited()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1
          from public.invited_emails i
          join auth.users au on lower(au.email) = lower(i.email)
         where au.id = auth.uid() and au.email_confirmed_at is not null
    )
$$;

-- Creates the caller's competitor. Only an invited, confirmed email may do this. Returns the username.
create or replace function public.create_my_profile(p_nickname text, p_supported_teams text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
    v_email text;
    v_nickname text := trim(coalesce(p_nickname, ''));
    v_teams text := nullif(trim(coalesce(p_supported_teams, '')), '');
    v_team text;
    v_base text;
    v_username text;
    v_n integer := 1;
    v_id integer;
begin
    if auth.uid() is null then
        raise exception 'Please sign in first.';
    end if;
    if exists (select 1 from public.users where auth_user_id = auth.uid()) then
        raise exception 'Your account already has a competitor profile.';
    end if;

    select lower(au.email) into v_email
      from auth.users au
     where au.id = auth.uid() and au.email_confirmed_at is not null;
    if v_email is null or not exists (select 1 from public.invited_emails where lower(email) = v_email) then
        raise exception 'Your email has not been invited. Ask an admin to add it.';
    end if;

    if v_nickname = '' or length(v_nickname) > 60 then
        raise exception 'Display name is required (max 60 characters).';
    end if;
    if v_nickname ~ '[<>"]' then
        raise exception 'Display name cannot contain < > or " characters.';
    end if;
    if exists (select 1 from public.users where lower(nickname) = lower(v_nickname)) then
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

    -- The username is an internal handle taken from the email, made unique
    v_base := left(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]', '', 'g'), 26);
    if v_base = '' then
        v_base := 'player';
    end if;
    v_username := v_base;
    while v_username = 'guest'
          or exists (select 1 from public.users where username = v_username)
          or exists (select 1 from public.admin_usernames where username = v_username) loop
        v_n := v_n + 1;
        v_username := v_base || v_n;
    end loop;

    insert into public.users (username, nickname, supported_teams, auth_user_id)
    values (v_username, v_nickname, v_teams, auth.uid())
    returning id into v_id;

    insert into public.competitor_emails (user_id, email) values (v_id, v_email) on conflict do nothing;
    delete from public.invited_emails where lower(email) = v_email;

    return v_username;
end;
$$;

revoke execute on function public.am_i_invited() from public, anon;
revoke execute on function public.create_my_profile(text, text) from public, anon;
grant execute on function public.am_i_invited() to authenticated;
grant execute on function public.create_my_profile(text, text) to authenticated;
