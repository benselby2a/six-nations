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
      {id:1,username:'ben',nickname:'Ben',supported_teams:'France,Ireland,Wales',auth_user_id:'u-ben@example.com'},
      {id:2,username:'sam',nickname:'Samuelson-Longname',supported_teams:'England,Italy'},
      {id:3,username:'newbie',nickname:'Newbie',supported_teams:null},
      {id:4,username:'only27',nickname:'Only27',supported_teams:null},
      {id:7,username:'claudia',nickname:'Claudia',supported_teams:null},
      {id:8,username:'carol',nickname:'Carol & Gareth',supported_teams:null},
      {id:9,username:'louise',nickname:'Louise & Ben',supported_teams:null},
      {id:10,username:'jojo',nickname:'Jojo & Charlie',supported_teams:null},
      {id:6,username:'evil',nickname:'<img src=x onerror="window.__xss=(window.__xss||0)+1">Eve<b id=injected>',supported_teams:null}
    ],
    predictions: [
      {id:1,user_id:1,match_id:1,team1_score:25,team2_score:20},
      {id:2,user_id:1,match_id:2,team1_score:10,team2_score:30},
      {id:3,user_id:2,match_id:1,team1_score:20,team2_score:25},
      {id:4,user_id:4,match_id:3,team1_score:22,team2_score:18},
      {id:5,user_id:7,match_id:1,team1_score:30,team2_score:20},
      {id:6,user_id:8,match_id:1,team1_score:28,team2_score:21},
      {id:7,user_id:9,match_id:1,team1_score:25,team2_score:18},
      {id:8,user_id:10,match_id:1,team1_score:31,team2_score:22}
    ],
    user_tries: [{user_id:1,year:2026,total_tries:10},{user_id:4,year:2027,total_tries:7}],
    user_joker_selections: [{id:1,user_id:1,match_id:1},{id:2,user_id:4,match_id:3}],
    admin_usernames: [{username:'ben'}],
    settings: [{key:'predictions_locked:2026',value:'true'}],
    scoring_rules: [{id:1,year:2026,correct_result_points:60,perfect_score_bonus:40,draw_bonus:2,max_jokers_per_user:1,entry_fee_amount:10,payout_first_pct:100,payout_second_pct:0,payout_third_pct:0,payout_closest_tries_pct:0}],
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
  await page.evaluate(() => setSummaryView('simple')); await page.waitForTimeout(500);
  const measure = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll('.summary-table:not(.summary-table-clone) td.competitor-name')].filter(c => c.getClientRects().length);
    const rows = cells.map(c => {
      const nick = c.querySelector('.comp-nick'), sc = c.querySelector('.comp-score');
      const rg = document.createRange(); rg.selectNodeContents(nick);
      const rects = [...rg.getClientRects()].filter(x => x.width > 0);
      const centres = new Set(rects.map(x => Math.round(x.top + x.height / 2)));
      const lh = parseFloat(getComputedStyle(nick).lineHeight) || nick.getBoundingClientRect().height;
      return { name: nick.textContent.trim().slice(0, 24), lines: centres.size, h: Math.round(nick.getBoundingClientRect().height), lh: Math.round(lh),
        clipped: nick.scrollWidth > nick.clientWidth + 0.5, ellipsis: getComputedStyle(nick).textOverflow === 'ellipsis', shrink: nick.classList.contains('nick-shrink'),
        title: nick.title, fs: getComputedStyle(nick).fontSize, scoreRight: Math.round(sc.getBoundingClientRect().right), cellRight: Math.round(c.getBoundingClientRect().right), nickRight: Math.round(nick.getBoundingClientRect().right), scoreLeft: Math.round(sc.getBoundingClientRect().left) };
    });
    const td = cells[0];
    const w = Math.round(td.getBoundingClientRect().width);
    const hdr = document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col');
    const pinned = document.querySelector('.summary-table-clone-pinned th.competitor-col, .summary-sticky-pinned th.competitor-col');
    const fs = getComputedStyle(document.body).getPropertyValue('--focus-name-w').trim();
    return { rows, colW: w, hdrW: hdr ? Math.round(hdr.getBoundingClientRect().width) : null, pinnedW: pinned ? Math.round(pinned.getBoundingClientRect().width) : null, varW: fs };
  });
  const names0 = (await measure()).rows.map(x => x.name);
  console.log('worst-case names are in the table:', ['Claudia', 'Carol & Gareth', 'Louise & Ben', 'Jojo & Charlie', 'Samuelson-longname'].every(n => names0.includes(n)), JSON.stringify(names0));
  for (const theme of ['light', 'dark']) for (const detail of [false, true]) for (const width of [360, 390, 430, 768, 1280]) {
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
    await page.evaluate((d) => { if (document.body.classList.contains('summary-detail') !== d) toggleSummaryHeaderDetail(); }, detail);
    await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(500);
    // stretch some totals to 3-4 digits
    await page.evaluate(() => { document.querySelectorAll('.summary-table:not(.summary-table-clone) .comp-score').forEach((e, i) => { if (i % 2) e.textContent = '1288'; }); });
    await page.evaluate(() => { if (typeof fitFocusNameColumn === 'function') fitFocusNameColumn(); if (typeof layoutSummarySticky === 'function') layoutSummarySticky(); }); await page.waitForTimeout(250);
    const r = await measure();
    const oneLine = r.rows.every(x => x.lines === 1 && x.h <= x.lh * 1.2 + 1);
    const noMidWord = r.rows.every(x => !x.clipped || (x.ellipsis && x.title && (x.shrink || x.name.length > 14)));
    const scoreInside = r.rows.every(x => x.scoreRight <= x.cellRight + 0.5 && x.nickRight <= x.scoreLeft + 1);
    const bounded = r.colW >= 84 && r.colW <= 150;
    const aligned = r.hdrW === r.colW && (r.pinnedW === null || Math.abs(r.pinnedW - r.colW) <= 1);
    console.log(`${theme} detail=${detail} @${width}: names one line:`, oneLine, '| none broken mid-word (clipped only with ellipsis + title):', noMidWord, '| score inside the cell, clear of the name:', scoreInside, '| column 84-150px (96-132px + padding):', bounded, '| header/pinned header same width:', aligned, '|', JSON.stringify({ col: r.colW, hdr: r.hdrW, pinned: r.pinnedW, v: r.varW }));
    if (!oneLine || !noMidWord || !scoreInside || !aligned) console.log('   detail:', JSON.stringify(r.rows));
  }
  // names that fit never shrink or get cut: the short ones are untouched
  const r2 = await measure();
  console.log('short names are not shrunk or cut:', r2.rows.filter(x => /^(Ben|Claudia)$/.test(x.name)).every(x => !x.shrink && !x.clipped));
  // the column is no wider than it has to be: with only short names it goes back to its minimum
  await page.evaluate(() => { document.querySelectorAll('.summary-table:not(.summary-table-clone) .comp-nick').forEach(e => { e.textContent = 'Abc'; }); document.querySelectorAll('.summary-table:not(.summary-table-clone) .comp-score').forEach(e => { e.textContent = '99'; }); if (typeof fitFocusNameColumn === 'function') fitFocusNameColumn(); });
  const r3 = await measure();
  console.log('only short names: the column is back to its minimum (the 96px minimum + the cell padding, never wider than the 108px it used to be):', r3.colW <= 108 && String(r3.varW) === '96px', r3.colW, r3.varW);
  console.log('errors', errors);
  await browser.close();
})();
