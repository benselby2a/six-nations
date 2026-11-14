const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const repo = require('path').resolve(__dirname, '../../..');
const appSrc = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const gen = new Function(appSrc.slice(appSrc.indexOf('function generateSchemaSQL()'), appSrc.indexOf('function generateDataSQL()')) + '; return generateSchemaSQL;')();
const mig = f => fs.readFileSync(repo + '/supabase/' + f, 'utf8');
const U = n => '00000000-0000-0000-0000-0000000000' + n;
const A = U('a0'), B = U('b0'), G = U('c0');
let fail = 0; const ok = (n, c, x = '') => { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  -> ' + x)); };
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
  for (const f of ['auth_migration','years_migration','preregistered_emails_migration','registered_logins_migration','invitations_migration','users_email_migration','second_email_migration','profile_second_email_migration','fixture_chat_migration']) await db.exec(mig(f + '.sql'));
  await db.exec(mig('usage_events_trim_migration.sql'));
  await db.exec(mig('usage_events_trim_migration.sql'));   // idempotent
  ok('migration runs twice', true);
  await db.exec(`insert into auth.users (id,email,email_confirmed_at) values ('${A}','ben@x.com',now()),('${B}','sam@x.com',now());
    insert into users (username,nickname,auth_user_id,email) values ('ben','Ben','${A}','ben@x.com'),('sam','Sam','${B}','sam@x.com');
    insert into admin_usernames (username) values ('ben');`);
  const as = async (uid, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']); await db.exec(`set role ${role}`); };
  const q = async (sql) => { try { return { ok: true, rows: (await db.query(sql)).rows }; } catch (e) { return { ok: false, err: String(e.message) }; } };
  const su = async (sql) => { await db.exec('reset role'); return db.query(sql); };

  // a competitor (not an admin) logs 130 events one at a time: only the newest 100 are kept
  await as(B);
  let r;
  for (let i = 1; i <= 130; i++) { r = await q(`insert into usage_events (actor, action, payload) values ('sam', 'event ${i}', '')`); if (!r.ok) break; }
  ok('a competitor can still log events', r.ok, r.err);
  const rows = (await su('select action from usage_events order by id')).rows.map(x => x.action);
  ok('only the newest 100 are kept', rows.length === 100, rows.length);
  ok('the oldest were the ones removed', rows[0] === 'event 31' && rows[99] === 'event 130', rows[0] + ' .. ' + rows[99]);

  // the trim function cannot be called by clients
  r = await q('select public.trim_usage_events()'); ok('clients cannot call the trim function', !r.ok, '');

  // a batch insert still ends at 100
  await as(A);
  r = await q(`insert into usage_events (actor, action, payload) select 'ben', 'batch ' || g, '' from generate_series(1, 40) g`); ok('a batch insert works', r.ok, r.err);
  ok('...and the table is back to 100', Number((await su('select count(*) n from usage_events')).rows[0].n) === 100);

  // running the migration on a table that is already over the limit trims it at once
  await su('alter table usage_events disable trigger usage_events_trim');
  await su(`insert into usage_events (actor, action, payload) select 'sam', 'old ' || g, '' from generate_series(1, 50) g`);
  await su('alter table usage_events enable trigger usage_events_trim');
  await db.exec(mig('usage_events_trim_migration.sql'));
  ok('the migration trims an over-full table', Number((await su('select count(*) n from usage_events')).rows[0].n) === 100);

  console.log(fail ? fail + ' FAILED' : 'ALL PASSED');
  process.exit(fail ? 1 : 0);
})();
