-- Six Nations Guesser: up to two sign-in emails per player. Either one can log in as that player.
--
-- Run once in the Supabase SQL editor, AFTER users_email_migration.sql. Idempotent.
--
-- Each email slot has its own linked account slot, because two different emails are two different
-- sign-in accounts that must both reach the same competitor:
--     users.email  <-> users.auth_user_id        (the first email and the account that signed in with it)
--     users.email2 <-> users.auth_user_id2       (the optional second ones)
-- None of these four columns can be read or written by any client; only the functions below can.
--
--   * my_competitor()            links whichever account signs in, by whichever email matches
--   * current_competitor_id() / is_admin() / users_guard_identity()   understand both accounts, so a competitor
--                                (and an admin) can act from either one
--   * check_login_email()        recognises both emails
--   * admin_set_competitor_email(username, email, slot)   slot 1 (default) or 2; clearing or changing a slot
--                                releases only that slot's account; an admin cannot cut off the account they are using
--   * admin_list_competitor_emails()   now returns both emails and whether each is linked
--   * admin_link_competitor / admin_unlink_account / admin_list_accounts   handle two accounts per competitor
--   * a backstop trigger stops an email or an account being attached to two competitors

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.users add column if not exists email2 text;
alter table public.users add column if not exists auth_user_id2 uuid unique references auth.users(id) on delete set null;
create unique index if not exists users_email2_key on public.users (lower(email2)) where email2 is not null;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'users_emails_differ') then
        alter table public.users add constraint users_emails_differ
            check (email2 is null or lower(email2) is distinct from lower(email));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'users_accounts_differ') then
        alter table public.users add constraint users_accounts_differ
            check (auth_user_id2 is null or auth_user_id2 is distinct from auth_user_id);
    end if;
end
$$;

-- Backstop: an email, or an account, belongs to one competitor only (the functions check too)
create or replace function public.users_login_uniqueness_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.email is not null and exists (
        select 1 from public.users u
         where u.id is distinct from new.id and (lower(u.email) = lower(new.email) or lower(u.email2) = lower(new.email))) then
        raise exception '% is already registered to another competitor.', lower(new.email);
    end if;
    if new.email2 is not null and exists (
        select 1 from public.users u
         where u.id is distinct from new.id and (lower(u.email) = lower(new.email2) or lower(u.email2) = lower(new.email2))) then
        raise exception '% is already registered to another competitor.', lower(new.email2);
    end if;
    if new.auth_user_id is not null and exists (
        select 1 from public.users u
         where u.id is distinct from new.id and (u.auth_user_id = new.auth_user_id or u.auth_user_id2 = new.auth_user_id)) then
        raise exception 'That account is already linked to another competitor.';
    end if;
    if new.auth_user_id2 is not null and exists (
        select 1 from public.users u
         where u.id is distinct from new.id and (u.auth_user_id = new.auth_user_id2 or u.auth_user_id2 = new.auth_user_id2)) then
        raise exception 'That account is already linked to another competitor.';
    end if;
    return new;
end;
$$;

drop trigger if exists users_login_uniqueness_guard on public.users;
create trigger users_login_uniqueness_guard
    before insert or update of email, email2, auth_user_id, auth_user_id2 on public.users
    for each row execute function public.users_login_uniqueness_guard();

-- ---------------------------------------------------------------------------
-- Either account counts as the competitor
-- ---------------------------------------------------------------------------

create or replace function public.current_competitor_id()
returns integer
language sql stable security definer set search_path = public as $$
    select id from public.users where auth_user_id = auth.uid() or auth_user_id2 = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1
          from public.users u
          join public.admin_usernames a on a.username = u.username
         where u.auth_user_id = auth.uid() or u.auth_user_id2 = auth.uid()
    )
$$;

