const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const repo = require('path').resolve(__dirname, '../../..');

// pull the app's own schema generator out of app.js
const appSrc = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const start = appSrc.indexOf('function generateSchemaSQL()');
const end = appSrc.indexOf('function generateDataSQL()');
let fnSrc = appSrc.slice(start, end);
const generateSchemaSQL = new Function(fnSrc + '; return generateSchemaSQL;')();

const A = '00000000-0000-0000-0000-00000000000a'; // ben, admin
const B = '00000000-0000-0000-0000-00000000000b'; // sam, normal player
const C = '00000000-0000-0000-0000-00000000000c'; // stranger, not registered
const D = '00000000-0000-0000-0000-00000000000d'; // tim, email unconfirmed
const H = '00000000-0000-0000-0000-00000000000e'; // duplicate of ben's email

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); };

(async () => {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
    grant usage on schema public to anon, authenticated;
    grant usage on schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);
  await db.exec(generateSchemaSQL());
  for (const f of ['auth_migration.sql', 'years_migration.sql', 'preregistered_emails_migration.sql', 'registered_logins_migration.sql', 'invitations_migration.sql']) {
    await db.exec(fs.readFileSync(repo + '/supabase/' + f, 'utf8'));
  }
  // run the latest ones twice to prove idempotency
  await db.exec(fs.readFileSync(repo + '/supabase/preregistered_emails_migration.sql', 'utf8'));
  await db.exec(fs.readFileSync(repo + '/supabase/registered_logins_migration.sql', 'utf8'));
  await db.exec(fs.readFileSync(repo + '/supabase/invitations_migration.sql', 'utf8'));
  ok('all migrations apply, and the new one re-runs cleanly', true);

  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${A}', 'ben@x.com', now()), ('${B}', 'sam@x.com', now()), ('${C}', 'stranger@x.com', now()),
      ('${D}', 'tim@x.com', null), ('${H}', 'ben@x.com', now());
    insert into users (username, nickname, auth_user_id) values ('ben', 'Ben', '${A}');
    insert into users (username, nickname) values ('sam', 'Sam'), ('tim', 'Tim'), ('amy', 'Amy');
    insert into admin_usernames (username) values ('ben'), ('ghost');
  `);

  const as = async (uid, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']); await db.exec(`set role ${role}`); };
  const tryq = async (sql, params) => { try { const r = await db.query(sql, params); return { ok: true, rows: r.rows }; } catch (e) { return { ok: false, err: String(e.message || e) }; } };
  const su = async (sql, params) => { await db.exec('reset role'); return db.query(sql, params); };

  // ---- admin sets emails
  await as(A);
  let r = await tryq("select admin_set_competitor_email('sam', ' Sam@X.com ')");
  ok('admin can register an email (trimmed and lowercased)', r.ok && (await su("select email from competitor_emails ce join users u on u.id=ce.user_id where u.username='sam'")).rows[0].email === 'sam@x.com');
  await as(A);
  r = await tryq("select admin_set_competitor_email('tim', 'sam@x.com')");
  ok('same email cannot be registered to two competitors', !r.ok && /already registered/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('tim', 'not-an-email')");
  ok('invalid email rejected', !r.ok && /does not look like/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('nobody', 'n@x.com')");
  ok('unknown competitor rejected', !r.ok && /not found/.test(r.err), r.err);
  r = await tryq(`select admin_import_competitor_emails('[{"username":"tim","email":"tim@x.com"},{"username":"nobody","email":"n@x.com"},{"username":"amy","email":"sam@x.com"},{"username":"ben","email":"ben@x.com"}]'::jsonb) as report`);
  const report = r.ok ? r.rows[0].report : null;
  ok('bulk import applies good rows and reports bad ones', r.ok && report.applied === 2 && report.skipped.length === 2, JSON.stringify(report));
  r = await tryq('select * from admin_list_competitor_emails()');
  ok('admin can list registered emails', r.ok && r.rows.length === 3, JSON.stringify(r.rows));

  // ---- privacy of the email list
  await as(B);
  r = await tryq('select * from competitor_emails');
  ok('a normal player sees no emails', r.ok && r.rows.length === 0);
  r = await tryq("select admin_set_competitor_email('sam', 'x@x.com')");
  ok('a normal player cannot register emails', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq('select * from admin_list_competitor_emails()');
  ok('a normal player cannot list emails', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq("insert into competitor_emails (user_id, email) values (4, 'evil@x.com')");
  ok('a normal player cannot insert into the email table', !r.ok, r.err);
  await as(null, 'anon');
  r = await tryq('select * from competitor_emails');
  ok('anonymous visitors cannot read the email table', !r.ok, r.err);

  // ---- auto-link
  await as(B);
  r = await tryq('select * from my_competitor()');
  ok('registered email links automatically on first sign-in', r.ok && r.rows.length === 1 && r.rows[0].username === 'sam', JSON.stringify(r.rows));
  ok('...and the link is stored', (await su("select auth_user_id from users where username='sam'")).rows[0].auth_user_id === B);
  await as(B);
  r = await tryq('select * from my_competitor()');
  ok('...and a second sign-in returns the same competitor', r.ok && r.rows.length === 1 && r.rows[0].username === 'sam');
  await as(C);
  r = await tryq('select * from my_competitor()');
  ok('an unregistered email gets no competitor', r.ok && r.rows.length === 0);
  await as(D);
  r = await tryq('select * from my_competitor()');
  ok('an UNCONFIRMED email does not link, even if registered', r.ok && r.rows.length === 0);
  await su("update auth.users set email_confirmed_at = now() where id = '" + D + "'");
  await as(D);
  r = await tryq('select * from my_competitor()');
  ok('...once confirmed it links', r.ok && r.rows.length === 1 && r.rows[0].username === 'tim');
  await as(H);
  r = await tryq('select * from my_competitor()');
  ok('a second account cannot take over an already-linked competitor', r.ok && r.rows.length === 0, JSON.stringify(r.rows));
  await as(null, 'anon');
  r = await tryq('select * from my_competitor()');
  ok('anonymous visitors get nothing from my_competitor', !r.ok || r.rows.length === 0, r.err || '');

  // ---- hardening on the users table
  await as(B);
  r = await tryq(`update users set nickname = '<img src=x onerror=alert(1)>' where username = 'sam'`);
  ok('constraint blocks markup in a display name', !r.ok && /users_nickname_safe/.test(r.err), r.err);
  r = await tryq(`update users set nickname = 'Samuel & Co' where username = 'sam'`);
  ok('ordinary names (even with &) are fine', r.ok, r.err);
  r = await tryq(`update users set username = 'sammy' where username = 'sam'`);
  ok('a player cannot rename their own username', !r.ok && /Only admins/.test(r.err), r.err);
  r = await tryq(`update users set auth_user_id = '${B}' where username = 'amy'`);
  ok('a player cannot link themselves to someone else\'s competitor', !r.ok || r.rows.length === 0 ? (await su("select auth_user_id from users where username='amy'")).rows[0].auth_user_id === null : false, r.err || 'blocked');
  await as(B);
  r = await tryq('select auth_user_id from users');
  ok('auth_user_id is not readable by clients', !r.ok && /permission denied/.test(r.err), r.err);


  // ---- guests are read-only; usage_events only under your own name
  await as(null, 'anon');
  r = await tryq("insert into usage_events (actor, action, payload) values ('guest', 'guest logs in', '')");
  ok('anonymous visitors cannot write usage events', !r.ok, r.err);
  for (const [table, sql] of [['users', "insert into users (username, nickname) values ('x','X')"], ['predictions', 'insert into predictions (user_id, match_id, team1_score, team2_score) values (1,1,1,1)'], ['settings', "insert into settings (key, value) values ('k','v')"], ['matches', "insert into matches (id, year, round, team1, team2) values (99, 2026, 1, 'a', 'b')"], ['admin_usernames', "insert into admin_usernames (username) values ('x')"]]) {
    r = await tryq(sql);
    ok(`anonymous visitors cannot write ${table}`, !r.ok, r.err);
  }
  r = await tryq("update users set nickname = 'pwned'");
  ok('anonymous visitors cannot update users', !r.ok, r.err);
  r = await tryq("delete from predictions");
  ok('anonymous visitors cannot delete predictions', !r.ok, r.err);
  r = await tryq('select username, nickname from users');
  ok('...but guests can still read the leaderboard data', r.ok && r.rows.length >= 4, String(r.rows && r.rows.length));
  r = await tryq('select * from usage_events');
  ok('guests cannot read usage events', !r.ok || r.rows.length === 0);

  await as(B);
  r = await tryq("insert into usage_events (actor, action, payload) values ('sam', 'save predictions', '{}')");
  ok('a signed-in player can log an event under their own name', r.ok, r.err);
  r = await tryq("insert into usage_events (actor, action, payload) values ('ben', 'update settings', '{}')");
  ok('...but cannot forge an event as someone else', !r.ok, r.err);
  r = await tryq("insert into usage_events (actor, action, payload) values ('guest', 'guest logs in', '')");
  ok('...or as guest', !r.ok, r.err);
  r = await tryq('select * from usage_events');
  ok('a normal player cannot read the usage log', r.ok && r.rows.length === 0);
  await as(A);
  r = await tryq("insert into usage_events (actor, action, payload) values ('sam', 'rename user', '{}')");
  ok('an admin can log on behalf of a competitor', r.ok, r.err);
  r = await tryq('select count(*)::int as n from usage_events');
  ok('an admin can read the log', r.ok && r.rows[0].n === 2, JSON.stringify(r.rows));


  // =====================================================================
  // sign-in only for pre-registered emails
  // =====================================================================
  await su("update auth.users set email_confirmed_at = now() where id = '" + D + "'");
  const NEW = '00000000-0000-0000-0000-0000000000f1';
  const LIN = '00000000-0000-0000-0000-0000000000f2';
  await su(`insert into auth.users (id, email, email_confirmed_at) values ('${NEW}', 'sam.new@x.com', now()), ('${LIN}', 'lin@x.com', now())`);
  await su("insert into users (username, nickname, auth_user_id) values ('lin', 'Lin', '" + LIN + "')");

  await as(null, 'anon');
  r = await tryq("select check_login_email(' SAM@X.com ') as ok");
  ok('a guest can ask whether an email is registered (ignoring case and spaces)', r.ok && r.rows[0].ok === true, r.err);
  r = await tryq("select check_login_email('stranger@x.com') as ok");
  ok('an unregistered email is not recognised', r.ok && r.rows[0].ok === false);
  r = await tryq("select check_login_email('') as a, check_login_email(null) as b");
  ok('empty and null are not recognised', r.ok && r.rows[0].a === false && r.rows[0].b === false);
  r = await tryq("select check_login_email('lin@x.com') as ok");
  ok('an account already linked by hand still counts as registered', r.ok && r.rows[0].ok === true);
  r = await tryq("select count(*)::int as n from competitor_emails");
  ok('...but a guest still cannot read the email table itself', !r.ok, r.err);

  await su("insert into admin_usernames (username) values ('sam')");
  await as(null, 'anon');
  r = await tryq('select login_admin_names() as names');
  ok('a guest sees admin display names only (stale entries without a competitor are left out)', r.ok && JSON.stringify(r.rows[0].names) === '["Ben","Samuel & Co"]', JSON.stringify(r.rows && r.rows[0]));
  await su("delete from admin_usernames where username = 'sam'");

  r = await tryq("select to_regprocedure('public.create_my_profile(text,text,text)') is null as gone");
  ok('self-signup (create_my_profile) no longer exists', r.ok && r.rows[0].gone === true);
  r = await tryq("select count(*)::int as n from settings where key = 'allow_self_signup'");
  ok('the allow_self_signup setting is gone', (await su("select count(*)::int as n from settings where key = 'allow_self_signup'")).rows[0].n === 0);

  // the backfill registers accounts that were linked before the registrations existed
  await su("delete from competitor_emails where user_id = (select id from users where username = 'lin')");
  await db.exec(fs.readFileSync(repo + '/supabase/registered_logins_migration.sql', 'utf8'));
  await db.exec(fs.readFileSync(repo + '/supabase/invitations_migration.sql', 'utf8'));  // always in order: later files redefine functions
  r = await su("select email from competitor_emails where user_id = (select id from users where username = 'lin')");
  ok('re-running the migration backfills an already-linked account\'s email', r.rows.length === 1 && r.rows[0].email === 'lin@x.com', JSON.stringify(r.rows));

  // an admin cannot lock themselves out
  await as(A);
  r = await tryq("select admin_set_competitor_email('ben', 'typo@x.com')");
  ok('an admin cannot change their own sign-in email', !r.ok && /lock yourself out/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('ben', '')");
  ok('...or clear it', !r.ok && /lock yourself out/.test(r.err), r.err);
  r = await tryq("select admin_set_competitor_email('ben', 'BEN@x.com')");
  ok('...but re-saving the email they already sign in with is fine', r.ok, r.err);

  // an email already used by another competitor's account cannot be reused
  r = await tryq("select admin_set_competitor_email('amy', 'lin@x.com')");
  ok('an email belonging to another competitor\'s account is refused', !r.ok && /already registered/.test(r.err), r.err);

  // changing a signed-up competitor's email moves their login
  r = await tryq("select admin_set_competitor_email('sam', 'sam.new@x.com')");
  ok('an admin can change a signed-up competitor\'s email', r.ok, r.err);
  ok('...which releases their old account', (await su("select auth_user_id from users where username = 'sam'")).rows[0].auth_user_id === null);
  await as(null, 'anon');
  r = await tryq("select check_login_email('sam@x.com') as old, check_login_email('sam.new@x.com') as new");
  ok('...so the old email stops working and the new one is recognised', r.ok && r.rows[0].old === false && r.rows[0].new === true, JSON.stringify(r.rows));
  await as(B);
  r = await tryq('select * from my_competitor()');
  ok('...the old account no longer reaches the competitor', r.ok && r.rows.length === 0);
  await as(NEW);
  r = await tryq('select * from my_competitor()');
  ok('...and signing in with the new email links automatically', r.ok && r.rows.length === 1 && r.rows[0].username === 'sam', JSON.stringify(r.rows));

  // clearing the email removes access
  await as(A);
  r = await tryq("select admin_set_competitor_email('tim', '')");
  ok('an admin can clear a competitor\'s email', r.ok, r.err);
  await as(null, 'anon');
  r = await tryq("select check_login_email('tim@x.com') as ok");
  ok('...and that email is no longer recognised', r.ok && r.rows[0].ok === false);
  await as(D);
  r = await tryq('select * from my_competitor()');
  ok('...and their account no longer reaches the competitor', r.ok && r.rows.length === 0);

  // the optional before-user-created hook
  r = await su(`select public.hook_before_user_created('{"user": {"email": "SAM.NEW@x.com"}}'::jsonb) as out`);
  ok('hook: allows a registered email (returns {})', JSON.stringify(r.rows[0].out) === '{}', JSON.stringify(r.rows[0].out));
  r = await su(`select public.hook_before_user_created('{"user": {"email": "nobody@x.com"}}'::jsonb) as out`);
  ok('hook: refuses an unregistered email with a 403', r.rows[0].out.error && r.rows[0].out.error.http_code === 403 && /not registered/.test(r.rows[0].out.error.message), JSON.stringify(r.rows[0].out));
  r = await su("select has_function_privilege('anon','public.hook_before_user_created(jsonb)','execute') a, has_function_privilege('authenticated','public.hook_before_user_created(jsonb)','execute') b, has_function_privilege('supabase_auth_admin','public.hook_before_user_created(jsonb)','execute') c");
  ok('hook: only the auth service can run it', r.rows[0].a === false && r.rows[0].b === false && r.rows[0].c === true, JSON.stringify(r.rows[0]));


  // =====================================================================
  // invite by email: admins add just an email, the person fills in their own details
  // =====================================================================
  const INV = '00000000-0000-0000-0000-0000000000a1';   // nic.jones@x.com, invited, confirmed
  const UNINV = '00000000-0000-0000-0000-0000000000a2'; // not invited
  const UNCONF = '00000000-0000-0000-0000-0000000000a3'; // invited but email not confirmed
  const INV2 = '00000000-0000-0000-0000-0000000000a4';  // amy@z.com, whose username 'amy' is taken
  await su(`insert into auth.users (id, email, email_confirmed_at) values
      ('${INV}', 'nic.jones@x.com', now()), ('${UNINV}', 'nobody@x.com', now()), ('${UNCONF}', 'wait@x.com', null), ('${INV2}', 'amy@z.com', now())`);

  await as(A);
  r = await tryq("select admin_invite_email(' Nic.Jones@X.com ')");
  ok('an admin can invite an email (trimmed and lowercased)', r.ok && (await su("select email from invited_emails")).rows[0].email === 'nic.jones@x.com', r.err);
  await as(A);
  r = await tryq("select admin_invite_email('nic.jones@x.com')");
  ok('the same email cannot be invited twice', !r.ok && /already been invited/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('sam.new@x.com')");
  ok('an email that already belongs to a competitor cannot be invited', !r.ok && /already belongs/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('nope')");
  ok('an invalid email is refused', !r.ok && /does not look like/.test(r.err), r.err);
  r = await tryq("select admin_invite_email('wait@x.com'), admin_invite_email('amy@z.com'), admin_invite_email('hook@x.com')");
  ok('more invitations', r.ok, r.err);
  r = await tryq('select * from admin_list_invites()');
  ok('an admin can list pending invitations', r.ok && r.rows.length === 4, JSON.stringify(r.rows.map(x => x.email)));
  r = await tryq("select admin_set_competitor_email('tim', 'hook@x.com')");
  ok('a competitor\'s email cannot be set to one with a pending invitation', !r.ok && /pending invitation/.test(r.err), r.err);

  await as(NEW);  // a normal signed-in player
  r = await tryq("select admin_invite_email('x@x.com')");
  ok('a normal player cannot invite', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq('select * from admin_list_invites()');
  ok('...or list invitations', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq("select admin_remove_invite('nic.jones@x.com')");
  ok('...or remove them', !r.ok && /Admins only/.test(r.err), r.err);
  r = await tryq('select * from invited_emails');
  ok('...and cannot read the invitations table', r.ok && r.rows.length === 0, r.err);
  await as(null, 'anon');
  r = await tryq('select * from invited_emails');
  ok('a guest cannot read the invitations table', !r.ok, r.err);
  r = await tryq("select check_login_email('NIC.JONES@x.com') as ok");
  ok('an invited email is recognised at the login screen', r.ok && r.rows[0].ok === true);

  // first sign-in by an invited person
  await as(INV);
  r = await tryq('select * from my_competitor()');
  ok('an invited person has no competitor yet', r.ok && r.rows.length === 0);
  r = await tryq('select am_i_invited() as ok');
  ok('...and is told they are invited', r.ok && r.rows[0].ok === true, r.err);
  await as(UNINV);
  r = await tryq('select am_i_invited() as ok');
  ok('an email that was not invited is not', r.ok && r.rows[0].ok === false);
  r = await tryq("select create_my_profile('Nobody')");
  ok('...and cannot create a profile', !r.ok && /not been invited/.test(r.err), r.err);
  await as(UNCONF);
  r = await tryq('select am_i_invited() as ok');
  ok('an invited but UNCONFIRMED email does not count yet', r.ok && r.rows[0].ok === false);
  r = await tryq("select create_my_profile('Waiter')");
  ok('...and cannot create a profile', !r.ok && /not been invited/.test(r.err), r.err);
  await as(null, 'anon');
  r = await tryq("select create_my_profile('Anon')");
  ok('a guest cannot create a profile', !r.ok, r.err);

  await as(INV);
  r = await tryq("select create_my_profile('<img src=x onerror=alert(1)>')");
  ok('markup in a display name is refused', !r.ok && /cannot contain/.test(r.err), r.err);
  r = await tryq("select create_my_profile('samuel & co')");
  ok('a display name already in use is refused', !r.ok && /already taken/.test(r.err), r.err);
  r = await tryq("select create_my_profile('Nic', 'England,France,Wales')");
  ok('more than two teams is refused', !r.ok && /up to 2/.test(r.err), r.err);
  r = await tryq("select create_my_profile('Nic', 'Narnia')");
  ok('an unknown team is refused', !r.ok && /Unknown team/.test(r.err), r.err);
  r = await tryq("select create_my_profile('   ')");
  ok('an empty display name is refused', !r.ok && /required/.test(r.err), r.err);
  r = await tryq("select create_my_profile('Nic', 'Wales,France') as username");
  ok('an invited person creates their own profile; the username comes from their email', r.ok && r.rows[0].username === 'nicjones', r.err || JSON.stringify(r.rows));
  const created = (await su("select nickname, supported_teams, auth_user_id from users where username = 'nicjones'")).rows[0];
  ok('...it is linked to their account with their details', created && created.nickname === 'Nic' && created.supported_teams === 'Wales,France' && created.auth_user_id === INV, JSON.stringify(created));
  ok('...their email is now registered on the competitor', (await su("select ce.email from competitor_emails ce join users u on u.id = ce.user_id where u.username = 'nicjones'")).rows[0].email === 'nic.jones@x.com');
  ok('...and the invitation is used up', (await su("select count(*)::int as n from invited_emails where email = 'nic.jones@x.com'")).rows[0].n === 0);
  await as(INV);
  r = await tryq('select * from my_competitor()');
  ok('...so signing in again finds them', r.ok && r.rows.length === 1 && r.rows[0].username === 'nicjones');
  r = await tryq("select create_my_profile('Second')");
  ok('...and they cannot create a second profile', !r.ok && /already has a competitor/.test(r.err), r.err);
  r = await tryq('select is_admin() as a');
  ok('...they are not an admin', r.ok && r.rows[0].a === false);
  await as(null, 'anon');
  r = await tryq("select check_login_email('nic.jones@x.com') as ok");
  ok('their email still works at the login screen', r.ok && r.rows[0].ok === true);

  // a username that is already taken gets a number
  await as(INV2);
  r = await tryq("select create_my_profile('Amy Z') as username");
  ok('a taken username gets a number', r.ok && r.rows[0].username === 'amy2', r.err || JSON.stringify(r.rows));

  // removing an invitation
  await as(A);
  r = await tryq("select admin_remove_invite('WAIT@x.com')");
  ok('an admin can remove an invitation', r.ok, r.err);
  await as(null, 'anon');
  r = await tryq("select check_login_email('wait@x.com') as ok");
  ok('...and that email is no longer recognised', r.ok && r.rows[0].ok === false);

  // the hook still lets invited emails through
  r = await su(`select public.hook_before_user_created('{"user": {"email": "hook@x.com"}}'::jsonb) as out`);
  ok('hook: an invited email may create an account', JSON.stringify(r.rows[0].out) === '{}', JSON.stringify(r.rows[0].out));

  // who may run what
  r = await su(`select
      has_function_privilege('anon', 'public.create_my_profile(text,text)', 'execute') a,
      has_function_privilege('anon', 'public.am_i_invited()', 'execute') b,
      has_function_privilege('anon', 'public.admin_invite_email(text)', 'execute') c,
      has_function_privilege('anon', 'public.admin_list_invites()', 'execute') d,
      has_function_privilege('authenticated', 'public.create_my_profile(text,text)', 'execute') e,
      to_regprocedure('public.create_my_profile(text,text,text)') is null as old_gone`);
  ok('guests cannot run the invite or profile functions; the old open version is gone', r.rows[0].a === false && r.rows[0].b === false && r.rows[0].c === false && r.rows[0].d === false && r.rows[0].e === true && r.rows[0].old_gone === true, JSON.stringify(r.rows[0]));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
