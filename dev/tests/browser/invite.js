const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

const mock = `
(() => {
  const db = {
    seasons: [{year:2026},{year:2027}],
    matches: [
      {id:1,year:2026,round:1,date:'Thu, Feb 5',time:'20:10',team1:'France',team2:'Ireland',actual_score1:30,actual_score2:20,actual_tries1:4,actual_tries2:2,joker_eligible:true},
      {id:2,year:2026,round:1,date:'Sat, Feb 7',time:'14:10',team1:'Italy',team2:'Scotland',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false},
      {id:3,year:2027,round:1,date:'Fri, Feb 5',time:'20:10',team1:'England',team2:'Wales',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true}
    ],
    users: [
      {id:1,username:'ben',nickname:'Ben',supported_teams:null,auth_user_id:'u-ben@example.com'},
      {id:2,username:'sam',nickname:'Sam',supported_teams:null},
      {id:3,username:'newbie',nickname:'Newbie',supported_teams:null},
      {id:4,username:'only27',nickname:'Only27',supported_teams:null},
      {id:6,username:'evil',nickname:'<img src=x onerror="window.__xss=(window.__xss||0)+1">Eve<b id=injected>',supported_teams:null}
    ],
    predictions: [
      {id:1,user_id:1,match_id:1,team1_score:25,team2_score:20},
      {id:2,user_id:1,match_id:2,team1_score:10,team2_score:30},
      {id:3,user_id:2,match_id:1,team1_score:20,team2_score:25},
      {id:4,user_id:4,match_id:3,team1_score:22,team2_score:18}
    ],
    user_tries: [{user_id:1,year:2026,total_tries:10},{user_id:4,year:2027,total_tries:7}],
    user_joker_selections: [{id:1,user_id:1,match_id:1},{id:2,user_id:4,match_id:3}],
    admin_usernames: [{username:'ben'},{username:'sam'}],
    settings: [{key:'predictions_locked:2026',value:'true'}],
    scoring_rules: [{id:1,year:2026,correct_result_points:3,perfect_score_bonus:3,draw_bonus:2,max_jokers_per_user:1,entry_fee_amount:10,payout_first_pct:100,payout_second_pct:0,payout_third_pct:0,payout_closest_tries_pct:0}],
    scoring_close_tiers: [{id:1,year:2026,tier_order:1,within_points:5,bonus_points:1}],
    usage_events: [], competitor_emails: [{user_id: 2, email: 'sam@x.com'}], invited_emails: []
  };
  window.__db = db; window.__log = [];
  const match = (row, f) => f.type==='eq' ? row[f.col]===f.val : f.type==='in' ? f.vals.includes(row[f.col]) : f.type==='neq' ? row[f.col]!==f.val : f.type==='gte' ? row[f.col]>=f.val : f.type==='like' ? String(row[f.col]).startsWith(String(f.val).replace(/%$/,'')) : true;
  const builder = (table) => {
    const st = { op:'select', filters:[], payload:null, single:false, opts:null };
    const run = () => {
      let rows = db[table] || (db[table]=[]);
      const sel = rows.filter(r => st.filters.every(f => match(r,f)));
      window.__log.push({table, op:st.op, filters:st.filters.map(f=>f.type+':'+f.col+'='+JSON.stringify(f.val??f.vals)), payload: st.payload});
      if (st.op==='select') { const out = sel.map(r=>({...r})); return st.single===1 ? {data: out[0]||null, error:null} : st.single===2 ? {data: out[0]||null, error:null} : {data: out, error:null}; }
      if (st.op==='insert') { const arr = [].concat(st.payload); arr.forEach(p=>{ db[table].push({id: db[table].length+100, ...p}); }); return {data:null,error:null}; }
      if (st.op==='upsert') { const arr=[].concat(st.payload); const keys=(st.opts&&st.opts.onConflict||'id').split(','); arr.forEach(p=>{ const ex=db[table].find(r=>keys.every(k=>r[k]===p[k])); if(ex) Object.assign(ex,p); else db[table].push({...p}); }); return {data:null,error:null}; }
      if (st.op==='update') { sel.forEach(r=>Object.assign(r,st.payload)); return {data:null,error:null}; }
      if (st.op==='delete') { db[table] = rows.filter(r => !sel.includes(r)); return {data:null,error:null}; }
    };
    const o = {
      select(){ return o; }, order(){ return o; }, limit(){ return o; },
      eq(col,val){ st.filters.push({type:'eq',col,val}); return o; },
      neq(col,val){ st.filters.push({type:'neq',col,val}); return o; },
      gte(col,val){ st.filters.push({type:'gte',col,val}); return o; },
      in(col,vals){ st.filters.push({type:'in',col,vals}); return o; },
      like(col,val){ st.filters.push({type:'like',col,val}); return o; },
      single(){ st.single=1; return o; }, maybeSingle(){ st.single=2; return o; },
      insert(p){ st.op='insert'; st.payload=p; return o; }, update(p){ st.op='update'; st.payload=p; return o; },
      upsert(p,opts){ st.op='upsert'; st.payload=p; st.opts=opts; return o; }, delete(){ st.op='delete'; return o; },
      then(res, rej){ return Promise.resolve(run()).then(res, rej); }
    };
    return o;
  };
  let session = null;
  window.supabase = { createClient: () => ({
    from: builder,
    rpc: async (name, args = {}) => {
      const u = (n) => db.users.find(x => x.username === n);
      const meEmail = session && session.user.email;
      const isAdmin = () => !!session && db.admin_usernames.some(a => (db.users.find(x => x.auth_user_id === session.user.id) || {}).username === a.username);
      if (name === 'my_competitor') {
        if (!session) return {data: [], error: null};
        let row = db.users.find(x => x.auth_user_id === session.user.id);
        if (!row) { const reg = db.competitor_emails.find(e => e.email === meEmail.toLowerCase()); const cand = reg && db.users.find(x => x.id === reg.user_id && !x.auth_user_id); if (cand) { cand.auth_user_id = session.user.id; row = cand; } }
        return {data: row ? [{username: row.username, nickname: row.nickname}] : [], error: null};
      }
      if (name === 'check_login_email') { if (window.__rpcDown) return {data: null, error: {message: 'boom'}}; const e = String(args.p_email || '').toLowerCase().trim(); const registered = db.competitor_emails.some(x => x.email === e) || db.invited_emails.some(x => x.email === e) || db.users.some(x => x.auth_user_id === 'u-' + e); return {data: window.__forceRegistered ? true : registered, error: null}; }
      if (name === 'login_admin_names') { return {data: db.admin_usernames.map(a => db.users.find(x => x.username === a.username)).filter(Boolean).map(x => x.nickname).sort(), error: null}; }
      if (name === 'admin_invite_email') {
        if (!isAdmin()) return {data: null, error: {message: 'Admins only.'}};
        const e = String(args.p_email || '').toLowerCase().trim();
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)) return {data: null, error: {message: '"' + args.p_email + '" does not look like an email address.'}};
        const existing = db.competitor_emails.find(x => x.email === e);
        if (existing) { const u = db.users.find(x => x.id === existing.user_id); return {data: null, error: {message: e + (u && !u.nickname && !u.auth_user_id ? ' has already been invited.' : ' already belongs to a competitor.')}}; }
        let n = 1; while (db.users.some(x => x.username === 'player' + n)) n++;
        const id = db.users.length + 70;
        db.users.push({id, username: 'player' + n, nickname: null, supported_teams: null, auth_user_id: null});
        db.competitor_emails.push({user_id: id, email: e});
        return {data: null, error: null};
      }
      if (name === 'complete_my_profile') {
        if (!session) return {data: null, error: {message: 'Please sign in first.'}};
        const me = db.users.find(x => x.auth_user_id === session.user.id);
        if (!me) return {data: null, error: {message: 'Your email has not been invited. Ask an admin to add it.'}};
        if (me.nickname) return {data: null, error: {message: 'Your profile is already set up.'}};
        const nick = String(args.p_nickname || '').trim();
        if (!nick) return {data: null, error: {message: 'Display name is required (max 60 characters).'}};
        if (/[<>"]/.test(nick)) return {data: null, error: {message: 'Display name cannot contain < > or " characters.'}};
        if (db.users.some(x => (x.nickname || '').toLowerCase() === nick.toLowerCase())) return {data: null, error: {message: 'This display name is already taken.'}};
        let base = nick.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 26) || 'player', name2 = base, n = 1;
        while (db.users.some(x => x.username === name2 && x.id !== me.id)) { n++; name2 = base + n; }
        me.nickname = nick; me.supported_teams = args.p_supported_teams || null; me.username = name2;
        return {data: name2, error: null};
      }
      if (name === 'admin_list_accounts') return isAdmin() ? {data: [], error: null} : {data: null, error: {message: 'Admins only.'}};
      if (name === 'admin_list_competitor_emails') return isAdmin() ? {data: db.competitor_emails.map(e => ({username: db.users.find(x => x.id === e.user_id).username, email: e.email, linked: !!db.users.find(x => x.id === e.user_id).auth_user_id})), error: null} : {data: null, error: {message: 'Admins only.'}};
      const setEmail = (username, email) => {
        const user = u(String(username || '').toLowerCase().trim()); const e = String(email || '').toLowerCase().trim();
        if (!user) throw new Error('Competitor "' + username + '" not found.');
        if (!e) { db.competitor_emails = db.competitor_emails.filter(x => x.user_id !== user.id); return; }
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)) throw new Error('"' + email + '" does not look like an email address.');
        if (db.competitor_emails.some(x => x.email === e && x.user_id !== user.id)) throw new Error(e + ' is already registered to another competitor.');
        const ex = db.competitor_emails.find(x => x.user_id === user.id); if (ex) ex.email = e; else db.competitor_emails.push({user_id: user.id, email: e});
      };
      if (name === 'admin_set_competitor_email') { if (!isAdmin()) return {data: null, error: {message: 'Admins only.'}}; try { setEmail(args.p_username, args.p_email); return {data: null, error: null}; } catch (e) { return {data: null, error: {message: e.message}}; } }
      if (name === 'admin_import_competitor_emails') { if (!isAdmin()) return {data: null, error: {message: 'Admins only.'}}; let applied = 0; const skipped = []; args.p_rows.forEach((r, i) => { try { setEmail(r.username, r.email); applied++; } catch (e) { skipped.push({row: i + 1, username: r.username, reason: e.message}); } }); return {data: {applied, skipped}, error: null}; }
      return {data: null, error: null};
    },
    auth: {
      onAuthStateChange(cb){ window.__authCb = cb; setTimeout(()=>cb('INITIAL_SESSION', session),0); return {data:{subscription:{}}}; },
      getSession: async()=>({data:{session}}),
      signInWithOtp: async(a)=>{ window.__otp = a; return {error:null}; },
      verifyOtp: async(a)=>{ (window.__verifyCalls = window.__verifyCalls || []).push(a); if (a.token === '123456' && a.type === 'email') { session = {user:{id:'u-' + a.email, email:a.email}}; setTimeout(()=>window.__authCb('SIGNED_IN', session),0); return {data:{session}, error:null}; } return {data:null, error:{message:'Token has expired or is invalid'}}; },
      signOut: async()=>{ session = null; setTimeout(()=>window.__authCb('SIGNED_OUT', null),0); return {error:null}; }
    }
  })};
})();`;