create or replace function public.users_guard_identity()
returns trigger
language plpgsql as $$
begin
    if current_user in ('anon', 'authenticated') and not public.is_admin() then
        if new.id is distinct from old.id
           or new.username is distinct from old.username
           or new.auth_user_id is distinct from old.auth_user_id
           or new.auth_user_id2 is distinct from old.auth_user_id2 then
            raise exception 'Only admins can change usernames or account links.';
        end if;
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-in
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

    select id into v_linked_id from public.users where auth_user_id = auth.uid() or auth_user_id2 = auth.uid();

    if v_linked_id is null then
        select lower(au.email) into v_email
          from auth.users au
         where au.id = auth.uid() and au.email_confirmed_at is not null;

        if v_email is not null then
            update public.users u set auth_user_id = auth.uid()
             where lower(u.email) = v_email and u.auth_user_id is null;
            if not found then
                update public.users u set auth_user_id2 = auth.uid()
                 where lower(u.email2) = v_email and u.auth_user_id2 is null;
            end if;
        end if;
    end if;

    return query
        select u.username::text, u.nickname::text
          from public.users u
         where u.auth_user_id = auth.uid() or u.auth_user_id2 = auth.uid();
end;
$$;

grant execute on function public.my_competitor() to authenticated;

create or replace function public.check_login_email(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
               select 1 from public.users u
                where lower(u.email) = lower(trim(coalesce(p_email, '')))
                   or lower(u.email2) = lower(trim(coalesce(p_email, '')))
           )
        or exists (
               select 1
                 from public.users u
                 join auth.users au on au.id = u.auth_user_id or au.id = u.auth_user_id2
                where lower(au.email) = lower(trim(coalesce(p_email, '')))
           )
$$;

revoke execute on function public.check_login_email(text) from public;
grant execute on function public.check_login_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: emails
-- ---------------------------------------------------------------------------

drop function if exists public.admin_set_competitor_email(text, text);

-- Set (or, with an empty email, clear) one of a competitor's two sign-in emails (slot 1 or 2).
-- Changing or clearing a slot releases that slot's account only.
create or replace function public.admin_set_competitor_email(p_username text, p_email text, p_slot integer default 1)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_user public.users%rowtype;
    v_email text := lower(trim(coalesce(p_email, '')));
    v_slot_account uuid;
    v_other_email text;
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    if p_slot not in (1, 2) then
        raise exception 'The email slot must be 1 or 2.';
    end if;

    select * into v_user from public.users where username = lower(trim(coalesce(p_username, '')));
    if not found then
        raise exception 'Competitor "%" not found.', p_username;
    end if;

    v_slot_account := case p_slot when 1 then v_user.auth_user_id else v_user.auth_user_id2 end;
    v_other_email := lower(case p_slot when 1 then v_user.email2 else v_user.email end);

    -- An admin must not cut off the account they are using right now
    if v_slot_account is not null and v_slot_account = auth.uid()
       and not exists (select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = v_email) then
        raise exception 'Ask another admin to change the email you are signed in with, so you cannot lock yourself out.';
    end if;

    if v_email = '' then
        -- Removing an email removes that sign-in
        if p_slot = 1 then
            update public.users set email = null, auth_user_id = null where id = v_user.id;
        else
            update public.users set email2 = null, auth_user_id2 = null where id = v_user.id;
        end if;
        return;
    end if;

    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;
    if v_email = v_other_email then
        raise exception 'The two emails must be different.';
    end if;
    if exists (select 1 from public.users where id <> v_user.id and (lower(email) = v_email or lower(email2) = v_email))
       or exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id or au.id = u.auth_user_id2
                   where lower(au.email) = v_email and u.id <> v_user.id) then
        raise exception '% is already registered to another competitor.', v_email;
    end if;

    if p_slot = 1 then
        update public.users set email = v_email where id = v_user.id;
        -- signed up under a different email: release that account (the new email links on its first sign-in)
        update public.users u set auth_user_id = null
         where u.id = v_user.id and u.auth_user_id is not null
           and not exists (select 1 from auth.users au where au.id = u.auth_user_id and lower(au.email) = v_email);
    else
        update public.users set email2 = v_email where id = v_user.id;
        update public.users u set auth_user_id2 = null
         where u.id = v_user.id and u.auth_user_id2 is not null
           and not exists (select 1 from auth.users au where au.id = u.auth_user_id2 and lower(au.email) = v_email);
    end if;
end;
$$;

drop function if exists public.admin_list_competitor_emails();

