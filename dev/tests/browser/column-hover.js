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

// The match in play (kick-off passed, no result yet, within 3 hours), or else the next match, gets a faint column tint in Compact and Focus (not Classic).
// Time is fixed with page.clock so each case is exact. 2026 fixtures: 1 (result in), 2 Sat 7 Feb 14:10, 3 Sat 7 Feb 16:40, 4 + 5 both Sat 14 Feb 14:10 (simultaneous), 6 Sun 15 Feb 15:10
const FIXTURES = [
  {id:1,year:2026,round:1,date:'Thu, Feb 5',time:'20:10',team1:'France',team2:'Ireland',actual_score1:30,actual_score2:20,actual_tries1:4,actual_tries2:2,joker_eligible:true},
  {id:2,year:2026,round:1,date:'Sat, Feb 7',time:'14:10',team1:'Italy',team2:'Scotland',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false},
  {id:3,year:2026,round:1,date:'Sat, Feb 7',time:'16:40',team1:'England',team2:'Wales',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true},
  {id:4,year:2026,round:2,date:'Sat, Feb 14',time:'14:10',team1:'Ireland',team2:'Italy',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false},
  {id:5,year:2026,round:2,date:'Sat, Feb 14',time:'14:10',team1:'Scotland',team2:'England',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false},
  {id:6,year:2026,round:2,date:'Sun, Feb 15',time:'15:10',team1:'Wales',team2:'France',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false}
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async ({ touch = false, width = 1000 } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(200);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(400);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(700);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(600);
    return { page, context };
  };
  // which column indexes carry col-hover in the real table, the sideways header copy and the pinned header copy
  const lit = (page) => page.evaluate(() => {
    const idx = (sel) => [...new Set([...document.querySelectorAll(sel)].map(c => c.cellIndex))].sort((a, b) => a - b);
    const rows = document.querySelectorAll('.summary-table:not(.summary-table-clone) tbody tr').length;
    const real = document.querySelectorAll('.summary-table:not(.summary-table-clone) .col-hover').length;
    const head = document.querySelectorAll('.summary-table:not(.summary-table-clone) thead .col-hover').length;
    return { real, head, rows, realIdx: idx('.summary-table:not(.summary-table-clone) .col-hover'),
      scrollCopy: idx('.summary-sticky-scroll .col-hover'), pinCopy: idx('.summary-sticky-pinned .col-hover') };
  });
  const bg = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundImage : null; }, sel);

  for (const view of ['compact', 'simple']) {
    const { page, context } = await open();
    await page.evaluate((v) => setSummaryView(v), view); await page.waitForTimeout(500);
    const T = '.summary-table:not(.summary-table-clone)';
    const label = view === 'compact' ? 'Default' : 'Jumbo';
    // hover a prediction cell of the second match column (cell index 4: #, name, score, match 1, match 2 ...)
    const cell = page.locator(T + ' tbody tr:nth-child(2) td.prediction-cell, ' + T + ' tbody tr:nth-child(2) td').nth(4);
    await cell.hover(); await page.waitForTimeout(150);
    const a = await lit(page);
    console.log(label + ': hovering a body cell lights its column (every row + header):', JSON.stringify({ real: a.real, rows: a.rows, head: a.head, idx: a.realIdx }), a.realIdx.length === 1 && a.real === a.rows + 1 && a.head === 1);
    console.log(label + ': the pinned header copies show it too (sideways copy lit at the same index, pinned copy not, as that column is not pinned):', JSON.stringify({ scroll: a.scrollCopy, pin: a.pinCopy }), a.scrollCopy.length === 1 && a.scrollCopy[0] === a.realIdx[0] && a.pinCopy.length === 0);
    const tdBg = await bg(page, T + ' td.col-hover'), thBg = await bg(page, T + ' thead th.col-hover');
    console.log(label + ': an overlay layer on the cells and on the header, gold like the rest of the app (not grey):', JSON.stringify({ tdBg, thBg }), /linear-gradient/.test(tdBg) && /linear-gradient/.test(thBg) && /232, 176, 42/.test(tdBg));
    const row = await page.evaluate(() => { const r = document.querySelector('.summary-table:not(.summary-table-clone) tbody tr:nth-child(2)'); return getComputedStyle(r.querySelector('td.competitor-name')).backgroundColor + ' | ' + getComputedStyle(r.cells[4]).backgroundColor; });
    console.log(label + ': the row hover still works on the same row (cells have a tinted background):', row, !/rgba\(0, 0, 0, 0\)/.test(row.split(' | ')[0]));
    // a different column
    await page.locator(T + ' tbody tr:nth-child(1) td').nth(5).hover(); await page.waitForTimeout(150);
    const b = await lit(page);
    console.log(label + ': moving to another column moves the highlight (only one column lit):', JSON.stringify(b.realIdx), b.realIdx.length === 1 && b.realIdx[0] !== a.realIdx[0] && b.real === b.rows + 1);
    // hovering the pinned Name column lights that column, in the real table and the pinned header copy
    await page.locator(T + ' tbody tr:nth-child(2) td.competitor-name').hover(); await page.waitForTimeout(150);
    const n = await lit(page);
    console.log(label + ': hovering the Name column lights it (real table and the pinned header copy):', JSON.stringify({ idx: n.realIdx, pin: n.pinCopy }), n.realIdx.length === 1 && n.realIdx[0] === 1 && n.pinCopy.join() === '1');
    // hovering the real header cell of a match
    await page.locator(T + ' thead th.match-header-cell').nth(1).hover({ force: true }); await page.waitForTimeout(150);
    const h = await lit(page);
    console.log(label + ': hovering a header cell (or the pinned header copy on top of it) lights its column:', JSON.stringify(h.realIdx), h.realIdx.length === 1 && h.real === h.rows + 1);
    // leaving the table clears it
    await page.mouse.move(5, 5); await page.waitForTimeout(200);
    const c = await lit(page);
    console.log(label + ': leaving the table clears it:', JSON.stringify({ real: c.real, scroll: c.scrollCopy.length, pin: c.pinCopy.length }), c.real === 0 && c.scrollCopy.length === 0 && c.pinCopy.length === 0);
    // a redraw of the summary clears stale classes and the next hover works
    await page.locator(T + ' tbody tr:nth-child(2) td').nth(4).hover(); await page.waitForTimeout(150);
    await page.evaluate(() => showSummary()); await page.waitForTimeout(500);
    const r0 = await lit(page);
    await page.locator(T + ' tbody tr:nth-child(2) td').nth(4).hover(); await page.waitForTimeout(200);
    const r1 = await lit(page);
    console.log(label + ': after the table is redrawn nothing stale is left (the pointer is still over a cell, so at most that one column is lit, whole), and hovering works again:', JSON.stringify({ afterRedraw: r0.real, idx: r0.realIdx, again: r1.real }), r0.realIdx.length <= 1 && (r0.real === 0 || r0.real === r0.rows + 1) && r1.real === r1.rows + 1);
    // dark theme: the header and the cells still get their overlay
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await page.waitForTimeout(200);
    const dk = { td: await bg(page, T + ' td.col-hover'), th: await bg(page, T + ' thead th.col-hover') };
    console.log(label + ': dark theme keeps the overlay:', JSON.stringify(dk), /linear-gradient/.test(dk.td) && /linear-gradient/.test(dk.th));
    await context.close();
  }

  // Classic has no column hover (the table is hidden and the class never applies)
  {
    const { page, context } = await open();
    await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(500);
    await page.locator('.pdfv-sheet td').nth(5).hover({ force: true }).catch(() => {}); await page.waitForTimeout(150);
    console.log('Classic: no column hover class anywhere:', await page.evaluate(() => document.querySelectorAll('.col-hover').length), (await page.evaluate(() => document.querySelectorAll('.col-hover').length)) === 0);
    await context.close();
  }

  // a touch device (no hover): tapping a cell never leaves a column lit
  {
    const { page, context } = await open({ touch: true, width: 390 });
    await page.evaluate(() => setSummaryView('compact')); await page.waitForTimeout(500);
    const matches = await page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    await page.locator('.summary-table:not(.summary-table-clone) tbody tr:nth-child(2) td').nth(4).tap(); await page.waitForTimeout(250);
    const t = await lit(page);
    console.log('touch device: (hover: hover) is ' + matches + ' and a tap leaves no column lit:', t.real, t.real === 0);
    await context.close();
  }

  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
