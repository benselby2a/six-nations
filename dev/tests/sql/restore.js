// Backup -> restore round trip: seed a database, generate the app's backup SQL, restore into an empty database,
// run the migrations in the documented order, run the email lines, compare.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs'), pathm = require('path');
const repo = pathm.resolve(__dirname, '../../..');
const src = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const body = src.slice(src.indexOf('function generateSchemaSQL()'), src.indexOf('function generateFullSQL('));
const mig = f => fs.readFileSync(repo + '/supabase/' + f, 'utf8');
const ORDER = ['auth_migration','years_migration','preregistered_emails_migration','registered_logins_migration','invitations_migration','users_email_migration','second_email_migration','profile_second_email_migration'].map(x => x + '.sql');
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' -> ' + x)); };
const boot = async () => { const db = new PGlite(); await db.exec(`create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
  grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;`); return db; };
(async () => {
  const gen = new Function('supabaseClient', body + '; return { generateSchemaSQL, generateDataSQL, fetchRecoverySnapshot, setSnap: s => { recoverySnapshot = s; } };');
  // --- source database (the live shape)
  const A = '00000000-0000-0000-0000-0000000000a0';
  const db1 = await boot();
  const tmp = gen(null); await db1.exec(tmp.generateSchemaSQL());
  for (const f of ORDER) await db1.exec(mig(f));
  await db1.exec(`insert into auth.users (id,email,email_confirmed_at) values ('${A}','ben@x.com',now());
    insert into seasons (year) values (2026) on conflict do nothing;
    insert into matches (id,year,round,team1,team2) values (1,2026,1,'France','Ireland');
    insert into users (username,nickname,auth_user_id,email,email2) values ('ben','Ben','${A}','ben@x.com','ben2@x.com');
    insert into users (username,nickname,email) values ('sam',null,'sam@x.com');
    insert into predictions (user_id,match_id,team1_score,team2_score) select id,1,20,10 from users where username='ben';
    insert into admin_usernames (username) values ('ben');`);
  // the app reads tables as the client, and the emails through the admin RPC; emulate with superuser reads
  const rows = async t => (await db1.query(`select * from ${t}`)).rows;
  const snap = {}; for (const t of ['seasons','matches','users','user_tries','predictions','admin_usernames','settings','scoring_rules','scoring_close_tiers','user_joker_selections']) snap[t] = await rows(t);
  snap.sign_in_emails = (await db1.query(`select username, email, email2 from users where email is not null or email2 is not null`)).rows;
  const g1 = gen(null); g1.setSnap(snap);
  const backup = g1.generateSchemaSQL() + '\n' + g1.generateDataSQL();
  ok('backup contains the email restore lines', /UPDATE users SET email = 'ben@x.com', email2 = 'ben2@x.com' WHERE username = 'ben'/.test(backup) && /WHERE username = 'sam'/.test(backup));
  // restore: schema + data first, then migrations in order, then the email lines
  const db2 = await boot();
  const [first, emailPart] = [backup.slice(0, backup.indexOf('-- ====')), backup.slice(backup.indexOf('-- ===='))];
  const dataPart = first, tail = emailPart;
  await db2.exec(dataPart);
  for (const f of ORDER) await db2.exec(mig(f));
  await db2.exec(tail);
  const u = (await db2.query(`select username, nickname, email, email2 from users order by username`)).rows;
  ok('competitors and emails restored (including the invitation)', u.length === 2 && u[0].email === 'ben@x.com' && u[0].email2 === 'ben2@x.com' && u[1].username === 'sam' && u[1].email === 'sam@x.com' && u[1].nickname === null, JSON.stringify(u));
  const p = (await db2.query(`select team1_score from predictions`)).rows;
  ok('predictions restored', p.length === 1 && p[0].team1_score === 20);
  await db2.exec(`insert into auth.users (id,email,email_confirmed_at) values ('${A}','ben@x.com',now())`);
  await db2.exec(`reset role`); await db2.query("select set_config('request.jwt.claim.sub',$1,false)", [A]); await db2.exec('set role authenticated');
  const r = (await db2.query(`select * from my_competitor()`)).rows;
  ok('the account re-links by email on first sign-in', r.length === 1 && r[0].username === 'ben', JSON.stringify(r));
  console.log(fail ? fail + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
