const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const repo = require('path').resolve(__dirname, '../../..');
const appSrc = fs.readFileSync(repo + '/js/recovery-usage.js', 'utf8');
const generateSchemaSQL = new Function(appSrc.slice(appSrc.indexOf('function generateSchemaSQL()'), appSrc.indexOf('function generateDataSQL()')) + '; return generateSchemaSQL;')();
const verifySql = fs.readFileSync(repo + '/supabase/verify_security.sql', 'utf8');
const base = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
  grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;`;
const run = async (label, migrations, extra = '') => {
  const db = new PGlite();
  await db.exec(base); await db.exec(generateSchemaSQL());
  for (const f of migrations) await db.exec(fs.readFileSync(repo + '/supabase/' + f, 'utf8'));
  if (extra) await db.exec(extra);
  const r = await db.query(verifySql);
  console.log('\n=== ' + label);
  r.rows.forEach(x => console.log((String(x.result).startsWith('FAIL') ? 'FAIL ' : x.check.startsWith('info') ? 'info ' : 'ok   ') + x.check + (String(x.result) === 'ok' ? '' : '  ->  ' + x.result)));
  return r.rows;
};
(async () => {
  // 1. what a fully migrated database should say
  const good = await run('after all six migrations', ['auth_migration.sql', 'years_migration.sql', 'preregistered_emails_migration.sql', 'registered_logins_migration.sql', 'invitations_migration.sql', 'users_email_migration.sql', 'second_email_migration.sql', 'profile_second_email_migration.sql', 'fixture_chat_migration.sql']);
  console.log('all ok / info:', good.every(x => x.result === 'ok' || x.check.startsWith('info')));
  // 2. the same database before the latest migration
  const mid = await run('before the four newest migrations', ['auth_migration.sql', 'years_migration.sql']);
  console.log('flags the missing migration:', mid.some(x => String(x.result).startsWith('FAIL')));
  // 3. the checker catches real problems
  const bad = await run('migrated, but with a stale admin, a hostile name, and an allow-all policy', ['auth_migration.sql', 'years_migration.sql', 'preregistered_emails_migration.sql', 'registered_logins_migration.sql', 'invitations_migration.sql', 'users_email_migration.sql', 'second_email_migration.sql', 'profile_second_email_migration.sql', 'fixture_chat_migration.sql'],
    `insert into admin_usernames (username) values ('ghost');
     alter table users drop constraint users_nickname_safe;
     insert into users (username, nickname) values ('evil', 'a<b>c');
     create policy sloppy on settings for insert to authenticated with check (true);`);
  console.log('catches stale admin / hostile name / allow-all:', ['stale admin'.length && bad.find(x => x.check.startsWith('No admin entries')).result.startsWith('FAIL'), bad.find(x => x.check.startsWith('No existing display names')).result.startsWith('FAIL'), bad.find(x => x.check.startsWith('No write policy')).result.startsWith('FAIL')].join(' '));
  // an older migration re-run afterwards is now refused outright (the tables it needs no longer exist)
  const refused = await (async () => {
    const { PGlite: P } = require('@electric-sql/pglite');
    const db = new P();
    await db.exec(base); await db.exec(generateSchemaSQL());
    for (const f of ['auth_migration.sql', 'years_migration.sql', 'preregistered_emails_migration.sql', 'registered_logins_migration.sql', 'invitations_migration.sql', 'users_email_migration.sql', 'second_email_migration.sql', 'profile_second_email_migration.sql', 'fixture_chat_migration.sql']) await db.exec(fs.readFileSync(repo + '/supabase/' + f, 'utf8'));
    const outcomes = {};
    for (const f of ['registered_logins_migration.sql', 'invitations_migration.sql']) {
      try { await db.exec(fs.readFileSync(repo + '/supabase/' + f, 'utf8')); outcomes[f] = 'ran (downgraded!)'; } catch (e) { outcomes[f] = 'refused: ' + String(e.message).slice(0, 60); }
    }
    return outcomes;
  })();
  console.log('\n=== re-running an older migration afterwards');
  console.log(JSON.stringify(refused));
  console.log('older migrations refused (cannot silently downgrade):', Object.values(refused).every(v => v.startsWith('refused')));
})().catch(e => { console.error('ERR', e); process.exit(1); });
