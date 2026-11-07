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
  await db.exec(mig('fixture_chat_migration.sql'));
  ok('migration runs twice', true);
  await db.exec(`insert into auth.users (id,email,email_confirmed_at) values ('${A}','ben@x.com',now()),('${B}','sam@x.com',now()),('${G}','nobody@x.com',now());
    insert into matches (id,year,round,team1,team2) values (1,2026,1,'France','Ireland');
    insert into users (username,nickname,auth_user_id,email) values ('ben','Ben','${A}','ben@x.com'),('sam','Sam','${B}','sam@x.com');
    insert into admin_usernames (username) values ('ben');`);
  const as = async (uid, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']); await db.exec(`set role ${role}`); };
  const q = async (sql) => { try { return { ok: true, rows: (await db.query(sql)).rows }; } catch (e) { return { ok: false, err: String(e.message) }; } };
  const su = async (sql) => { await db.exec('reset role'); return db.query(sql); };
  const id = async u => (await su(`select id from users where username='${u}'`)).rows[0].id;
  const ben = await id('ben'), sam = await id('sam');

  await as(B);
  let r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'Great game')`); ok('a competitor posts a match comment', r.ok, r.err);
  r = await q(`insert into fixture_comments (match_id,user_id,target_user_id,body) values (1,${sam},${ben},'Bold pick Ben')`); ok('...and a comment on someone prediction', r.ok, r.err);
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${ben},'I am Ben')`); ok('cannot post as someone else', !r.ok, '');
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'   ')`); ok('blank comment refused', !r.ok);
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'${'x'.repeat(141)}')`); ok('141 characters refused', !r.ok);
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'${'x'.repeat(140)}')`); ok('140 characters allowed', r.ok, r.err);
  r = await q(`insert into fixture_reactions (match_id,user_id,emoji) values (1,${sam},'🔥')`); ok('a reaction is added', r.ok, r.err);
  r = await q(`insert into fixture_reactions (match_id,user_id,emoji) values (1,${sam},'🔥')`); ok('the same reaction twice is refused', !r.ok);
  r = await q(`insert into fixture_reactions (match_id,user_id,target_user_id,emoji) values (1,${sam},${ben},'🔥')`); ok('same emoji on a prediction is separate', r.ok, r.err);
  r = await q(`insert into fixture_reactions (match_id,user_id,target_user_id,emoji) values (1,${sam},${ben},'🔥')`); ok('...but not twice', !r.ok);
  r = await q(`insert into fixture_reactions (match_id,user_id,emoji) values (1,${sam},'💩')`); ok('only the six emoji are allowed', !r.ok);
  r = await q(`insert into fixture_reactions (match_id,user_id,emoji) values (1,${ben},'👏')`); ok('cannot react as someone else', !r.ok);
  r = await q(`update fixture_comments set body='changed' where user_id=${sam}`); ok('comments cannot be edited', !r.ok);

  await as(null, 'anon');
  r = await q('select count(*) n from fixture_comments'); ok('guests can read comments', r.ok && r.rows[0].n >= 3, r.err);
  r = await q('select count(*) n from fixture_reactions'); ok('guests can read reactions', r.ok && r.rows[0].n >= 2, r.err);
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'hi')`); ok('guests cannot post', !r.ok);
  r = await q(`insert into fixture_reactions (match_id,user_id,emoji) values (1,${sam},'👏')`); ok('guests cannot react', !r.ok);
  r = await q(`delete from fixture_comments`); ok('guests cannot delete', !r.ok);

  await as(G);
  r = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${sam},'hi')`); ok('an account with no competitor cannot post', !r.ok);

  await as(A);  // ben is an admin
  const own = await q(`insert into fixture_comments (match_id,user_id,body) values (1,${ben},'Ben here')`); ok('another competitor posts', own.ok, own.err);
  await as(B);
  r = await q(`delete from fixture_comments where user_id=${ben} returning id`); ok('cannot delete someone else comment', r.ok && r.rows.length === 0, JSON.stringify(r));
  r = await q(`delete from fixture_comments where body='Great game' returning id`); ok('can delete their own', r.ok && r.rows.length === 1);
  r = await q(`delete from fixture_reactions where user_id=${sam} and target_user_id is null returning id`); ok('can remove their own reaction', r.ok && r.rows.length === 1);
  await as(A);
  r = await q(`delete from fixture_comments where user_id=${sam} returning id`); ok('an admin deletes any comment', r.ok && r.rows.length >= 2, JSON.stringify(r));
  r = await q(`delete from fixture_reactions where user_id=${sam} returning id`); ok('an admin removes any reaction', r.ok && r.rows.length >= 1);

  await su(`insert into fixture_comments (match_id,user_id,target_user_id,body) values (1,${ben},${sam},'about sam')`);
  await su(`delete from users where username='sam'`);
  r = await su('select count(*) n from fixture_comments where target_user_id is not null'); ok('deleting a competitor removes chat about their prediction', r.rows[0].n == 0);
  await su(`delete from matches where id=1`);
  r = await su('select count(*) n from fixture_comments'); ok('deleting a fixture removes its chat', r.rows[0].n == 0);
  console.log(fail ? fail + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
