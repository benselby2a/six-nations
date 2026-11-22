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
  await page.setViewportSize({ width: 390, height: 700 });
  await page.evaluate(() => { localStorage.removeItem('summaryViewMode'); startTour(); showTourStep(3); }); await page.waitForTimeout(900);
  const st = () => page.evaluate(() => ({ title: document.getElementById('tourTitle').textContent, html: document.getElementById('tourBody').innerHTML.slice(0, 60), nextDisabled: document.getElementById('tourNext').disabled, hint: !!document.querySelector('.tour-views-need') && !document.querySelector('.tour-views-need').hidden, selected: [...document.querySelectorAll('.tour-view-tab.on')].length }));
  const nextBox = () => page.evaluate(() => { const b = document.getElementById('tourNext').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); });
  const nextLabel = () => page.evaluate(() => document.getElementById('tourNext').textContent);
  const boxBefore = await nextBox(), labelBefore = await nextLabel();
  const before = await st();
  console.log('on the view step Next is locked until a view is chosen:', JSON.stringify(before), before.title === 'Choose your view' && before.nextDisabled && before.hint && before.selected === 0);
  await page.evaluate(() => nextTourStep()); await page.waitForTimeout(300);
  console.log('the keyboard / script cannot skip it either:', (await st()).title === 'Choose your view');
  console.log('before a view is chosen the button says Select view:', JSON.stringify(labelBefore), labelBefore === 'Select view');
  await page.click('.tour-view-tab[data-view="compact"]'); await page.waitForTimeout(300);
  const boxAfter = await nextBox(), labelAfter = await nextLabel();
  console.log('then it says Next, in exactly the same place and size:', labelAfter, boxBefore, boxAfter, labelAfter === 'Next' && boxBefore === boxAfter);
  const after = await st();
  console.log('choosing a view unlocks Next and highlights it:', JSON.stringify(after), !after.nextDisabled && !after.hint && after.selected === 1 && (await page.evaluate(() => summaryViewMode)) === 'compact');
  await page.click('#tourNext'); await page.waitForTimeout(500);
  console.log('and Next moves on:', (await st()).title);
  await page.click('#tourBack'); await page.waitForTimeout(500);
  console.log('coming back, the choice stays and Next is open:', JSON.stringify(await st()));
  const h = await page.evaluate(() => { const t = document.querySelector('.tour-view-tabs'), b = t.querySelector('.tour-view-tab.on'); const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect(), cr = b.parentElement.getBoundingClientRect(); return { top: Math.round(br.top - tr.top), bottom: Math.round(tr.bottom - br.bottom), cellFilled: Math.abs(br.height - cr.height) < 1 && Math.abs(br.width - cr.width) <= 3 }; });
  console.log('the chosen card fills its cell:', JSON.stringify(h), h.cellFilled);
  // a tapped button stays "hovered" on a phone: that must not lift it or add a glow
  const look = () => page.evaluate(() => { const b = document.querySelector('.tour-view-tab.on'); const c = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { transform: cs.transform, shadow: cs.boxShadow, top: Math.round(r.top - c.top), bottom: Math.round(c.bottom - r.bottom) }; });
  const rest = await look();
  await page.hover('.tour-view-tab.on'); await page.waitForTimeout(300);
  const hov = await look();
  console.log('hovering or tapping the chosen tab does not lift it or add a glow:', JSON.stringify(hov), hov.transform === 'none' && hov.shadow === 'none' && hov.top === rest.top && hov.bottom === rest.bottom);
  await page.hover('.tour-view-tab:not(.on)'); await page.waitForTimeout(300);
  console.log('and a hovered, unchosen tab is not turned gold:', await page.evaluate(() => { const b = document.querySelector('.tour-view-tab:not(.on):hover'); return b ? getComputedStyle(b).backgroundColor : 'n/a'; }));
  // the choices stay put whichever picture is showing
  for (const [w, h] of [[390, 700], [320, 480], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
    const spots = [];
    for (const mode of ['compact', 'classic', 'simple', 'compact']) {
      await page.evaluate(m => tourPickView(m), mode); await page.waitForTimeout(450);
      spots.push(await page.evaluate(() => { const t = document.querySelector('.tour-view-tabs').getBoundingClientRect(), pts = document.querySelector('.tour-view-points:not([hidden])').getBoundingClientRect(), img = document.querySelector('.tour-view-pic:not([hidden]) img').getBoundingClientRect(); return { tabs: Math.round(t.top), points: Math.round(pts.top), pic: Math.round(img.height) }; }));
    }
    const still = spots.every(p => Math.abs(p.tabs - spots[0].tabs) <= 1 && Math.abs(p.points - spots[0].points) <= 1);
    console.log(`the view choices do not move when the picture changes at ${w}x${h}:`, JSON.stringify(spots), still);
  }
  // choosing a view must not move the cards either (the hint above the highlights keeps its line)
  await page.setViewportSize({ width: 390, height: 700 }); await page.waitForTimeout(400);
  await page.evaluate(() => { endTour(); localStorage.removeItem('summaryViewMode'); startTour(); showTourStep(3); }); await page.waitForTimeout(900);
  const cardsTop = () => page.evaluate(() => Math.round(document.querySelector('.tour-view-tabs').getBoundingClientRect().top));
  const t0 = await cardsTop();
  await page.click('.tour-view-tab[data-view="classic"]'); await page.waitForTimeout(500);
  const t1 = await cardsTop();
  console.log('the cards stay put when a view is chosen:', t0, t1, Math.abs(t0 - t1) <= 1);
  // the pulsing glow (up to 5px) has room on both sides: nothing is cut off by the scrolling area
  const room = await page.evaluate(() => { const b = document.getElementById('tourBody').getBoundingClientRect(); const cells = [...document.querySelectorAll('.tour-view-cell')].map(c => c.getBoundingClientRect()); return { left: Math.round(cells[0].left - b.left), right: Math.round(b.right - cells[cells.length - 1].right) }; });
  console.log('the glow has room on both sides:', JSON.stringify(room), room.left >= 6 && room.right >= 6);
  // order, and no small/big screen labels on the cards themselves
  const order = await page.evaluate(() => ({ tour: [...document.querySelectorAll('.tour-view-tab')].map(b => b.dataset.view), menu: [...document.querySelectorAll('#summaryViewSwitch .view-switch-btn')].map(b => b.dataset.view), captions: document.querySelectorAll('.tour-view-tab small').length, labels: [...document.querySelectorAll('.tour-view-tab')].map(b => b.textContent.trim()) }));
  console.log('the views are ordered Compact, Classic, Jumbo (tour and menu):', JSON.stringify(order.tour), JSON.stringify(order.menu), order.tour.join() === 'compact,classic,simple' && order.menu.join() === 'compact,classic,simple');
  console.log('the cards carry just the name (no small / big screen labels):', JSON.stringify(order.labels), order.captions === 0 && order.labels.join() === 'Compact,Classic,Jumbo');
  console.log('errors', errors);
  await browser.close();
})();
