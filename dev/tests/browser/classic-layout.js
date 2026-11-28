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





const sizes = [[390, 844, 'light'], [390, 844, 'dark'], [768, 1024, 'light'], [1280, 900, 'light']];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, theme] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: w < 800, isMobile: w < 800 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
    await page.goto('file://' + path); await page.waitForTimeout(800);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(150);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(1000);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    if (theme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(800);
    // What the sheet looks like on screen: the lines must stay hairlines and the cells must keep the proportions of the A4 page (not squashed), at fit and zoomed in
    const measure = () => page.evaluate(() => {
      const wrap = document.getElementById('pdfViewWrap'), sheet = document.getElementById('pdfViewSheet'), table = sheet.querySelector('.pdfv-table');
      wrap.scrollLeft = 0;   // the pinned first column slides over the others once the sheet is scrolled, so look at it unscrolled
      const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--pdfv-thin)'; sheet.appendChild(probe);
      const thin = probe.getBoundingClientRect().width; probe.remove();
      const rows = [...table.querySelectorAll('tr')];
      const rects = rows.map(tr => tr.getBoundingClientRect());
      let rowsOverlap = 0, cellsOverlap = 0, clipped = 0;
      rows.forEach((tr, i) => {
        if (i > 0 && rects[i].top < rects[i - 1].bottom - 0.6) rowsOverlap++;
        const cs = [...tr.cells];
        cs.forEach((td, j) => {
          if (j > 0 && td.getBoundingClientRect().left < cs[j - 1].getBoundingClientRect().right - 0.6) cellsOverlap++;
          if (td.scrollWidth > td.clientWidth + 1 || td.scrollHeight > td.clientHeight + 1) clipped++;
        });
      });
      const userRow = rows[rows.length - 2];
      const td = userRow.cells[1];
      return {
        k: parseFloat(sheet.style.getPropertyValue('--pdfv-k')), wrapW: wrap.clientWidth, sheetW: Math.round(sheet.getBoundingClientRect().width * 10) / 10, sheetH: Math.round(sheet.getBoundingClientRect().height),
        thin: Math.round(thin * 1000) / 1000, borderL: getComputedStyle(td).borderLeftWidth, zoom: getComputedStyle(sheet).zoom, transform: sheet.style.transform || 'none',
        rowH: Math.round(userRow.getBoundingClientRect().height * 100) / 100, font: Math.round(parseFloat(getComputedStyle(td).fontSize) * 100) / 100, rowsOverlap, cellsOverlap, clipped, nRows: rows.length
      };
    });
    const tag = `${w}px ${theme}`;
    const fit = await measure();
    const fitK = fit.k;
    const rowRatio = fit.rowH / fit.sheetW;   // a body row is 6.8mm of the 297mm page at any scale
    console.log(tag + ' fit:', JSON.stringify(fit), 'rowRatio', rowRatio.toFixed(4));
    console.log(tag + ' the sheet fills the box at fit (or the 1.6x cap on wide screens):', Math.abs(fit.sheetW - Math.min(fit.wrapW, 297 * 3.7795 * 1.6)) <= 2);
    console.log(tag + ' no CSS zoom or transform, and the lines are true hairlines (no 1px-minimum borders):', fit.zoom === '1' && fit.transform === 'none' && fit.borderL === '0px' && fit.thin <= 1.4 * fit.k + 0.01);
    console.log(tag + ' rows keep the proportions of the page (not squashed):', rowRatio > 0.02 && rowRatio < 0.027, 'rowH ' + fit.rowH);
    console.log(tag + ' text is the size the page makes it (about 12px x scale):', fit.font / fit.k > 9 && fit.font / fit.k < 14, fit.font);
    console.log(tag + ' no overlapping rows or cells:', fit.rowsOverlap === 0 && fit.cellsOverlap === 0, 'clipped cells: ' + fit.clipped, fit.clipped === 0);
    if (w < 800) {
      await page.evaluate(() => { for (let i = 0; i < 3; i++) zoomPdfView(1.3); }); await page.waitForTimeout(300);
      const z = await measure();
      console.log(tag + ' zoomed 3 steps:', JSON.stringify(z));
      console.log(tag + ' zoomed: bigger text and rows, the same proportions, no overlap:', z.font > fit.font * 1.8, z.rowH > fit.rowH * 1.8, Math.abs(z.rowH / z.sheetW - rowRatio) < 0.003, z.rowsOverlap === 0 && z.cellsOverlap === 0, z.clipped === 0);
      await page.evaluate(() => zoomPdfView(0)); await page.waitForTimeout(300);
      const back = await measure();
      console.log(tag + ' Fit puts it back:', Math.abs(back.k - fitK) < 0.001, Math.abs(back.sheetW - fit.sheetW) < 1);
      await page.reload(); await page.waitForTimeout(1500);
      const isClassic = await page.evaluate(() => !!document.getElementById('pdfViewSheet'));
      if (isClassic) { const r = await measure(); console.log(tag + ' after a reload it is the same:', Math.abs(r.k - fitK) < 0.001, Math.abs(r.rowH - fit.rowH) < 0.3); }
    }
    await ctx.close();
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
