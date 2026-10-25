-- Six Nations Guesser: read-only security check. Paste into the Supabase SQL editor and run.
-- It changes nothing. Every row should say ok; "FAIL" rows say what to look at,
-- "info" rows are things to eyeball.

select * from (
    select 1 as n, 'Row level security is on for every table in public' as check,
           case when (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0
                then 'ok' else 'FAIL: ' || (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity) end as result
    union all
    select 2, 'Guests (anon) have no write privileges on any table',
           case when (select count(*) from information_schema.table_privileges
                       where table_schema = 'public' and grantee = 'anon'
                         and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) = 0
                then 'ok' else 'FAIL: run supabase/preregistered_emails_migration.sql' end
    union all
    select 3, 'No policy lets guests or everyone write',
           case when (select count(*) from pg_policies
                       where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                         and ('anon' = any(roles) or 'public' = any(roles))) = 0
                then 'ok' else 'FAIL: ' || (select string_agg(tablename || '.' || policyname, ', ') from pg_policies
                       where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                         and ('anon' = any(roles) or 'public' = any(roles))) end
    union all
    select 4, 'No write policy that is simply "allow everything" (using true)',
           case when (select count(*) from pg_policies
                       where schemaname = 'public' and cmd <> 'SELECT'
                         and (qual = 'true' or with_check = 'true')) = 0
                then 'ok' else 'FAIL: ' || (select string_agg(tablename || '.' || policyname, ', ') from pg_policies
                       where schemaname = 'public' and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true')) end
    union all
    select 5, 'The old "Allow all access" policies are gone',
           case when (select count(*) from pg_policies where schemaname = 'public' and policyname like 'Allow all access%') = 0
                then 'ok' else 'FAIL: run supabase/auth_migration.sql' end
    union all
    select 6, 'Password hashes are gone from the users table',
           case when (select count(*) from information_schema.columns
                       where table_schema = 'public' and table_name = 'users' and column_name = 'password_hash') = 0
                then 'ok' else 'FAIL: password_hash column still exists' end
    union all
    select 7, 'The link between accounts and competitors (auth_user_id) is not readable by clients',
           case when not has_column_privilege('anon', 'public.users', 'auth_user_id', 'select')
                 and not has_column_privilege('authenticated', 'public.users', 'auth_user_id', 'select')
                then 'ok' else 'FAIL' end
    union all
    select 8, 'Registered sign-in emails are not readable by guests',
           case when to_regclass('public.competitor_emails') is null then 'FAIL: run supabase/preregistered_emails_migration.sql'
                when has_table_privilege('anon', 'public.competitor_emails', 'select') then 'FAIL'
                else 'ok' end
    union all
    select 9, 'Usage events can only be written by signed-in people under their own name',
           case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events'
                              and cmd = 'INSERT' and with_check is not null and with_check <> 'true'
                              and not ('anon' = any(roles)))
                then 'ok' else 'FAIL: run supabase/preregistered_emails_migration.sql' end
    union all
    select 10, 'Guests cannot run the admin and profile functions',
           case when to_regprocedure('public.create_my_profile(text,text,text)') is null then 'FAIL: run auth_migration.sql'
                when has_function_privilege('anon', 'public.create_my_profile(text,text,text)', 'execute')
                  or has_function_privilege('anon', 'public.admin_link_competitor(text,uuid)', 'execute')
                  or has_function_privilege('anon', 'public.admin_list_accounts()', 'execute') then 'FAIL'
                else 'ok' end
    union all
    select 11, 'Display names are restricted (no < > ") and usernames are letters and numbers',
           case when exists (select 1 from pg_constraint where conname = 'users_nickname_safe')
                 and exists (select 1 from pg_constraint where conname = 'users_username_safe')
                then 'ok' else 'FAIL: run supabase/preregistered_emails_migration.sql' end
    union all
    select 12, 'No admin entries without a matching competitor',
           case when (select count(*) from admin_usernames a left join users u on u.username = a.username where u.id is null) = 0
                then 'ok' else 'FAIL: delete these from admin_usernames: ' ||
                     (select string_agg(a.username, ', ') from admin_usernames a left join users u on u.username = a.username where u.id is null) end
    union all
    select 13, 'No existing display names with markup',
           case when (select count(*) from users where nickname ~ '[<>"]') = 0
                then 'ok' else 'FAIL: rename these competitors: ' || (select string_agg(username, ', ') from users where nickname ~ '[<>"]') end
    union all
    select 14, 'info: new people can create their own profile',
           coalesce((select case when value = 'true' then 'ON (anyone who signs in can create a profile)' else 'off (only registered emails can play)' end
                       from settings where key = 'allow_self_signup'), 'off (only registered emails can play)')
) checks
order by n;