create or replace function public.admin_list_competitor_emails()
returns table (username text, email text, email2 text, linked boolean, linked2 boolean)
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    return query
        select u.username::text, u.email, u.email2, (u.auth_user_id is not null), (u.auth_user_id2 is not null)
          from public.users u
         where u.email is not null or u.email2 is not null
         order by u.username;
end;
$$;

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

    select * into v_existing from public.users where lower(email) = v_email or lower(email2) = v_email limit 1;
    if found then
        if v_existing.nickname is null and v_existing.auth_user_id is null and v_existing.email2 is null then
            raise exception '% has already been invited.', v_email;
        end if;
        raise exception '% already belongs to a competitor.', v_email;
    end if;
    if exists (select 1 from public.users u join auth.users au on au.id = u.auth_user_id or au.id = u.auth_user_id2
                where lower(au.email) = v_email) then
        raise exception '% already belongs to a competitor.', v_email;
    end if;

    insert into public.users (username, email) values (public._next_player_username(), v_email);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: accounts
-- ---------------------------------------------------------------------------

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
          left join public.users u on u.auth_user_id = au.id or u.auth_user_id2 = au.id
         order by au.created_at desc;
end;
$$;

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
        -- unlink every account of this competitor (not the one in use)
        if v_target.auth_user_id = auth.uid() or v_target.auth_user_id2 = auth.uid() then
            raise exception 'You cannot unlink your own account.';
        end if;
        update public.users set auth_user_id = null, auth_user_id2 = null where id = v_target.id;
        return;
    end if;

    if not exists (select 1 from auth.users where id = p_auth_user_id) then
        raise exception 'Account not found.';
    end if;
    if v_target.auth_user_id = p_auth_user_id or v_target.auth_user_id2 = p_auth_user_id then
        return;
    end if;

    select * into v_other from public.users
     where (auth_user_id = p_auth_user_id or auth_user_id2 = p_auth_user_id) and id <> v_target.id;
    if found then
        if exists (select 1 from public.predictions where user_id = v_other.id)
           or exists (select 1 from public.user_joker_selections where user_id = v_other.id)
           or v_other.total_tries is not null then
            raise exception 'This account already owns competitor "%". Unlink it first.', v_other.username;
        end if;
        delete from public.admin_usernames where username = v_other.username;
        delete from public.users where id = v_other.id;
    end if;

    if v_target.auth_user_id is null then
        update public.users set auth_user_id = p_auth_user_id where id = v_target.id;
    elsif v_target.auth_user_id2 is null then
        update public.users set auth_user_id2 = p_auth_user_id where id = v_target.id;
    else
        raise exception 'This competitor already has two linked accounts. Unlink one first.';
    end if;
end;
$$;

-- Unlink one account from whichever competitor it belongs to
create or replace function public.admin_unlink_account(p_auth_user_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
    if not public.is_admin() then
        raise exception 'Admins only.';
    end if;
    if p_auth_user_id = auth.uid() then
        raise exception 'You cannot unlink your own account.';
    end if;
    update public.users set auth_user_id = null where auth_user_id = p_auth_user_id;
    update public.users set auth_user_id2 = null where auth_user_id2 = p_auth_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- First sign-in profile: find the row through either account
-- ---------------------------------------------------------------------------

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

    select * into v_user from public.users where id = public.current_competitor_id();
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
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_set_competitor_email(text, text, integer) from public, anon;
revoke execute on function public.admin_list_competitor_emails() from public, anon;
revoke execute on function public.admin_invite_email(text) from public, anon;
revoke execute on function public.admin_list_accounts() from public, anon;
revoke execute on function public.admin_link_competitor(text, uuid) from public, anon;
revoke execute on function public.admin_unlink_account(uuid) from public, anon;
revoke execute on function public.complete_my_profile(text, text) from public, anon;
grant execute on function public.admin_set_competitor_email(text, text, integer) to authenticated;
grant execute on function public.admin_list_competitor_emails() to authenticated;
grant execute on function public.admin_invite_email(text) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_link_competitor(text, uuid) to authenticated;
grant execute on function public.admin_unlink_account(uuid) to authenticated;
grant execute on function public.complete_my_profile(text, text) to authenticated;
