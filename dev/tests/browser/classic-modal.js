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





// Classic: clicking a player's prediction cell opens an Excel-style window (a title bar and a plain table, no formula bar, column or row headers or status bar) that shows
// the match, the player, the prediction, the result and how the points were made (same numbers as the summary), Joker doubling and "Not played yet".
// A drag does not open it, Escape / x / backdrop close it and focus returns; other players' predictions stay hidden before the lock.
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async ({ width = 1280, height = 900, scheme = 'light', locked = true, hideLock = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, hasTouch: width < 700 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: hideLock ? mock.replace("settings: [{key:'predictions_locked:2026',value:'true'}],", 'settings: [],').replace(/actual_score1:30,actual_score2:20/, 'actual_score1:null,actual_score2:null') : mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(800);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    await page.evaluate((s) => { changeTheme(s); setSummaryView('classic'); }, scheme); await page.waitForTimeout(900);
    return { ctx, page };
  };
  const SHOT = '/tmp/claude-0/-home-user-six-nations/55e70b8c-24a4-53e8-973b-d120bef1189e/scratchpad/';
  const win = (page) => page.evaluate(() => { const w = document.getElementById('pdfvCellWindow'); if (!w) return null; const g = (s) => { const e = w.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; const rows = [...w.querySelectorAll('.xl-grid tbody tr')].map(tr => [tr.querySelector('.xl-label').textContent.trim(), tr.querySelector('.xl-value').textContent.trim(), tr.querySelector('.xl-pts').textContent.trim()]); const r = w.querySelector('.xl-window').getBoundingClientRect(); return { title: g('.xl-title'), rows, extras: { formula: !!w.querySelector('.xl-formula'), status: !!w.querySelector('.xl-status'), thead: !!w.querySelector('.xl-grid thead'), rownum: !!w.querySelector('.xl-rownum') }, cols: [...w.querySelectorAll('.xl-grid tbody tr')][0].children.length, box: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }, vw: innerWidth, vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1, role: w.querySelector('.xl-window').getAttribute('role'), modal: w.querySelector('.xl-window').getAttribute('aria-modal') }; });
  const cellOf = (user, match, kind) => `td[data-pred-user="${user}"][data-pred-match="${match}"]:nth-of-type(1)`;

  // ---- light, desktop 1280 ----
  { const { ctx, page } = await open();
    const clickable = await page.evaluate(() => ({ n: document.querySelectorAll('.pdfv-sheet td[data-pred-user]').length, pinnedClickable: document.querySelectorAll('.pdfv-sheet td.pdfv-pinned[data-pred-user]').length, headClickable: document.querySelectorAll('.pdfv-sheet thead [data-pred-user]').length, cursor: getComputedStyle(document.querySelector('.pdfv-sheet td[data-pred-user]')).cursor }));
    console.log('player prediction cells are clickable (pointer cursor); the names column and the header/result rows are not:', JSON.stringify(clickable), clickable.n > 0 && clickable.pinnedClickable === 0 && clickable.headClickable === 0 && clickable.cursor === 'pointer');
    // Ben, match 1: predicted 25-20, result 30-20, Joker: base points doubled
    const benScore = await page.evaluate(() => { const c = [...document.querySelectorAll('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]')]; return { n: c.length, texts: c.map(x => x.textContent.trim()) }; });
    await page.click('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]'); await page.waitForTimeout(250);
    const w1 = await win(page);
    console.log('Ben, France v Ireland: window opens with the match, player, prediction and result:', JSON.stringify(w1 && w1.title), !!w1 && /Ben - France v Ireland/.test(w1.title) && w1.rows[0][1] === 'France v Ireland' && w1.rows[1][1] === 'Ben' && w1.rows[2][1] === '25 - 20' && w1.rows[3][1] === '30 - 20');
    const tot = w1 && Number(w1.rows.find(r => r[0] === 'Total points')[2]);
    const sum = w1 && w1.rows.filter(r => ['Correct result', 'Perfect score bonus', 'Draw bonus', 'Close score bonus', 'Joker'].includes(r[0])).reduce((a, r) => a + Number(r[2]), 0);
    const cellPts = await page.evaluate(() => { const row = [...document.querySelectorAll('.pdfv-sheet tbody tr')].find(tr => tr.querySelector('td[data-pred-user="ben"]')); const tds = [...row.querySelectorAll('td[data-pred-user="ben"][data-pred-match="1"]')]; return tds.map(t => t.textContent.trim()); });
    console.log('the breakdown rows add up to the total and match the points shown in the cell:', JSON.stringify({ tot, sum, cellPts }), sum === tot && tot > 0 && cellPts.includes(String(tot)));
    console.log('Joker doubling is shown (x2, the extra equals the base points):', JSON.stringify(w1.rows.find(r => r[0] === 'Joker')), w1.rows.find(r => r[0] === 'Joker')[1] === 'x2' && Number(w1.rows.find(r => r[0] === 'Joker')[2]) * 2 === tot);
    console.log('it is a plain table in the Excel style: no formula bar, no A B C column headers, no row numbers, no status bar; a dialog with aria-modal:', JSON.stringify([w1.extras, w1.cols, w1.role, w1.modal]), !w1.extras.formula && !w1.extras.status && !w1.extras.thead && !w1.extras.rownum && w1.cols === 3 && w1.role === 'dialog' && w1.modal === 'true');
    const sel = await page.evaluate(() => ({ cells: document.querySelectorAll('.pdfv-selected').length, outline: getComputedStyle(document.querySelector('.pdfv-selected')).outlineColor, scroll: document.body.style.overflow }));
    console.log('the clicked cell gets the green selection border and the page does not scroll behind:', JSON.stringify(sel), sel.cells === 1 && /33, 115, 70/.test(sel.outline) && sel.scroll === 'hidden');
    await page.screenshot({ path: SHOT + 'classic-modal-light-desktop.png' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const afterEsc = await page.evaluate(() => ({ open: !!document.getElementById('pdfvCellWindow'), focus: document.activeElement && document.activeElement.getAttribute('data-pred-user'), sel: document.querySelectorAll('.pdfv-selected').length, overflow: document.body.style.overflow }));
    console.log('Escape closes it, focus returns to the cell, the selection and scroll lock are removed:', JSON.stringify(afterEsc), !afterEsc.open && afterEsc.focus === 'ben' && afterEsc.sel === 0 && afterEsc.overflow !== 'hidden');
    // a match with no result yet (Ben, Italy v Scotland, predicted 10-30)
    await page.click('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="2"]'); await page.waitForTimeout(250);
    const w2 = await win(page);
    console.log('a match not played yet: shows the prediction and "Not played yet", no points rows:', JSON.stringify([w2.rows.map(r => r[0]), w2.rows[3]]), w2.rows[2][1] === '10 - 30' && w2.rows[3][1] === 'Not played yet' && !w2.rows.some(r => r[0] === 'Total points'));
    await page.click('.xl-close'); await page.waitForTimeout(150);
    console.log('the x button closes it:', !(await win(page)));
    await page.click('.pdfv-sheet td[data-pred-user="sam"][data-pred-match="1"]'); await page.waitForTimeout(250);
    const w3 = await win(page);
    console.log('another player (Sam, 20-25, loses): no Joker, correct result No, total 0:', JSON.stringify(w3.rows.map(r => r.join('|'))), w3.rows[2][1] === '20 - 25' && w3.rows.find(r => r[0] === 'Correct result')[1] === 'No' && w3.rows.find(r => r[0] === 'Joker')[1] === 'Not played' && w3.rows.find(r => r[0] === 'Total points')[2] === '0');
    await page.mouse.click(5, 5); await page.waitForTimeout(200);
    console.log('clicking the backdrop closes it:', !(await win(page)));
    // a drag over a cell does not open it
    const box = await page.evaluate(() => { const r = document.querySelector('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 40, box.y + 5, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(250);
    console.log('a drag (scroll gesture) over a cell does not open it:', !(await win(page)));
    // theme change: dark scheme while open uses the dark colours (reopen)
    await ctx.close(); }

  // ---- dark theme + the colours ----
  { const { ctx, page } = await open({ scheme: 'dark' });
    await page.click('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]'); await page.waitForTimeout(250);
    const d = await page.evaluate(() => { const w = document.querySelector('.xl-window'); return { bg: getComputedStyle(w).backgroundColor, fg: getComputedStyle(w).color, title: getComputedStyle(document.querySelector('.xl-titlebar')).backgroundColor }; });
    console.log('dark theme: the window uses the dark sheet colours (dark body, light text, green title bar):', JSON.stringify(d), /18, 38, 28/.test(d.bg) && /234, 243, 238/.test(d.fg) && /33, 115, 70/.test(d.title));
    await page.screenshot({ path: SHOT + 'classic-modal-dark-desktop.png' });
    await ctx.close(); }

  // ---- phone 390: fits the viewport, no sideways overflow, the sheet's own zoom keeps working ----
  for (const scheme of ['light', 'dark']) { const { ctx, page } = await open({ width: 390, height: 700, scheme });
    await page.evaluate(() => zoomPdfView(1.4)); await page.waitForTimeout(300);
    await page.tap('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]').catch(async () => { await page.click('.pdfv-sheet td[data-pred-user="ben"][data-pred-match="1"]', { force: true }); });
    await page.waitForTimeout(300);
    const w = await win(page);
    console.log(`phone 390 (${scheme}, sheet zoomed): the window fits the screen and nothing overflows sideways:`, JSON.stringify(w && [w.box, w.vw, w.vh, w.over]), !!w && w.box.l >= 0 && w.box.r <= w.vw && w.box.t >= 0 && w.box.b <= w.vh && !w.over);
    await page.screenshot({ path: SHOT + `classic-modal-${scheme}-phone.png` });
    await ctx.close(); }

  // ---- before the lock the Match Summary is just the signed-up list (no table), so no player's predictions can be opened ----
  { const { ctx, page } = await open({ hideLock: true });
    const c = await page.evaluate(() => ({ cells: document.querySelectorAll('.pdfv-sheet td[data-pred-user]').length, sheet: !!document.querySelector('.pdfv-sheet'), others: document.querySelectorAll('.pdfv-sheet td[data-pred-user="sam"]').length }));
    console.log('before the lock nothing opens another player\'s prediction (no clickable cells for others):', JSON.stringify(c), c.others === 0);
    await ctx.close(); }

  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
