const { chromium } = require('playwright');
const path = '/home/user/six-nations/index.html';

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
    admin_usernames: [{username:'ben'}],
    settings: [{key:'predictions_locked:2026',value:'true'}],
    scoring_rules: [{id:1,year:2026,correct_result_points:3,perfect_score_bonus:3,draw_bonus:2,max_jokers_per_user:1,entry_fee_amount:10,payout_first_pct:100,payout_second_pct:0,payout_third_pct:0,payout_closest_tries_pct:0}],
    scoring_close_tiers: [{id:1,year:2026,tier_order:1,within_points:5,bonus_points:1}],
    usage_events: [], competitor_emails: []
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
      if (name === 'check_login_email') return {data: !window.__emailFree, error: null};
      if (name === 'login_admin_names') return {data: [], error: null};
      const u = (n) => db.users.find(x => x.username === n);
      const meEmail = session && session.user.email;
      const isAdmin = () => !!session && db.admin_usernames.some(a => (db.users.find(x => x.auth_user_id === session.user.id) || {}).username === a.username);
      if (name === 'my_competitor') {
        if (!session) return {data: [], error: null};
        let row = db.users.find(x => x.auth_user_id === session.user.id);
        if (!row) { const reg = db.competitor_emails.find(e => e.email === meEmail.toLowerCase()); const cand = reg && db.users.find(x => x.id === reg.user_id && !x.auth_user_id); if (cand) { cand.auth_user_id = session.user.id; row = cand; } }
        return {data: row ? [{username: row.username, nickname: row.nickname}] : [], error: null};
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
  const page = await browser.newPage();
  await page.addInitScript(() => { window.__noTourPrompts = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path); await page.waitForTimeout(Math.min(800, 40));
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(150, 40));
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
  await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
  await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => changeTheme('light'));
  await page.click('#summaryViewSwitch [data-view="classic"]'); await page.waitForTimeout(600);
  console.log('PDF button in the switch is on and remembered:', await page.evaluate(() => ({ on: document.querySelector('#summaryViewSwitch [data-view=classic]').getAttribute('aria-pressed'), saved: localStorage.getItem('summaryViewMode'), sheet: !!document.getElementById('pdfViewSheet'), table: !!document.querySelector('.summary-table') })));
  const bg = (sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; }, sel);
  // Ben's row (first player row): home 25 v away 20 -> home wins; points 10; joker 'x'; rank 1
  const rows = () => page.evaluate(() => [...document.querySelectorAll('.pdfv-table tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim())));
  const r = await rows();
  console.log('rows:', JSON.stringify(r.slice(0, 3)));
  const cellBg = (row, col) => page.evaluate(([ro, co]) => getComputedStyle(document.querySelectorAll('.pdfv-table tbody tr')[ro].cells[co]).backgroundColor, [row, col]);
  const light = { win: await cellBg(2, 1), lose: await cellBg(2, 2), pts: await cellBg(2, 3), joker: await cellBg(2, 4), rank: await cellBg(2, 10), name: await cellBg(2, 0), nameAlt: await cellBg(3, 0) };
  console.log('light colours are the PDF colours:', JSON.stringify(light));
  console.log('  win (198,230,206), lose (244,199,199), points (236,228,202), joker (157,190,221), rank 1 (40,176,96), plain white, alternate row grey 220:',
    light.win === 'rgb(198, 230, 206)' && light.lose === 'rgb(244, 199, 199)' && light.pts === 'rgb(236, 228, 202)' && light.joker === 'rgb(157, 190, 221)' && light.rank === 'rgb(40, 176, 96)' && light.name === 'rgb(255, 255, 255)' && light.nameAlt === 'rgb(220, 220, 220)');
  const before = await page.evaluate(() => document.getElementById('pdfViewSheet'));
  await page.evaluate(() => { window.__sheet = document.getElementById('pdfViewSheet'); changeTheme('dark'); }); await page.waitForTimeout(300);
  const dark = { win: await cellBg(2, 1), name: await cellBg(2, 0), nameAlt: await cellBg(3, 0), sheet: await bg('#pdfViewSheet') };
  console.log('dark scheme:', JSON.stringify(dark), '| switched without redrawing:', await page.evaluate(() => window.__sheet === document.getElementById('pdfViewSheet')),
    '| dark, not the light colours:', dark.win !== light.win && dark.name !== light.name && dark.sheet === 'rgb(11, 26, 20)');
  await page.evaluate(() => changeTheme('light'));
  // the round filter narrows the columns; Full returns the normal table
  const colsAll = await page.evaluate(() => document.querySelectorAll('.pdfv-table colgroup col').length);
  await page.evaluate(() => { matches[1].round = 2; selectedRound = 1; filterMatches('round'); }); await page.waitForTimeout(500);
  console.log('the All matches / Current round controls are hidden in Classic:', await page.evaluate(() => getComputedStyle(document.getElementById('summaryFilterToggle')).display === 'none'));
  const colsRound = await page.evaluate(() => document.querySelectorAll('.pdfv-table colgroup col').length);
  console.log('the Classic view ignores the match filter (always the whole tournament):', colsAll, '->', colsRound, colsRound === colsAll);
  await page.evaluate(() => filterMatches('default'));
  await page.click('#summaryViewSwitch [data-view="full"]'); await page.waitForTimeout(500);
  console.log('and shown again in Full:', await page.evaluate(() => getComputedStyle(document.getElementById('summaryFilterToggle')).display !== 'none'));
  console.log('the toolbar order is: view switch, download, then the match filter:', await page.evaluate(() => { const y = id => Math.round(document.getElementById(id).getBoundingClientRect().top); return JSON.stringify({ sw: y('summaryViewSwitch'), dl: y('exportPdfBtn'), filter: y('summaryFilterToggle') }); }));
  console.log('there is no refresh button any more:', await page.evaluate(() => !document.getElementById('summaryRefreshBtn')));
  console.log('Full brings the normal table back:', await page.evaluate(() => !document.getElementById('pdfViewSheet') && !!document.querySelector('.summary-table') && !document.body.classList.contains('summary-compact') && !document.body.classList.contains('summary-pdf')));
  await page.reload(); await page.waitForTimeout(1500);
  console.log('the choice is remembered after a reload (Full):', await page.evaluate(() => summaryViewMode));
  await page.evaluate(() => setSummaryView('classic')); await page.reload(); await page.waitForTimeout(1800);
  console.log('PDF is remembered after a reload:', await page.evaluate(() => summaryViewMode + ' ' + document.body.classList.contains('summary-classic') + ' ' + document.querySelector('#summaryViewSwitch [data-view=classic]').getAttribute('aria-pressed')));
  console.log('errors', errors);
  await browser.close();
})();
