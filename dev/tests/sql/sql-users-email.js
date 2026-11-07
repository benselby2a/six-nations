const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const repo = require('path').resolve(__dirname, '../../..');
const appSrc = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const generateSchemaSQL = new Function(appSrc.slice(appSrc.indexOf('function generateSchemaSQL()'), appSrc.indexOf('function generateDataSQL()')) + '; return generateSchemaSQL;')();
const mig = (f) => fs.readFileSync(repo + '/supabase/' + f, 'utf8');
const U = (n) => '00000000-0000-0000-0000-0000000000' + n;
const A = U('a0'), B = U('b0'), LIN = U('c0'), INV = U('d0'), UNINV = U('e0'), WAIT = U('e1'), NEW = U('f0');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); };

(async () => {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
    grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;`);
  await db.exec(generateSchemaSQL());
  // the state your live database is in today
  for (const f of ['auth_migration.sql', 'years_migration.sql', 'preregistered_emails_migration.sql', 'registered_logins_migration.sql', 'invitations_migration.sql']) await db.exec(mig(f));

  const as = async (uid, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']); await db.exec(`set role ${role}`); };
  const tryq = async (sql, params) => { try { const r = await db.query(sql, params); return { ok: true, rows: r.rows }; } catch (e) { return { ok: false, err: String(e.message || e) }; } };
  const su = async (sql, params) => { await db.exec('reset role'); return db.query(sql, params); };

  // ---- seed the live-like data
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${A}', 'ben@x.com', now()), ('${B}', 'sam@x.com', now()), ('${LIN}', 'lin@x.com', now()),
      ('${INV}', 'nic.jones@x.com', now()), ('${UNINV}', 'nobody@x.com', now()), ('${WAIT}', 'wait@x.com', null);
    insert into users (username, nickname, auth_user_id) values ('ben', 'Ben', '${A}'), ('lin', 'Lin', '${LIN}');
    insert into users (username, nickname) values ('sam', 'Sam'), ('tim', 'Tim');
    insert into admin_usernames (username) values ('ben'), ('ghost');
    insert into competitor_emails (user_id, email) select id, 'ben@x.com' from users where username = 'ben';
    insert into competitor_emails (user_id, email) select id, 'sam@x.com' from users where username = 'sam';
    insert into invited_emails (email, created_at) values ('nic.jones@x.com', now() - interval '2 minutes'), ('wait@x.com', now() - interval '1 minute');`);

  // ---- run the conversion (twice: it must be safe to repeat)
  await db.exec(mig('users_email_migration.sql'));
  await db.exec(mig('users_email_migration.sql'));
  ok('the conversion runs, and re-running it is clean', true);

  const rows = (await su("select username, nickname, email, auth_user_id from users order by username")).rows;
  const by = (u) => rows.find(r => r.username === u);
  ok('registered emails moved onto users', by('ben').email === 'ben@x.com' && by('sam').email === 'sam@x.com');
  ok('an account linked by hand brought its login email across', by('lin').email === 'lin@x.com');
  ok('a competitor with no email stays without one', by('tim').email === null);
  const placeholders = rows.filter(r => r.nickname === null);
  ok('pending invitations became placeholder rows with neutral usernames', placeholders.length === 2 && placeholders.every(p => /^player\d+$/.test(p.username) && p.auth_user_id === null) && placeholders.map(p => p.email).sort().join() === 'nic.jones@x.com,wait@x.com', JSON.stringify(placeholders));
  ok('the two old tables are gone', (await su("select to_regclass('public.competitor_emails') is null a, to_regclass('public.invited_emails') is null b")).rows[0].a === true && (await su("select to_regclass('public.invited_emails') is null b")).rows[0].b === true);
  const gone = await su(`select to_regprocedure('public.am_i_invited()') is null a, to_regprocedure('public.admin_list_invites()') is null b, to_regprocedure('public.admin_remove_invite(text)') is null c, to_regprocedure('public.create_my_profile(text,text)') is null d, to_regprocedure('public.admin_import_competitor_emails(jsonb)') is null e`);
  ok('the old invite and profile functions are gone', Object.values(gone.rows[0]).every(v => v === true), JSON.stringify(gone.rows[0]));

  // ---- the email column is private
  await as(null, 'anon');
  let r = await tryq('select email from users');
  ok('a guest cannot read the email column', !r.ok && /permission denied/.test(r.err), r.err);
  r = await tryq('select username, nickname from users order by username');
  ok('...but still reads the leaderboard columns, and sees no email-derived names', r.ok && r.rows.every(x => !/jones|wait|nic/.test(x.username)), JSON.stringify(r.rows.map(x => x.username)));
  await as(B);
  r = await tryq('select email from users');
  ok('a signed-in player cannot read it either', !r.ok && /permission denied/.test(r.err), r.err);
  r = await tryq("update users set email = 'x@x.com' where username = 'sam'");
  ok('...or write it', !r.ok && /permission denied/.test(r.err), r.err);
  r = await su(`select has_column_privilege('anon','public.users','email','select') a, has_column_privilege('authenticated','public.users','email','select') b, has_column_privilege('authenticated','public.users','email','update') c, has_column_privilege('authenticated','public.users','email','insert') d`);
  ok('no client has any privilege on the email column', Object.values(r.rows[0]).every(v => v === false), JSON.stringify(r.rows[0]));

  // ---- the public check
  await as(null, 'anon');
  r = await tryq("select check_login_email(' SAM@X.com ') a, check_login_email('nic.jones@x.com') b, check_login_email('lin@x.com') c, check_login_email('stranger@x.com') d, check_login_email('') e, check_login_email(null) f");
  ok('registered, invited and hand-linked emails are recognised; strangers, empty and null are not', r.ok && r.rows[0].a && r.rows[0].b && r.rows[0].c && !r.rows[0].d && !r.rows[0].e && !r.rows[0].f, JSON.stringify(r.rows[0]));

  // ---- auto-link for an existing competitor
  await as(B);
  r = await tryq('select * from my_competitor()');
  ok('a registered email links to its competitor on first sign-in', r.ok && r.rows.length === 1 && r.rows[0].username === 'sam' && r.rows[0].nickname === 'Sam', JSON.stringify(r.rows));
  ok('...and the link is stored', (await su("select auth_user_id from users where username = 'sam'")).rows[0].auth_user_id === B);
  await as(UNINV);
  r = await tryq('select * from my_competitor()');
  ok('an unregistered email gets nothing', r.ok && r.rows.length === 0);
  await as(WAIT);
  r = await tryq('select * from my_competitor()');
  ok('an UNCONFIRMED email is not linked, even if invited', r.ok && r.rows.length === 0);

  // ---- invited person completes their own profile
  await as(INV);
  r = await tryq('select * from my_competitor()');
  ok('an invited person is linked to their placeholder row, with no name yet', r.ok && r.rows.length === 1 && r.rows[0].nickname === null && /^player\d+$/.test(r.rows[0].username), JSON.stringify(r.rows));
  r = await tryq("select complete_my_profile('<img src=x onerror=alert(1)>')");
  ok('markup in a display name is refused', !r.ok && /cannot contain/.test(r.err), r.err);
  r = await tryq("select complete_my_profile('sam')");
  ok('a name already in use is refused', !r.ok && /already taken/.test(r.err), r.err);
  r = await tryq("select complete_my_profile('   ')");
  ok('an empty name is refused', !r.ok && /required/.test(r.err), r.err);
  r = await tryq("select complete_my_profile('Nic', 'England,France,Wales')");
  ok('more than two teams is refused', !r.ok && /up to 2/.test(r.err), r.err);
  r = await tryq("select complete_my_profile('Nic', 'Narnia')");
  ok('an unknown team is refused', !r.ok && /Unknown team/.test(r.err), r.err);
  r = await tryq("select complete_my_profile('Nic', 'Wales,France') as username");
  ok('they complete it: the username becomes a tidy version of their name', r.ok && r.rows[0].username === 'nic', r.err || JSON.stringify(r.rows));
  const nic = (await su("select nickname, supported_teams, email, auth_user_id from users where username = 'nic'")).rows[0];
  ok('...with their name, teams and email on the same row, linked to their account', nic && nic.nickname === 'Nic' && nic.supported_teams === 'Wales,France' && nic.email === 'nic.jones@x.com' && nic.auth_user_id === INV, JSON.stringify(nic));
  await as(INV);
  r = await tryq("select complete_my_profile('Second')");
  ok('...and it cannot be done twice', !r.ok && /already set up/.test(r.err), r.err);
  r = await tryq('select is_admin() as a');
  ok('...they are not an admin', r.ok && r.rows[0].a === false);
  r = await tryq("update users set nickname = 'Nicky' where username = 'nic'");
  ok('...and can edit their own display name afterwards as before', r.ok, r.err);

  // ---- who cannot complete a profile
  await as(UNINV);
  r = await tryq("select complete_my_profile('Nobody')");
  ok('an email nobody invited cannot create a profile', !r.ok && /not been invited/.test(r.err), r.err);
  await as(WAIT);
  r = await tryq("select complete_my_profile('Waiter')");
  ok('an invited but unconfirmed email cannot either', !r.ok && /not been invited/.test(r.err), r.err);
  await as(B);
  r = await tryq("select complete_my_profile('Samuel')");
  ok('an existing competitor cannot overwrite their profile this way', !r.ok && /already set up/.test(r.err), r.err);
  await as(null, 'anon');
  r = await tryq("select complete_my_profile('Anon')");
  ok('a guest cannot', !r.ok, r.err);

  // ---- usernames from names never collide or hit reserved ones
  await su(`insert into auth.users (id, email, email_confirmed_at) values ('${NEW}', 'new@x.com', now())`);
  await as(A);
  await tryq("select admin_invite_email('new@x.com')");
  await as(NEW);
  r = await tryq("select complete_my_profile('Ghost') as username");
  ok('a username that is on the admin list (even a stale entry) is skipped', r.ok && r.rows[0].username === 'ghost2', r.err || JSON.stringify(r.rows));

  // ---- admin: invite
  await as(A);
  r = await tryq("select admin_invite_email(' Fresh@X.com ')");
  ok('an admin can invite an email (trimmed and lowercased)', r.ok, r.err);
  const fresh = (await su("select username, nickname, email from users where lower(email) = 'fresh@x.com'")).rows[0];
  ok('...which creates a placeholder row with a neutral username and no name', fresh && fresh.nickname === null && /^player\d+$/.test(fresh.username), JSON.stringify(fresh));
  await as(A);
  r = await tryq("select admin_invite_email('fresh@x.com')");
  ok('inviting the same email twice is refused', !r.ok && /already been invited/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('sam@x.com')");
  ok('an email that belongs to a competitor cannot be invited', !r.ok && /already belongs/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('lin@x.com')");
  ok('...including one that is only the login email of a linked account', !r.ok && /already belongs/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('nope')");
  ok('an invalid email is refused', !r.ok && /does not look like/.test(r.err), r.err);
  await as(B);
  r = await tryq("select admin_invite_email('x@x.com')");
  ok('a normal player cannot invite', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq('select * from admin_list_competitor_emails()');
  ok('...or list emails', !r.ok && /Admins only/.test(r.err), r.err);
  await as(A);
  r = await tryq('select * from admin_list_competitor_emails()');
  ok('an admin can list the registered emails', r.ok && r.rows.some(x => x.username === 'sam' && x.email === 'sam@x.com' && x.linked === true) && r.rows.some(x => x.email === 'fresh@x.com' && x.linked === false), JSON.stringify(r.rows.length));

  // ---- admin: edit emails
  await su(`insert into auth.users (id, email, email_confirmed_at) values ('${U('f1')}', 'sam.new@x.com', now())`);
  await as(A);
  r = await tryq("select admin_set_competitor_email('ben', 'typo@x.com')");
  ok('an admin cannot change their own email', !r.ok && /lock yourself out/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('ben', '')");
  ok('...or clear it', !r.ok && /lock yourself out/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('ben', 'BEN@x.com')");
  ok('...but re-saving the one they sign in with is fine', r.ok, r.err);
  r = await tryq("select admin_set_competitor_email('tim', 'lin@x.com')");
  ok('an email on another competitor\'s account is refused', !r.ok && /already registered/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('tim', 'sam@x.com')");
  ok('an email registered to another competitor is refused', !r.ok && /already registered/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('tim', 'tim@x.com')");
  ok('an admin can give a competitor with no email one', r.ok, r.err);
  r = await tryq("select admin_set_competitor_email('sam', 'sam.new@x.com')");
  ok('an admin can change a signed-up competitor\'s email', r.ok, r.err);
  ok('...which releases their old account', (await su("select auth_user_id from users where username = 'sam'")).rows[0].auth_user_id === null);
  await as(null, 'anon');
  r = await tryq("select check_login_email('sam@x.com') o, check_login_email('sam.new@x.com') n");
  ok('...so the old email stops working and the new one works', r.ok && r.rows[0].o === false && r.rows[0].n === true, JSON.stringify(r.rows));
  await as(B);
  r = await tryq('select * from my_competitor()');
  ok('...the old account no longer reaches the competitor', r.ok && r.rows.length === 0);
  await as(U('f1'));
  r = await tryq('select * from my_competitor()');
  ok('...signing in with the new email links automatically', r.ok && r.rows.length === 1 && r.rows[0].username === 'sam');
  await as(A);
  r = await tryq("select admin_set_competitor_email('lin', '')");
  ok('an admin can clear a competitor\'s email, removing access', r.ok && (await su("select auth_user_id, email from users where username = 'lin'")).rows[0].auth_user_id === null, r.err);
  await as(A);
  const waitName = (await su("select username from users where email = 'wait@x.com'")).rows[0].username;
  r = await tryq(`select admin_set_competitor_email('${waitName}', 'wait2@x.com')`);
  ok('an admin can correct the email of a pending invitation', r.ok && (await su("select email from users where username = '" + waitName + "'")).rows[0].email === 'wait2@x.com', r.err);

  // ---- removing an invitation = deleting the row
  r = await tryq(`delete from users where username = '${waitName}'`);
  ok('an admin removes an invitation by deleting its row', r.ok, r.err);
  await as(null, 'anon');
  r = await tryq("select check_login_email('wait2@x.com') as ok");
  ok('...and that email is no longer recognised', r.ok && r.rows[0].ok === false);

  // ---- hook, grants, safety nets
  r = await su(`select public.hook_before_user_created('{"user": {"email": "FRESH@x.com"}}'::jsonb) as a, public.hook_before_user_created('{"user": {"email": "nobody@x.com"}}'::jsonb) as b`);
  ok('hook: an invited email may create an account, an unknown one may not', JSON.stringify(r.rows[0].a) === '{}' && r.rows[0].b.error && r.rows[0].b.error.http_code === 403, JSON.stringify(r.rows[0]));
  r = await su(`select has_function_privilege('anon','public.complete_my_profile(text,text)','execute') a, has_function_privilege('anon','public.admin_invite_email(text)','execute') b, has_function_privilege('anon','public.admin_set_competitor_email(text,text)','execute') c, has_function_privilege('anon','public.admin_list_competitor_emails()','execute') d, has_function_privilege('authenticated','public.complete_my_profile(text,text)','execute') e, has_function_privilege('anon','public.check_login_email(text)','execute') f, has_function_privilege('anon','public._next_player_username()','execute') g, has_function_privilege('authenticated','public._next_player_username()','execute') h`);
  ok('guests cannot run admin or profile functions; the public check and nothing else is open', r.rows[0].a === false && r.rows[0].b === false && r.rows[0].c === false && r.rows[0].d === false && r.rows[0].e === true && r.rows[0].f === true && r.rows[0].g === false && r.rows[0].h === false, JSON.stringify(r.rows[0]));
  r = await su("select count(*)::int as n from users where nickname is null and lower(email) = 'fresh@x.com'");
  ok('placeholder rows pass the display-name constraint (null is allowed)', r.rows[0].n === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
