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
  await page.setViewportSize({ width: 390, height: 800 });
  // ---- compact: score beside the flags
  await page.evaluate(() => setSummaryView('compact')); await page.waitForTimeout(500);
  const cmp = await page.evaluate(() => { const row = document.querySelector('.summary-table tbody tr'); const sub = row.querySelector('.comp-sub'); const score = row.querySelector('.comp-score'); const flags = sub.querySelector('.supported-team-flags'); const sr = score.getBoundingClientRect(), nick = row.querySelector('.comp-nick').getBoundingClientRect(); return { scoreCol: getComputedStyle(row.querySelector('td.pts-col')).display, headScore: getComputedStyle(document.querySelector('th.pts-col')).display, scoreText: score.textContent, scoreShown: sr.width > 0, flagsPresent: !!flags, sameLineAsFlags: flags ? Math.abs((flags.getBoundingClientRect().top + flags.getBoundingClientRect().height / 2) - (sr.top + sr.height / 2)) < 8 : null, belowName: sr.top >= nick.bottom - 2 }; });
  console.log('compact: the Score column is gone and the score sits beside the flags:', JSON.stringify(cmp), cmp.scoreCol === 'none' && cmp.headScore === 'none' && cmp.scoreShown && cmp.belowName && (cmp.sameLineAsFlags === null || cmp.sameLineAsFlags));
  await page.evaluate(() => setSummaryView('full')); await page.waitForTimeout(400);
  console.log('full: the Score column is back and the inline score is hidden:', await page.evaluate(() => getComputedStyle(document.querySelector('td.pts-col')).display !== 'none' && getComputedStyle(document.querySelector('.comp-score')).display === 'none'));
  // ---- chart zoom
  await page.evaluate(() => { document.getElementById('wormChartContainer').scrollIntoView(); }); await page.waitForTimeout(300);
  const dims = () => page.evaluate(() => { const w = document.querySelector('.worm-chart-wrap'); return { client: w.clientWidth, scroll: w.scrollWidth, left: w.scrollLeft }; });
  const fit = await dims();
  console.log('chart fitted: no sideways scrolling:', JSON.stringify(fit), fit.scroll <= fit.client + 2);
  await page.evaluate(() => { zoomWormChart(1.3); zoomWormChart(1.3); zoomWormChart(1.3); }); await page.waitForTimeout(300);
  const zoomed = await dims();
  console.log('+ zooms the chart in and it scrolls sideways:', JSON.stringify(zoomed), zoomed.scroll > zoomed.client * 1.8);
  await page.evaluate(() => { document.querySelector('.worm-chart-wrap').scrollLeft = 120; }); await page.waitForTimeout(150);
  console.log('and can be dragged side to side:', (await dims()).left === 120);
  await page.evaluate(() => zoomWormChart(0)); await page.waitForTimeout(300);
  const back = await dims();
  console.log('Fit puts it back:', JSON.stringify(back), back.scroll <= back.client + 2);
  const pinch = await page.evaluate(() => { const wrap = document.querySelector('.worm-chart-wrap'); const mk = (id, x, y) => new Touch({ identifier: id, target: wrap, clientX: x, clientY: y }); const fire = (type, touches) => wrap.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true })); const r = wrap.getBoundingClientRect(), cy = r.top + 60; fire('touchstart', [mk(1, r.left + 120, cy), mk(2, r.left + 210, cy)]); fire('touchmove', [mk(1, r.left + 80, cy), mk(2, r.left + 260, cy)]); fire('touchend', []); return { client: wrap.clientWidth, scroll: wrap.scrollWidth }; });
  console.log('a two-finger pinch zooms it:', JSON.stringify(pinch), pinch.scroll > pinch.client * 1.5);
  const tools = await page.evaluate(() => { const z = document.querySelector('.worm-zoom'); const h = document.getElementById('exportPdfBtn'); return { zoomH: Math.round(z.getBoundingClientRect().height), bar: !!document.querySelector('.worm-chart-tools') }; });
  console.log('the controls look like the Classic ones:', JSON.stringify(tools), tools.zoomH === 34);
  await page.evaluate(() => zoomWormChart(0));
  // ---- classic date
  await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(500);
  const sub = await page.evaluate(() => document.querySelector('.pdfv-sub').textContent);
  console.log('classic sheet: the update time has the date too:', JSON.stringify(sub), /^Updated [A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} at \d{2}:\d{2}$/.test(sub));
  console.log('errors', errors);
  await browser.close();
})();
