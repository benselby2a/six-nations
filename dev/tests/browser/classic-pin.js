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
  await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(600);
  // The first column of every row (Date / KO, Name, Result, Try Count, each person) is a sticky cell: it must sit at the box's left edge when the sheet is scrolled sideways
  const pinState = () => page.evaluate(() => {
    const w = document.getElementById('pdfViewWrap'), wr = w.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.pdfv-sheet .pdfv-table tr')];
    const left = rows.map(tr => Math.round((tr.cells[0].getBoundingClientRect().left - wr.left - w.clientLeft) * 10) / 10);
    const second = rows[2].cells[1].getBoundingClientRect().left - wr.left;
    const c0 = getComputedStyle(rows[2].cells[0]);
    return { scrollLeft: Math.round(w.scrollLeft), scrollW: w.scrollWidth, clientW: w.clientWidth, rows: rows.length, minLeft: Math.min(...left), maxLeft: Math.max(...left), second: Math.round(second), pos: c0.position, names: rows.slice(0, 5).map(tr => tr.cells[0].textContent.replace(/\s+/g, ' ').trim()), scale: document.getElementById('pdfViewSheet').style.getPropertyValue('--pdfv-k') };
  });
  const fit = await pinState();
  console.log('fitted: the sheet fits, first column cells are sticky:', JSON.stringify(fit), fit.pos === 'sticky' && fit.scrollW <= fit.clientW + 1, fit.rows >= 8);
  const checkAt = async (label, sl) => {
    await page.evaluate((x) => { const w = document.getElementById('pdfViewWrap'); w.scrollLeft = x < 0 ? w.scrollWidth : x; }, sl); await page.waitForTimeout(250);
    const st = await pinState();
    // every row's first cell is exactly at the left edge (within 1px) once the sheet has moved sideways
    console.log(label + ':', JSON.stringify(st), st.scrollW > st.clientW + 50, Math.abs(st.minLeft) <= 1 && Math.abs(st.maxLeft) <= 1, st.second < 0);
    return st;
  };
  for (const [name, times] of [['2 steps in', 2], ['3 steps in', 3], ['4 steps in', 4]]) {
    await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(200);
    await page.evaluate((n) => { for (let i = 0; i < n; i++) zoomPdfView(1.3); }, times); await page.waitForTimeout(300);
    await checkAt(name + ', scrolled 150px', 150);
    await checkAt(name + ', scrolled 400px', 400);
    await checkAt(name + ', scrolled to the far right', -1);
  }
  // the divider and shadow on the pinned cells, light and dark; the divider is thinner when the sheet is zoomed out and a full 3px zoomed in
  const divider = () => page.evaluate(() => { const c = document.querySelectorAll('.pdfv-sheet .pdfv-table tr')[3].cells[0]; const cs = getComputedStyle(c); const m = /(-[\d.]+)px 0px 0px 0px inset, rgba\(0, 0, 0, [\d.]+\)/.exec(cs.boxShadow); const w = m ? Math.abs(parseFloat(m[1])) : 0; return { shadow: cs.boxShadow, bg: cs.backgroundColor, z: cs.zIndex, w, k: parseFloat(getComputedStyle(document.querySelector('.pdfv-sheet')).getPropertyValue('--pdfv-k')) }; });
  await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(300);
  const df = await divider();
  console.log('fit: a thin divider (1 to 2.2px) and a soft shadow, opaque background:', JSON.stringify(df), df.w >= 1 && df.w <= 2.2 && /rgba/.test(df.shadow) && df.bg !== 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => { for (let i = 0; i < 4; i++) zoomPdfView(1.3); }); await page.waitForTimeout(300);
  const dl = await divider();
  console.log('zoomed in: the full 3px gold divider, thicker than at fit:', JSON.stringify(dl), Math.abs(dl.w - 3) < 0.05 && dl.w > df.w && /rgba/.test(dl.shadow) && dl.bg !== 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => changeTheme('dark')); await page.waitForTimeout(300);
  const dd = await divider();
  console.log('dark: its own gold divider and shadow:', JSON.stringify(dd), dd.shadow !== dl.shadow && Math.abs(dd.w - 3) < 0.05 && dd.bg !== 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(300);
  const ddf = await divider();
  console.log('dark, fit: thin as well:', JSON.stringify(ddf), ddf.w >= 1 && ddf.w <= 2.2);
  await page.screenshot({ path: '/tmp/pin-classic.png', clip: { x: 0, y: 100, width: 390, height: 360 } });
  await page.evaluate(() => changeTheme('light'));
  // with the round filter set (Classic ignores it and always draws the whole tournament) the first column is still pinned
  await page.evaluate(() => { matches[1].round = 2; selectedRound = 1; filterMatches('round'); }); await page.waitForTimeout(500);
  await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(200);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) zoomPdfView(1.3); }); await page.waitForTimeout(300);
  await checkAt('Current round, zoomed and scrolled', 120);
  await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(300);
  const back = await pinState();
  console.log('Fit puts it back, nothing scrolls:', JSON.stringify(back), back.scrollW <= back.clientW + 1);
  console.log('errors', errors);
  await browser.close();
})();