(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { dialogs.push(d.type() + ': ' + d.message().slice(0, 90)); await d.accept(); });
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path);
  await page.waitForTimeout(Math.min(900, 40));
  const signIn = async (email) => { await page.fill('#loginEmail', email); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(400, 40)); const popup = await page.evaluate(() => !document.getElementById('unrecognisedEmailModal').classList.contains('hidden')); if (popup) return 'popup'; await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1200, 40)); return 'code'; };
  const view = () => page.evaluate(() => ({ app: !document.getElementById('appView').classList.contains('hidden'), setup: !document.getElementById('setupView').classList.contains('hidden'), popup: !document.getElementById('unrecognisedEmailModal').classList.contains('hidden'), user: document.getElementById('currentUser').textContent, intro: document.getElementById('setupIntro').textContent, nick: document.getElementById('setupNickname').value }));
  const clickByText = (text) => page.evaluate((t) => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.offsetParent !== null).click(); }, text);
  const cardsText = () => page.evaluate(() => [...document.querySelectorAll('.competitor-card:not(.competitor-card-new)')].map(d => d.querySelector('summary').innerText.replace(/\s+/g, ' ').trim()));

  // 1. admin adds just an email: it becomes a card
  console.log('1 admin sign-in:', await signIn('ben@example.com'), JSON.stringify((await view()).user));
  await page.evaluate(() => { const find = (t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.offsetParent !== null); find('Admin Functions').click(); find('Competitors').click(); });
  await page.waitForTimeout(Math.min(600, 40));
  console.log('   cards at the top:', await page.evaluate(() => [...document.querySelectorAll('.competitor-card-new .cc-name')].map(n => n.textContent)), '| old pending list present:', await page.evaluate(() => !!document.querySelector('.pending-invites')));
  await page.click('#new-competitor-card > summary'); await page.evaluate(() => { window.__emailFree = true; });
  await page.fill('#new-email-admin', 'Nic.Jones@x.com'); await page.click('#new-competitor-card > .cc-fields > .cc-actions button'); await page.waitForTimeout(Math.min(800, 40));
  const invitedRow = await page.evaluate(() => JSON.stringify(__db.users.find(u => !u.nickname && !u.auth_user_id)));
  console.log('2 invited with only an email -> a placeholder row:', invitedRow);
  console.log('   its card shows the email with an "Invited" chip:', (await cardsText()).filter(t => /nic\.jones/i.test(t)));
  console.log('   invite card still open:', await page.evaluate(() => document.getElementById('new-competitor-card').open), '| input cleared:', JSON.stringify(await page.inputValue('#new-email-admin')));
  await page.fill('#new-email-admin', 'nic.jones@x.com'); await page.click('#new-competitor-card > .cc-fields > .cc-actions button'); await page.waitForTimeout(Math.min(500, 40));
  console.log('3 inviting the same email again ->', dialogs[dialogs.length - 1]);
  await page.fill('#new-email-admin', 'not an email'); await page.click('#new-competitor-card > .cc-fields > .cc-actions button'); await page.waitForTimeout(Math.min(300, 40));
  console.log('   invalid email ->', dialogs[dialogs.length - 1]);
  await page.fill('#new-email-admin', 'sam@x.com'); await page.click('#new-competitor-card > .cc-fields > .cc-actions button'); await page.waitForTimeout(Math.min(500, 40));
  console.log('   an email that already belongs to a competitor ->', dialogs[dialogs.length - 1]);

  // 4. an invitation can be corrected (no display name needed) and removed by deleting its card
  await page.fill('#new-email-admin', 'gone@x.com'); await page.click('#new-competitor-card > .cc-fields > .cc-actions button'); await page.waitForTimeout(Math.min(700, 40));
  const goneUser = await page.evaluate(() => __db.users.find(u => !u.nickname && u.id !== undefined && __db.competitor_emails.some(e => e.user_id === u.id && e.email === 'gone@x.com')).username);
  await page.evaluate((u) => { document.getElementById('user-row-' + u).open = true; }, goneUser);
  await page.fill('#edit-email-' + goneUser, 'gone.fixed@x.com'); await page.evaluate((u) => saveUserChanges(u), goneUser); await page.waitForTimeout(Math.min(700, 40));
  console.log('4 fix the email on an invited card (blank display name is fine):', await page.evaluate(() => JSON.stringify(__db.competitor_emails.filter(e => /gone/.test(e.email)).map(e => e.email))), '| last alert:', dialogs[dialogs.length - 1]);
  await page.evaluate((u) => { document.getElementById('user-row-' + u).open = true; }, goneUser);
  await page.evaluate((u) => deleteUser(u), goneUser); await page.waitForTimeout(Math.min(700, 40));
  console.log('   deleting the card removes the invitation:', await page.evaluate(() => !__db.users.some(u => !u.nickname && __db.competitor_emails.some(e => e.user_id === u.id && /gone/.test(e.email)))), '| login check:', await page.evaluate(async () => (await supabase_check('gone.fixed@x.com'))).catch(() => 'n/a'));
  await page.screenshot({ path: 'invite-admin2.png' });
  // pending invitations are not players
  console.log('5 prediction dropdown lists only real players:', await page.evaluate(() => { populateAdminPredictionUserSelect(); return [...document.querySelectorAll('#adminPredictionUserSelect option')].map(o => o.textContent); }));
  await page.evaluate(() => logout()); await page.waitForTimeout(Math.min(400, 40));

  // 6. the invited person signs in for the first time
  console.log('6 invited email at the login screen:', await signIn('nic.jones@x.com'));
  const v = await view();
  console.log('   lands on the setup screen:', JSON.stringify({ setup: v.setup, app: v.app, popup: v.popup, intro: v.intro, nickPrefilled: v.nick }));
  await page.fill('#setupNickname', '<b>Nic</b>'); await clickByText('Join The Game');
  console.log('7 markup in the name ->', await page.textContent('#setupFeedback'));
  await page.fill('#setupNickname', 'ben'); await clickByText('Join The Game');
  console.log('   a name already taken ->', await page.textContent('#setupFeedback'));
  await page.fill('#setupNickname', ''); await clickByText('Join The Game');
  console.log('   empty ->', await page.textContent('#setupFeedback'));
  await page.fill('#setupNickname', 'Nic');
  await page.click('#setupTeamsPicker .team-flag-option:nth-child(5)'); await page.click('#setupTeamsPicker .team-flag-option:nth-child(2)'); await page.click('#setupTeamsPicker .team-flag-option:nth-child(3)');
  await clickByText('Join The Game'); await page.waitForTimeout(Math.min(1200, 40));
  const after = await view();
  console.log('8 profile completed -> in the app as:', JSON.stringify({ app: after.app, setup: after.setup, user: after.user }));
  console.log('   their row:', await page.evaluate(() => JSON.stringify(__db.users.find(u => u.nickname === 'Nic'))));
  await page.evaluate(() => logout()); await page.waitForTimeout(Math.min(400, 40));

  // 9. later sign-ins go straight in; strangers are turned away
  console.log('9 signing in again:', await signIn('nic.jones@x.com'), JSON.stringify({ app: (await view()).app, user: (await view()).user }));
  await page.evaluate(() => logout()); await page.waitForTimeout(Math.min(400, 40));
  console.log('10 an email nobody invited:', await signIn('stranger@x.com'));
  await page.click('#unrecognisedEmailClose');

  // 11. a signed-in account with no row at all
  await page.evaluate(() => { window.__forceRegistered = true; });
  console.log('11 check bypassed:', await signIn('ghost@x.com'), JSON.stringify({ popup: (await view()).popup, app: (await view()).app, setup: (await view()).setup }));
  await page.click('#unrecognisedEmailClose'); await page.evaluate(() => { window.__forceRegistered = false; });

  // 12. an admin invites someone while they are on the login screen elsewhere: sign out from setup
  await page.evaluate(() => { const id = __db.users.length + 90; __db.users.push({ id, username: 'player99', nickname: null, supported_teams: null, auth_user_id: null }); __db.competitor_emails.push({ user_id: id, email: 'later@x.com' }); });
  console.log('12 another invited person:', await signIn('later@x.com'), JSON.stringify({ setup: (await view()).setup }));
  await clickByText('Sign Out'); await page.waitForTimeout(Math.min(500, 40));
  console.log('    Sign Out returns to login:', await page.evaluate(() => !document.getElementById('loginView').classList.contains('hidden') && document.getElementById('setupView').classList.contains('hidden')));
  console.log('pageerrors:', errors);
  await browser.close();
})();
