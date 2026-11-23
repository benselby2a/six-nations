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
  for (const mode of ['compact', 'simple']) {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const cs = (e) => getComputedStyle(e).boxShadow;
      const th = document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col');
      const tds = [...document.querySelectorAll('.summary-table:not(.summary-table-clone) td.competitor-name')];
      const rights = [th, ...tds].map(e => Math.round(e.getBoundingClientRect().right));
      const gap = (td) => { const sc = td.querySelector('.comp-score'); const inner = sc || td.querySelector('.comp-nick, .comp-name'); const right = (() => { const r = document.createRange(); r.selectNodeContents(inner); return r.getBoundingClientRect().right; })(); return Math.round((td.getBoundingClientRect().right - 3) - right); };
      return { head: cs(th), body: tds.map(cs), rights, gaps: tds.map(gap) };
    });
    const has = (v) => /inset/.test(v) && /-3px 0px 0px 0px/.test(v);
    console.log(mode + ' content sits at least 2px clear of the divider:', r.gaps.every(g => g >= 2), r.gaps);
    console.log(mode + ' name column has a 3px divider on its right, header and rows:', has(r.head) && r.body.every(has), '| edges line up:', new Set(r.rights).size === 1);
  }
  // iPhone/iPad: the header cells have a 24px page-coloured spacer on top (border-top); the Name header's divider shadow must not show in it.
  // Chromium does not match the iOS-only @supports, so the same rules are injected as plain CSS.
  const css = require('fs').readFileSync(path.replace('index.html', 'styles.css'), 'utf8');
  // (every iOS-only block of styles.css is copied out, a small brace counter picks each one)
  let ios = '';
  for (let at = css.indexOf('@supports (-webkit-touch-callout: none)'); at !== -1; at = css.indexOf('@supports (-webkit-touch-callout: none)', at + 1)) {
    let depth = 0;
    for (let e = css.indexOf('{', at); e < css.length; e++) { if (css[e] === '{') depth++; if (css[e] === '}') { depth--; if (!depth) { ios += '@media all ' + css.slice(css.indexOf('{', at), e + 1) + '\n'; break; } } }
  }
  // (NOCLIP=1 drops the spacer-clip fix from the injected rules, to show the nudged-table check below failing without it)
  if (process.env.NOCLIP) ios = ios.replace(/background-clip: padding-box !important;/g, '').replace(/\.summary-table thead,\s*:root\[data-theme="dark"\] \.summary-table thead \{ background: var\(--bg\); \}/, '');
  console.log('the iOS header divider rule exists in styles.css:', /ios-divider-inset/.test(css) && /border-top: 24px/.test(ios));
  await page.addStyleTag({ content: process.env.NOFIX ? ios.slice(0, ios.lastIndexOf('@media all')) + '.summary-sticky-inner { box-shadow: 0 5px 6px -4px rgba(0, 0, 0, 0.3) !important; }' : ios });
  for (const theme of ['light', 'dark']) for (const mode of ['compact', 'simple']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(([m, t]) => { setSummaryView(m); document.documentElement.setAttribute('data-theme', t); window.scrollTo(0, 0); }, [mode, theme]); await page.waitForTimeout(500);
    const box = await page.evaluate(() => { const th = document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col'); const r = th.getBoundingClientRect(); return { right: r.right, top: r.top }; });
    const buf = await page.screenshot({ clip: { x: Math.floor(box.right) + 1, y: Math.floor(box.top) + 2, width: 6, height: 20 } });    const px = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return [...set]; }, buf.toString('base64'));
    console.log(theme + ' ' + mode + ' nothing of the divider shadow shows in the 24px spacer above the header:', px.length === 1, px.slice(0, 3));
  }
  // The whole 24px strip above the header, from the page's left edge to its right edge, must be one page colour: the pinned header's soft shadow used to leak out of its
  // sides as faint vertical lines beside the table (far left and far right), standing up above the green bar. Compact and Jumbo, details off and on, light and dark.
  for (const theme of ['light', 'dark']) for (const mode of ['compact', 'simple']) for (const detail of [false, true]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(([m, t, d]) => { setSummaryView(m); applySummaryHeaderDetail(d, true); document.documentElement.setAttribute('data-theme', t); window.scrollTo(0, 0); }, [mode, theme, detail]); await page.waitForTimeout(500);
    const top = await page.evaluate(() => document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col').getBoundingClientRect().top);
    const buf = await page.screenshot({ clip: { x: 0, y: Math.floor(top) + 1, width: 390, height: 22 } });
    const bad = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const base = d[0] + ',' + d[1] + ',' + d[2]; const xs = new Set(); for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] + ',' + d[i + 1] + ',' + d[i + 2] !== base) xs.add(x); } return [...xs].slice(0, 8); }, buf.toString('base64'));
    console.log(theme + ' ' + mode + ' details ' + (detail ? 'on' : 'off') + ' the strip above the header is clean across its full width (no vertical line at either edge):', bad.length === 0, bad);
  }
  // ...and still clean after a real tap on the match-details switch and after the summary redraws (what a save does), which is when the pinned header is rebuilt
  for (const theme of ['light', 'dark']) for (const mode of ['compact', 'simple']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(([m, t]) => { setSummaryView(m); document.documentElement.setAttribute('data-theme', t); window.scrollTo(0, 0); }, [mode, theme]); await page.waitForTimeout(400);
    for (const how of ['tap on the details switch', 'redraw']) {
      if (how === 'redraw') await page.evaluate(() => showSummary()); else await page.click('#headerDetailBtn');
      await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.waitForTimeout(700);   // (the button's own tooltip is not part of the strip: it is checked below)
      const top = await page.evaluate(() => document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col').getBoundingClientRect().top);
      const buf = await page.screenshot({ clip: { x: 0, y: Math.floor(top) + 1, width: 390, height: 22 } });
      const bad = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const base = d[0] + ',' + d[1] + ',' + d[2]; const xs = new Set(); for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] + ',' + d[i + 1] + ',' + d[i + 2] !== base) xs.add(x); } return [...xs].slice(0, 8); }, buf.toString('base64'));
      console.log(theme + ' ' + mode + ' after a ' + how + ' the strip above the header is still clean:', bad.length === 0, bad);
    }
  }
  // The thin line standing up through the 24px spacer above the header, at the table's far LEFT (and at every column edge and far right), seen on iPhone in Jumbo: the header cells'
  // green (or dark) background ran underneath their page-coloured border-top, and a cell at a fractional pixel position (the table's left edge is at 10.6px) let that background show at
  // its sides as a 1-device-pixel line (ios-spacer-clip). Chromium snaps boxes to whole pixels, so the table is nudged by a fraction of a pixel (a transform) on a 3x screen to get the
  // same anti-aliased edges. Jumbo: no visible line anywhere across the strip; Compact: none at the far left and far right (x 0 to 60 and 370 to 390).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: false });
  for (const theme of ['light', 'dark']) for (const mode of ['simple', 'compact']) for (const shift of [0.17, 0.33, 0.5]) {
    await page.evaluate(([m, t, s]) => { setSummaryView(m); document.documentElement.setAttribute('data-theme', t); window.scrollTo(0, 0); let st = document.getElementById('__shift'); if (!st) { st = document.createElement('style'); st.id = '__shift'; document.head.appendChild(st); } st.textContent = '.summary-table-wrap { transform: translateX(' + s + 'px); }'; }, [mode, theme, shift]); await page.waitForTimeout(900);
    const top = await page.evaluate(() => document.querySelector('.summary-table:not(.summary-table-clone) th.competitor-col').getBoundingClientRect().top);
    const buf = await page.screenshot({ clip: { x: 0, y: Math.floor(top) + 1, width: 390, height: 22 } });
    const bad = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, img.width, img.height).data; const out = new Set(); for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 100) out.add(Math.round(x / img.width * 390)); } return [...out]; }, buf.toString('base64'));
    const flagged = mode === 'simple' ? bad : bad.filter(x => x < 60 || x > 370);
    console.log(theme + ' ' + mode + ' (table nudged ' + shift + 'px, 3x screen): no line through the strip above the header' + (mode === 'simple' ? '' : ' at the far left or far right') + ':', flagged.length === 0, flagged.slice(0, 10));
  }
  await page.evaluate(() => { const st = document.getElementById('__shift'); if (st) st.remove(); });
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  // the toolbar's tooltips (the gold-edged bubble under a button) must paint over the table, not hide behind its top edge
  const z = await page.evaluate(() => { const tb = getComputedStyle(document.querySelector('.summary-toolbar')); const zone = getComputedStyle(document.querySelector('.summary-sticky-zone')); return { pos: tb.position, tb: Number(tb.zIndex), zone: Number(zone.zIndex) }; });
  console.log('the toolbar (and so its tooltips) stacks above the pinned-header layer:', z.pos !== 'static' && z.tb > z.zone, z);
  console.log('errors', errors);
  await browser.close();
})();
