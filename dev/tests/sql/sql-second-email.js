const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const repo = require('path').resolve(__dirname, '../../..');
const appSrc = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const gen = new Function(appSrc.slice(appSrc.indexOf('function generateSchemaSQL()'), appSrc.indexOf('function generateDataSQL()')) + '; return generateSchemaSQL;')();
const mig = f => fs.readFileSync(repo + '/supabase/' + f, 'utf8');
const mig_profile = () => mig('profile_second_email_migration.sql');
const U = n => '00000000-0000-0000-0000-0000000000' + n;
const A = U('a0'), A2 = U('a1'), B = U('b0'), C = U('c0');
let fail = 0;
const ok = (n, c, x = '') => { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  -> ' + x)); };
(async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
    grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;`);
  await db.exec(gen());
  for (const f of ['auth_migration.sql','years_migration.sql','preregistered_emails_migration.sql','registered_logins_migration.sql','invitations_migration.sql','users_email_migration.sql']) await db.exec(mig(f));
  await db.exec(`insert into auth.users (id,email,email_confirmed_at) values ('${A}','ben@x.com',now()),('${A2}','ben2@x.com',now()),('${B}','sam@x.com',now()),('${C}','cat@x.com',now());
    insert into users (username,nickname,auth_user_id,email) values ('ben','Ben','${A}','ben@x.com');
    insert into users (username,nickname,email) values ('sam','Sam','sam@x.com');
    insert into admin_usernames (username) values ('ben');`);
  await db.exec(mig('second_email_migration.sql'));
  await db.exec(mig('second_email_migration.sql'));
  ok('migration runs twice', true);
  const as = async (uid, role='authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']); await db.exec(`set role ${role}`); };
  const q = async (sql, p) => { try { return { ok: true, rows: (await db.query(sql, p)).rows }; } catch (e) { return { ok: false, err: String(e.message) }; } };
  const su = async (sql) => { await db.exec('reset role'); return db.query(sql); };

  let r = await su(`select has_column_privilege('anon','public.users','email2','select') a, has_column_privilege('authenticated','public.users','email2','select') b, has_column_privilege('authenticated','public.users','email2','update') c, has_column_privilege('authenticated','public.users','auth_user_id2','select') d, has_column_privilege('authenticated','public.users','auth_user_id2','update') e, has_column_privilege('anon','public.users','auth_user_id2','select') f`);
  ok('email2 and auth_user_id2 hidden from clients', Object.values(r.rows[0]).every(v => v === false), JSON.stringify(r.rows[0]));

  await as(A);
  r = await q("select admin_set_competitor_email('sam','sam2@x.com',2)");
  ok('admin sets second email', r.ok, r.err);
  r = await q("select admin_set_competitor_email('ben','ben2@x.com',2)");
  ok('admin can add a second email to self', r.ok, r.err);
  r = await q("select admin_set_competitor_email('sam','sam2@x.com',1)");
  ok('same email cannot be both slots', !r.ok, '');
  r = await q("select admin_set_competitor_email('sam','ben2@x.com',2)");
  ok('email used by another competitor refused', !r.ok, '');
  r = await q("select * from admin_list_competitor_emails() order by username");
  ok('list returns both emails', r.ok && r.rows.find(x=>x.username==='sam').email2==='sam2@x.com' && r.rows.find(x=>x.username==='ben').email2==='ben2@x.com', JSON.stringify(r.rows));

  await as(null,'anon');
  r = await q("select check_login_email('SAM2@x.com') a, check_login_email('sam@x.com') b, check_login_email('zzz@x.com') c");
  ok('either email is recognised as registered', r.rows[0].a && r.rows[0].b && !r.rows[0].c, JSON.stringify(r.rows));

  // second account signs in -> links as slot 2 of ben, and acts as ben
  await as(A2);
  r = await q("select * from my_competitor()");
  ok('second account auto-links to same competitor', r.ok && r.rows[0] && r.rows[0].username==='ben', JSON.stringify(r));
  r = await q("select current_competitor_id() = (select id from users where username='ben') x, is_admin() a");
  await as(A2); r = await q("select current_competitor_id() = (select id from users where username='ben') x, is_admin() a");
  ok('second account has the competitor identity and admin', r.rows[0].x && r.rows[0].a, JSON.stringify(r));
  r = await su("select count(*) n from users where auth_user_id is not null or auth_user_id2 is not null");
  ok('both accounts linked on one row', r.rows[0].n == 1);

  // both accounts of ben visible in accounts list
  await as(A);
  r = await q("select * from admin_list_accounts()");
  ok('accounts list shows both linked to ben', r.ok && r.rows.filter(x=>x.linked_username==='ben').length===2, JSON.stringify(r.rows));
  r = await q("select admin_unlink_account('"+A+"')");
  ok('admin cannot unlink own account', !r.ok, '');
  r = await q("select admin_unlink_account('"+A2+"')");
  ok('admin can unlink the other account', r.ok, r.err);
  await as(A2);
  r = await q("select * from my_competitor()");
  ok('unlinked account relinks by email on next sign-in (email still registered)', r.ok && r.rows[0] && r.rows[0].username==='ben');

  // third account cannot get in
  await as(C);
  r = await q("select * from my_competitor()");
  ok('unregistered account gets nothing', r.ok && r.rows.length===0);

  // clearing slot 2 releases only that account
  await as(A);
  r = await q("select admin_set_competitor_email('ben','',2)");
  ok('clearing second email works', r.ok, r.err);
  r = await su("select email, email2, auth_user_id, auth_user_id2 from users where username='ben'");
  ok('slot 1 intact, slot 2 cleared', r.rows[0].email==='ben@x.com' && r.rows[0].email2===null && r.rows[0].auth_user_id===A && r.rows[0].auth_user_id2===null, JSON.stringify(r.rows));

  // invite checks both columns
  await su("update users set email2='held@x.com' where username='sam'");
  await as(A);
  r = await q("select admin_invite_email('held@x.com')");
  ok('invite refused for an email held in slot 2', !r.ok, '');
  // clients can't write
  await as(B);
  r = await q("update users set email2='q@x.com' where username='sam'");
  ok('client cannot write email2', !r.ok, '');
  // ---- a new competitor adds their own second email at sign-up
  await db.exec('reset role'); await db.exec(mig_profile());
  await su(`insert into auth.users (id,email,email_confirmed_at) values ('${U('d0')}','newbie@x.com',now()),('${U('d1')}','stranger@x.com',now())`);
  await su(`insert into users (username,email) values ('player9','newbie@x.com')`);
  await as(U('d0')); await q('select * from my_competitor()'); await q("select complete_my_profile('Newbie')");
  r = await q("select add_my_second_email('NOTANEMAIL')"); ok('second email must look like an email', !r.ok);
  r = await q("select add_my_second_email('newbie@x.com')"); ok('cannot repeat own email', !r.ok);
  r = await q("select add_my_second_email('sam@x.com')"); ok('cannot take another competitor email', !r.ok);
  r = await q("select add_my_second_email('held@x.com')"); ok('cannot take another competitor second email', !r.ok);
  r = await q("select add_my_second_email('mate@x.com')"); ok('adds a second email', r.ok, r.err);
  r = await q("select add_my_second_email('other@x.com')"); ok('only once (admin changes it later)', !r.ok);
  await as(null, 'anon'); r = await q("select add_my_second_email('z@x.com')"); ok('guests cannot call it', !r.ok);
  await as(U('d1')); r = await q("select add_my_second_email('z@x.com')"); ok('an account with no competitor cannot call it', !r.ok);
  await as(null, 'anon'); r = await q("select check_login_email('mate@x.com') a"); ok('the new email can sign in', r.rows[0].a);
  console.log(fail ? fail + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
