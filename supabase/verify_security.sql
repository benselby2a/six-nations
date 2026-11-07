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
    select 8, 'Sign-in emails (users.email) are not readable or writable by any client',
           case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'email')
                then 'FAIL: run supabase/users_email_migration.sql'
                when has_column_privilege('anon', 'public.users', 'email', 'select')
                  or has_column_privilege('authenticated', 'public.users', 'email', 'select')
                  or has_column_privilege('authenticated', 'public.users', 'email', 'update')
                  or has_column_privilege('authenticated', 'public.users', 'email', 'insert') then 'FAIL: clients can reach the email column'
                when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'email2')
                 and (has_column_privilege('anon', 'public.users', 'email2', 'select')
                   or has_column_privilege('authenticated', 'public.users', 'email2', 'select')
                   or has_column_privilege('authenticated', 'public.users', 'email2', 'update')
                   or has_column_privilege('authenticated', 'public.users', 'auth_user_id2', 'select')
                   or has_column_privilege('authenticated', 'public.users', 'auth_user_id2', 'update')) then 'FAIL: clients can reach the second email columns'
                else 'ok' end
    union all
    select 9, 'Usage events can only be written by signed-in people under their own name',
           case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events'
                              and cmd = 'INSERT' and with_check is not null and with_check <> 'true'
                              and not ('anon' = any(roles)))
                then 'ok' else 'FAIL: run supabase/preregistered_emails_migration.sql' end
    union all
    select 10, 'Guests cannot run the admin, invite or profile functions, and open self-signup is gone',
           case when to_regprocedure('public.admin_link_competitor(text,uuid)') is null then 'FAIL: run supabase/auth_migration.sql'
                when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'create_my_profile')
                  then 'FAIL: the old self-signup function still exists; run supabase/users_email_migration.sql'
                when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public'
                                and p.proname in ('admin_link_competitor', 'admin_list_accounts', 'admin_set_competitor_email', 'admin_unlink_account', 'add_my_second_email', 'admin_list_competitor_emails', 'admin_invite_email', 'complete_my_profile', '_next_player_username')
                                and has_function_privilege('anon', p.oid, 'execute')) then 'FAIL'
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
    select 14, 'Sign-in is limited to registered emails (the login screen can check an email and list the admins)',
           case when to_regprocedure('public.check_login_email(text)') is null
                  or to_regprocedure('public.login_admin_names()') is null then 'FAIL: run supabase/registered_logins_migration.sql'
                else 'ok' end
    union all
    select 15, 'The optional before-user-created hook function exists (enable it in Authentication > Hooks for a hard stop)',
           case when to_regprocedure('public.hook_before_user_created(jsonb)') is null then 'FAIL: run supabase/registered_logins_migration.sql'
                when has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute') then 'FAIL: guests can run the hook'
                else 'ok' end
    union all
    select 16, 'The newest versions of the sign-in functions are installed (an older migration was not re-run afterwards)',
           case when to_regprocedure('public.complete_my_profile(text,text)') is null
                  or position('competitor_emails' in pg_get_functiondef(to_regprocedure('public.check_login_email(text)'))) > 0
                  or position('competitor_emails' in pg_get_functiondef(to_regprocedure('public.my_competitor()'))) > 0
                  or to_regprocedure('public.admin_set_competitor_email(text,text)') is not null
                  or to_regprocedure('public.admin_set_competitor_email(text,text,integer)') is null
                then 'FAIL: run supabase/users_email_migration.sql then supabase/second_email_migration.sql (migrations must be run in order; do not re-run an older one afterwards)'
                else 'ok' end
    union all
    select 19, 'Match chat tables: guests can read but not write; only your own rows can be added',
           case when to_regclass('public.fixture_comments') is null then 'n/a (run supabase/fixture_chat_migration.sql)'
                when has_table_privilege('anon', 'public.fixture_comments', 'insert') or has_table_privilege('anon', 'public.fixture_comments', 'delete')
                  or has_table_privilege('anon', 'public.fixture_reactions', 'insert') or has_table_privilege('anon', 'public.fixture_reactions', 'delete') then 'FAIL: guests can write'
                when not exists (select 1 from pg_policies where tablename = 'fixture_comments' and cmd = 'INSERT' and with_check like '%current_competitor_id%')
                  or not exists (select 1 from pg_policies where tablename = 'fixture_reactions' and cmd = 'INSERT' and with_check like '%current_competitor_id%') then 'FAIL: posting is not tied to the signed-in competitor'
                else 'ok' end
    union all
    select 17, 'info: competitors with no sign-in email (they cannot log in until an admin adds one)',
           case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'email')
                then 'n/a (run supabase/users_email_migration.sql)'
                else (xpath('/row/c/text()', query_to_xml(
                        'select count(*) as c from public.users u where u.email is null and u.auth_user_id is null and u.nickname is not null',
                        false, true, '')))[1]::text || ' competitor(s)' end
    union all
    select 18, 'info: invited, not signed in yet',
           case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'email')
                then 'n/a (run supabase/users_email_migration.sql)'
                else (xpath('/row/c/text()', query_to_xml(
                        'select count(*) as c from public.users u where u.nickname is null and u.auth_user_id is null',
                        false, true, '')))[1]::text || ' invitation(s)' end
) checks
order by n;
