-- Six Nations Guesser: a new competitor can add a second sign-in email (e.g. a team mate) when they join.
--
-- Run once in the Supabase SQL editor, AFTER second_email_migration.sql. Idempotent.
--
--   add_my_second_email(p_email)   signed-in competitor only. Adds a second sign-in email to their OWN competitor,
--                                  once (admins change or clear it later on the Competitors screen). The email must
--                                  look valid, differ from their own, and not already belong to anyone else.
--                                  Whoever signs in with it gets the same competitor (and the same access).

create or replace function public.add_my_second_email(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_user public.users%rowtype;
    v_email text := lower(trim(coalesce(p_email, '')));
begin
    if auth.uid() is null then
        raise exception 'Please sign in first.';
    end if;

    select * into v_user from public.users where auth_user_id = auth.uid() or auth_user_id2 = auth.uid();
    if not found then
        raise exception 'Your account has no competitor profile yet.';
    end if;
    if v_user.email2 is not null then
        raise exception 'A second email is already set. Ask an admin to change it.';
    end if;
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception '"%" does not look like an email address.', p_email;
    end if;
    if v_email = lower(coalesce(v_user.email, ''))
       or exists (select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = v_email) then
        raise exception 'That is already your sign-in email.';
    end if;
    if exists (select 1 from public.users where (lower(email) = v_email or lower(email2) = v_email) and id <> v_user.id)
       or exists (select 1 from public.users u join auth.users au on au.id in (u.auth_user_id, u.auth_user_id2)
                   where lower(au.email) = v_email and u.id <> v_user.id) then
        raise exception '% already belongs to another competitor.', v_email;
    end if;

    update public.users set email2 = v_email where id = v_user.id;
end;
$$;

revoke execute on function public.add_my_second_email(text) from public, anon;
grant execute on function public.add_my_second_email(text) to authenticated;
