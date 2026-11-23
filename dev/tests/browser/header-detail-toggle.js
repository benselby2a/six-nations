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
  const open = async (preset) => {
    const page = await browser.newPage();
    await page.addInitScript((p) => { window.__noTourPrompts = true; if (p) { try { Object.keys(p).forEach(k => localStorage.setItem(k, p[k])); } catch (e) {} } }, preset || null);
    page.__errors = []; page.on('pageerror', e => page.__errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
    await page.goto('file://' + path); await page.waitForTimeout(Math.min(800, 40));
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(150, 40));
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(500);
    await page.setViewportSize({width:390,height:900});
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(1000);
    return page;
  };
  const read = (page) => page.evaluate(() => {
    const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    const hs = [...document.querySelectorAll('.summary-container thead th.match-header-cell')];
    const slotTops = sel => hs.map(h => { const e = h.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; });
    const copy = document.querySelector('.summary-sticky-scroll table'), head = document.querySelector('.summary-sticky-head');
    const btn = document.getElementById('headerDetailBtn'), dl = document.getElementById('exportPdfBtn');
    const br = btn.getBoundingClientRect(), dr = dl.getBoundingClientRect();
    return {
      mode: summaryViewMode, compact: document.body.classList.contains('summary-compact'), detail: document.body.classList.contains('summary-detail'),
      stored: (() => { try { return localStorage.getItem('summaryViewMode') + '/' + localStorage.getItem('summaryHeaderDetail'); } catch (e) { return null; } })(),
      btnShown: vis(btn), pressed: btn.getAttribute('aria-pressed'), label: btn.getAttribute('aria-label'),
      nextToDownload: btn.nextElementSibling === dl && Math.abs(br.top - dr.top) < 2 && br.right <= dr.left + 0.5 && dr.left - br.right < 16,
      dateShown: hs.some(h => vis(h.querySelector('.match-date'))), triesShown: hs.some(h => vis(h.querySelector('.match-tries'))),
      headH: Math.round(document.querySelector('.summary-container thead').getBoundingClientRect().height),
      rowH: Math.round(document.querySelector('.summary-container tbody tr').getBoundingClientRect().height),
      jokerInline: [...document.querySelectorAll('.summary-container .joker-inline')].filter(vis).length,
      slotsAligned: ['.match-teams', '.match-date', '.match-result, .no-result', '.match-tries'].every(sel => new Set(slotTops(sel)).size === 1),
      pinnedHeadMatches: !head || !copy || Math.abs(head.getBoundingClientRect().height - document.querySelector('.summary-container thead').getBoundingClientRect().height) <= 2,
      copyCols: copy ? [...copy.querySelectorAll('th.match-header-cell')].map(t => Math.round(t.getBoundingClientRect().width)).join() : null,
      realCols: hs.map(t => Math.round(t.getBoundingClientRect().width)).join(),
      switchViews: [...document.querySelectorAll('#summaryViewSwitch .view-switch-btn')].map(b => b.dataset.view).join()
    };
  });
  let page = await open();
  const d0 = await read(page); console.log('default:', JSON.stringify(d0));
  console.log('Compact is the default, the match details are off, and the switch sits right beside the download button:', d0.mode === 'compact' && d0.compact && !d0.detail && d0.btnShown && d0.pressed === 'false' && d0.nextToDownload && !d0.dateShown && !d0.triesShown);
  console.log('the Full view is gone: the menu offers Compact, Classic and Jumbo:', d0.switchViews === 'compact,classic,simple');
  await page.click('#headerDetailBtn'); await page.waitForTimeout(500);
  const d1 = await read(page); console.log('details on:', JSON.stringify(d1));
  console.log('switching the details on shows the date and tries in the headers (rows and Joker stay compact):', d1.detail && d1.pressed === 'true' && d1.label === 'Hide match details' && d1.dateShown && d1.triesShown && d1.headH > d0.headH && d1.rowH === d0.rowH && d1.jokerInline >= 1 && d1.stored === 'null/1');
  console.log('the header slots line up across matches, and the pinned copy of the header is as tall as the real one:', d1.slotsAligned && d1.pinnedHeadMatches && d1.copyCols === d1.realCols);
  // pinned (page scrolled so the header is stuck): still the same height and columns
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.summary-container').getBoundingClientRect().top + scrollY + 30)); await page.waitForTimeout(400);
  const d1s = await read(page);
  console.log('scrolled with the header pinned: still aligned:', d1s.pinnedHeadMatches && d1s.copyCols === d1s.realCols, d1s.copyCols, d1s.realCols);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Jumbo shares the switch
  await page.evaluate(() => setSummaryView('simple')); await page.waitForTimeout(400);
  const f1 = await read(page);
  console.log('Jumbo keeps the switch and shows the details when it is on:', f1.mode === 'simple' && f1.btnShown && f1.detail && f1.dateShown && f1.triesShown && f1.pinnedHeadMatches && f1.slotsAligned);
  await page.click('#headerDetailBtn'); await page.waitForTimeout(400);
  const f0 = await read(page);
  console.log('Jumbo with the details off hides them again:', f0.mode === 'simple' && !f0.detail && !f0.dateShown && !f0.triesShown && f0.headH < f1.headH && f0.pressed === 'false' && f0.stored === 'simple/0');
  // Classic has its own layout
  await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(500);
  const c0 = await page.evaluate(() => ({ mode: summaryViewMode, btnShown: getComputedStyle(document.getElementById('headerDetailBtn')).display !== 'none' }));
  console.log('Classic hides the switch:', c0.mode === 'classic' && !c0.btnShown);
  await page.evaluate(() => setSummaryView('compact')); await page.waitForTimeout(400);
  console.log('and Compact brings it back:', await page.evaluate(() => getComputedStyle(document.getElementById('headerDetailBtn')).display !== 'none'));
  // remembered
  await page.click('#headerDetailBtn'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(1500);
  const r1 = await page.evaluate(() => ({ detail: document.body.classList.contains('summary-detail'), pressed: document.getElementById('headerDetailBtn').getAttribute('aria-pressed') }));
  console.log('the switch is remembered after a reload:', JSON.stringify(r1), r1.detail && r1.pressed === 'true');
  await page.evaluate(() => toggleSummaryHeaderDetail()); await page.waitForTimeout(300); await page.reload(); await page.waitForTimeout(1500);
  const r0 = await page.evaluate(() => ({ detail: document.body.classList.contains('summary-detail'), pressed: document.getElementById('headerDetailBtn').getAttribute('aria-pressed') }));
  console.log('and so is off:', JSON.stringify(r0), !r0.detail && r0.pressed === 'false');
  console.log('no page errors:', JSON.stringify(page.__errors)); await page.close();

  // people who had the Full view get Compact with the details on
  page = await open({ summaryViewMode: 'full' });
  const m1 = await read(page);
  console.log('a saved Full view becomes Compact with the details on:', JSON.stringify({ mode: m1.mode, detail: m1.detail, stored: m1.stored }), m1.mode === 'compact' && m1.detail && m1.dateShown && m1.stored === 'compact/1' && m1.pressed === 'true');
  await page.close();
  page = await open({ summaryViewMode: 'full', summaryHeaderDetail: '0' });
  const m2 = await read(page);
  console.log('...unless they had already chosen the details off:', JSON.stringify({ mode: m2.mode, detail: m2.detail }), m2.mode === 'compact' && !m2.detail && !m2.dateShown);
  await page.close();
  page = await open({ summaryViewMode: 'simple' });
  const m3 = await read(page);
  console.log('a saved Jumbo choice is untouched:', m3.mode === 'simple' && !m3.detail);
  await page.close();
  page = await open({ summaryCompact: '0' });
  const m4 = await read(page);
  console.log('the oldest "not compact" choice also becomes Compact with the details on:', m4.mode === 'compact' && m4.detail);
  await page.close();

  // the Predicted Tries column reads like the rest of the table
  page = await open();
  for (const theme of ['light', 'dark']) for (const view of ['compact', 'simple']) {
    await page.evaluate(([t, v]) => { changeTheme(t); setSummaryView(v); }, [theme, view]); await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const st = (el) => { const c = getComputedStyle(el); return { family: c.fontFamily, size: c.fontSize, weight: c.fontWeight, color: c.color, spacing: c.letterSpacing }; };
      return { thTries: st(document.querySelector('.summary-container thead th.tries-col')), teams: st(document.querySelector('.summary-container thead .match-teams')),
        thOther: st(document.querySelector('.summary-container thead th.match-header-cell')),
        tdTries: st(document.querySelector('.summary-container tbody td.tries-col')), score: st(document.querySelector('.summary-container tbody td.prediction-cell .cell-score')),
        scoreNum: st(document.querySelector('.summary-container tbody td.prediction-cell .pred-score')), nick: st(document.querySelector('.summary-container tbody td.competitor-name .comp-nick')) };
    });
    // Jumbo trims its fonts a little to fit more columns (PR 261): there the sizes must be close (within 2.5px), not identical
    const sameSize = (a, b) => view === 'simple' ? Math.abs(parseFloat(a) - parseFloat(b)) <= 2.5 : a === b;
    const headOk = s.thTries.family === s.teams.family && sameSize(s.thTries.size, s.teams.size) && s.thTries.weight === s.teams.weight && s.thTries.color === s.thOther.color;
    const bodyOk = view === 'compact'
      ? s.tdTries.family === s.score.family && s.tdTries.size === s.score.size && s.tdTries.weight === s.scoreNum.weight && s.tdTries.color === s.nick.color
      : s.tdTries.family === s.score.family && sameSize(s.tdTries.size, s.score.size) && s.tdTries.weight === s.score.weight && s.tdTries.color === s.nick.color;
    console.log(`Predicted Tries matches the rest of the table (${view}, ${theme}):`, JSON.stringify({ th: [s.thTries.size, s.thTries.weight, s.thTries.color], teams: [s.teams.size, s.teams.weight, s.teams.color], td: [s.tdTries.size, s.tdTries.weight, s.tdTries.color], score: [s.score.size, s.scoreNum.weight, s.nick.color] }), headOk && bodyOk);
  }
  console.log('errors', JSON.stringify(page.__errors));
  await browser.close();
})();
