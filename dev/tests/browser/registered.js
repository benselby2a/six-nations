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
    usage_events: [], competitor_emails: [{user_id: 2, email: 'sam@x.com'}]
  };
  window.__db = db; window.__log = [];
  const match = (row, f) => f.type==='eq' ? row[f.col]===f.val : f.type==='in' ? f.vals.includes(row[f.col]) : f.type==='neq' ? row[f.col]!==f.val : f.type==='gte' ? row[f.col]>=f.val : true;
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
      if (name === 'check_login_email') { if (window.__rpcDown) return {data: null, error: {message: 'boom'}}; const e = String(args.p_email || '').toLowerCase().trim(); const registered = db.competitor_emails.some(x => x.email === e) || db.users.some(x => x.auth_user_id === 'u-' + e); return {data: window.__forceRegistered ? true : registered, error: null}; }
      if (name === 'login_admin_names') { return {data: db.admin_usernames.map(a => db.users.find(x => x.username === a.username)).filter(Boolean).map(x => x.nickname).sort(), error: null}; }
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
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path);
  await page.waitForTimeout(Math.min(900, 40));
  const modalOpen = () => page.evaluate(() => !document.getElementById('unrecognisedEmailModal').classList.contains('hidden'));
  const state = () => page.evaluate(() => ({ app: !document.getElementById('appView').classList.contains('hidden'), codeBox: !document.getElementById('loginCodeEntry').classList.contains('hidden'), otpSent: !!window.__otp, user: document.getElementById('currentUser').textContent }));
  const sendTo = async (email) => { await page.fill('#loginEmail', email); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(400, 40)); };

  // 1. an unrecognised email
  await sendTo('Stranger@Example.com');
  const popup = await page.evaluate(() => ({ title: document.getElementById('unrecognisedEmailTitle').textContent, body: document.getElementById('unrecognisedEmailBody').innerText.replace(/\s+/g, ' ').trim(), admins: [...document.querySelectorAll('.unrecognised-admins li')].map(li => li.textContent) }));
  console.log('1 unrecognised email -> pop-up shown:', await modalOpen());
  console.log('  ', JSON.stringify(popup));
  console.log('  no code sent, no code box:', JSON.stringify(await state()), '| send button usable:', await page.evaluate(() => !document.getElementById('sendLoginCodeBtn').disabled));
  await page.screenshot({ path: 'unrecognised-popup.png' });

  // 2. dismiss it three ways
  await page.click('#unrecognisedEmailClose'); console.log('2 "Try Again" closes it:', !(await modalOpen()), '| focus is back on the email box:', await page.evaluate(() => document.activeElement.id));
  await sendTo('stranger@example.com'); await page.keyboard.press('Escape'); console.log('  Escape closes it:', !(await modalOpen()));
  await sendTo('stranger@example.com'); await page.mouse.click(5, 5); await page.waitForTimeout(Math.min(200, 40)); console.log('  tapping outside closes it:', !(await modalOpen()));
  console.log('  nothing was ever sent:', !(await state()).otpSent);

  // 3. a registered email that has never signed in (sam) gets a code
  await sendTo('SAM@x.com');
  console.log('3 registered email (never signed in) -> code sent:', JSON.stringify({ modal: await modalOpen(), ...(await state()) }), '| request:', await page.evaluate(() => JSON.stringify(window.__otp)));
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
  console.log('   signs in as:', (await state()).user, '| linked in db:', await page.evaluate(() => __db.users.find(u => u.username === 'sam').auth_user_id));
  await page.evaluate(() => logout()); await page.waitForTimeout(Math.min(400, 40));

  // 4. a competitor linked by hand before (no registered email) still gets in
  await sendTo('ben@example.com');
  console.log('4 account linked by hand -> code sent:', JSON.stringify({ modal: await modalOpen(), codeBox: (await state()).codeBox }));
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
  console.log('   signs in as:', (await state()).user);

  // 5. admin screen: no sign-up toggle, email hints present
  await page.evaluate(() => { const find = (t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.offsetParent !== null); find('Admin Functions').click(); find('Competitors').click(); });
  await page.waitForTimeout(Math.min(600, 40));
  console.log('5 competitors screen: sign-up toggle gone:', await page.evaluate(() => !document.getElementById('allowSelfSignupToggle') && typeof toggleAllowSelfSignup === 'undefined'), '| email hints:', await page.evaluate(() => [...document.querySelectorAll('#new-competitor-card .cc-field .profile-hint, #user-row-sam .cc-field .profile-hint')].map(h => h.textContent.trim()).filter(t => /email|sign in/i.test(t)).slice(0, 2)));
  await page.evaluate(() => logout()); await page.waitForTimeout(Math.min(400, 40));

  // 6. defence in depth: an email that slips past the check but has no competitor is signed out with the same pop-up
  await page.evaluate(() => { window.__forceRegistered = true; });
  await sendTo('ghost@x.com');
  console.log('6 check bypassed -> code sent:', (await state()).codeBox);
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1200, 40));
  console.log('   signed in without a competitor -> pop-up shown:', await modalOpen(), '| signed out of the app:', !(await state()).app, '| names:', await page.evaluate(() => [...document.querySelectorAll('.unrecognised-admins li')].map(li => li.textContent)));
  await page.click('#unrecognisedEmailClose');
  await page.evaluate(() => { window.__forceRegistered = false; window.__rpcDown = true; });
  await sendTo('sam@x.com');
  console.log('7 the check fails (network/database) -> message, no pop-up:', await page.evaluate(() => document.getElementById('loginFeedback').textContent), '| pop-up:', await modalOpen());
  console.log('pageerrors:', errors);
  await browser.close();
})();
