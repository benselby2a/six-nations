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




(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path); await page.waitForTimeout(Math.min(800, 40));
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(150, 40));
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
  const promptShown = () => page.evaluate(() => !document.getElementById('tourPromptModal').classList.contains('hidden'));
  const adminPromptShown = () => page.evaluate(() => !document.getElementById('adminTourPromptModal').classList.contains('hidden'));
  const state = () => page.evaluate(() => {
    const card = document.getElementById('tourCard').getBoundingClientRect(); const img = document.querySelector('#tourBody img');
    return { open: document.body.classList.contains('tour-open'), count: document.getElementById('tourCount').textContent, title: document.getElementById('tourTitle').textContent,
      card: [Math.round(card.left), Math.round(card.top), Math.round(card.width)], inViewport: card.top >= 0 && card.bottom <= innerHeight + 1, image: img ? (img.complete && img.naturalWidth > 0) : null,
      marks: document.querySelectorAll('#tourBody .tour-mark').length, items: document.querySelectorAll('#tourBody .tour-items li').length,
      activeTab: (document.querySelector('.tabs .tab.active') || {}).textContent, scrollY: Math.round(scrollY), summaryVisible: !document.getElementById('summaryTab').classList.contains('hidden') };
  });

  // ---- first sign-in prompt ----
  console.log('first sign-in shows the prompt:', await promptShown(), JSON.stringify(await page.textContent('#tourPromptText')), '| stored:', await page.evaluate(() => localStorage.getItem('tourAnswered:ben')));
  await page.click('#tourPromptYes'); await page.waitForTimeout(500);
  console.log('Take the tour opens it (not remembered yet):', JSON.stringify(await page.evaluate(() => ({ open: document.body.classList.contains('tour-open'), prompt: !document.getElementById('tourPromptModal').classList.contains('hidden'), stored: localStorage.getItem('tourAnswered:ben') }))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => maybeOfferTour());
  console.log('left the tour half way, asked again:', await promptShown());
  await page.click('button:has-text("No thanks")'); await page.waitForTimeout(100);
  await page.evaluate(() => maybeOfferTour());
  console.log('after No thanks it does not come back:', !(await promptShown()), '| stored:', await page.evaluate(() => localStorage.getItem('tourAnswered:ben')));

  // ---- the tour itself: a fixed card, a picture with marks, numbered instructions, the live app untouched ----
  await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(500);
  await page.click('#avatarBtn'); await page.click('#menuHelpBtn'); await page.waitForTimeout(150);
  console.log('help shows tour button:', await page.evaluate(() => [...document.querySelectorAll('#globalHelpModal button')].map(b => b.textContent.trim())));
  await page.click('#globalHelpModal button:has-text("Take a tour")'); await page.waitForTimeout(400);
  const total = await page.evaluate(() => tourState.steps.length);
  const before = await state();
  const cards = new Set();
  for (let i = 0; i < total; i++) {
    const s = await state(); if (s.image !== null) cards.add(JSON.stringify(s.card));   // the text-only rules card is smaller by design
    console.log(JSON.stringify({ n: s.count, title: s.title, image: s.image, marks: s.marks, items: s.items, inViewport: s.inViewport }));
    if (i < total - 1) { await page.click('#tourNext'); await page.waitForTimeout(i === 0 ? 450 : 250); }
  }
  const after = await state();
  console.log('card never moved between picture steps (different positions):', cards.size, '| live app untouched (tab, scroll, screen):', after.activeTab === before.activeTab && after.scrollY === before.scrollY && after.summaryVisible);
  await page.click('#tourBack'); await page.waitForTimeout(150); console.log('back ->', (await state()).title);
  await page.click('#tourNext'); await page.waitForTimeout(150);
  await page.click('#tourNext'); await page.waitForTimeout(300);
  console.log('after Done:', JSON.stringify({ open: (await state()).open, remembered: await page.evaluate(() => localStorage.getItem('tourAnswered:ben')) }));
  await page.click('#avatarBtn'); await page.click('#menuHelpBtn'); await page.click('#globalHelpModal button:has-text("Take a tour")'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  console.log('Escape closes:', !(await state()).open);

  // ---- on an iPhone the tour ends with Add to Home Screen ----
  await page.evaluate(() => { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', configurable: true }); startTour(); });
  await page.waitForTimeout(300);
  const titles = await page.evaluate(() => tourState.steps.map(x => x.title));
  console.log('on an iPhone the tour has', titles.length, 'steps, last:', titles[titles.length - 1]);
  for (let i = 0; i < titles.length - 1; i++) { await page.click('#tourNext'); await page.waitForTimeout(i === 0 ? 450 : 80); }
  await page.waitForTimeout(450);
  console.log('Home Screen step explains the long press:', await page.evaluate(() => { const b = document.getElementById('tourBody'); return { text: /long press/i.test(b.textContent) && /Share/.test(b.textContent), noScroll: b.scrollHeight <= b.clientHeight + 2, title: document.getElementById('tourTitle').textContent }; }).then(JSON.stringify));
  await page.keyboard.press('Escape');

  // ---- the admin tour ----
  await page.click('button.tab:has-text("Admin Functions")'); await page.waitForTimeout(300);
  console.log('first time in the admin panel offers the tour:', await adminPromptShown());
  await page.click('#adminTourPromptYes'); await page.waitForTimeout(400);
  const adminSteps = await page.evaluate(() => tourState.steps.map(s => s.title));
  console.log('admin tour:', await page.evaluate(() => tourState.kind), adminSteps.length, 'steps:', adminSteps.join(' > '));
  for (let i = 0; i < adminSteps.length; i++) {
    const s = await state();
    console.log(JSON.stringify({ n: s.count, title: s.title, image: s.image, marks: s.marks, items: s.items }));
    if (i < adminSteps.length - 1) { await page.click('#tourNext'); await page.waitForTimeout(200); }
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  console.log('left half way, not remembered:', await page.evaluate(() => localStorage.getItem('adminTourAnswered:ben')), '| not re-offered on leaving:', !(await adminPromptShown()));
  await page.click('button.tab:has-text("Match Summary")'); await page.click('button.tab:has-text("Admin Functions")'); await page.waitForTimeout(300);
  console.log('offered again next time:', await adminPromptShown());
  await page.click('#adminTourPromptYes'); await page.waitForTimeout(300);
  for (let i = 0; i < adminSteps.length; i++) { await page.click('#tourNext'); await page.waitForTimeout(120); }
  console.log('finished, remembered:', await page.evaluate(() => localStorage.getItem('adminTourAnswered:ben')));
  await page.click('button.tab:has-text("Match Summary")'); await page.click('button.tab:has-text("Admin Functions")'); await page.waitForTimeout(300);
  console.log('not offered again:', !(await adminPromptShown()));
  await page.evaluate(() => { localStorage.removeItem('adminTourAnswered:ben'); });
  await page.click('button.tab:has-text("Match Summary")'); await page.click('button.tab:has-text("Admin Functions")'); await page.waitForTimeout(300);
  await page.click('#adminTourPromptModal button:has-text("No thanks")'); await page.waitForTimeout(150);
  console.log('No thanks remembered:', await page.evaluate(() => localStorage.getItem('adminTourAnswered:ben')));
  await page.click('.admin-panel-help-btn'); await page.waitForTimeout(150);
  console.log('admin help has the tour button:', await page.evaluate(() => [...document.querySelectorAll('#adminHelpModal button')].map(b => b.textContent.trim())));
  // ---- pictures are preloaded: each one is already loaded the moment its step opens ----
  await page.evaluate(() => { closeGlobalHelpModal(); closeAdminHelpModal(); startTour(); });
  await page.waitForTimeout(500);
  const loadedAtOnce = [];
  for (let i = 0; i < 5; i++) { await page.click('#tourNext'); loadedAtOnce.push(await page.evaluate(() => { const im = document.querySelector('#tourBody img'); return im ? im.complete && im.naturalWidth > 0 : null; })); }
  console.log('each picture is loaded as its step opens:', loadedAtOnce.join(','), '| preloaded images:', await page.evaluate(() => tourPreloaded.length));
  await page.keyboard.press('Escape');
  // ---- the card fits small and short screens (iPhone with its toolbars, landscape), top and bottom visible ----
  await page.evaluate(() => { closeAdminHelpModal(); closeGlobalHelpModal(); });
  await page.click('#avatarBtn'); await page.click('#menuHelpBtn'); await page.click('#globalHelpModal button:has-text("Take a tour")'); await page.waitForTimeout(250);
  for (const [w, h] of [[320, 480], [375, 553], [390, 664], [430, 760], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(450);
    let bad = 0; const pics = [];
    for (let i = 0; i < 6; i++) {
      const ok = await page.evaluate(() => { const c = document.getElementById('tourCard').getBoundingClientRect(); const hd = document.querySelector('.tour-head').getBoundingClientRect(); const n = document.getElementById('tourNext').getBoundingClientRect(); const b = document.getElementById('tourBody');
        return c.top >= 0 && c.bottom <= innerHeight + 1 && hd.top >= 0 && n.bottom <= innerHeight && c.left >= 0 && c.right <= innerWidth + 1 && b.scrollHeight <= b.clientHeight + 1; });
      if (!ok) bad++;
      if (true) pics.push(await page.evaluate(() => { const f = document.querySelector('#tourBody .tour-figure'); return f ? (f.style.display === 'none' ? 'hidden' : Math.round(f.getBoundingClientRect().height)) : 'text'; }));
      if (i < 5) { await page.click('#tourNext'); await page.waitForTimeout(i === 0 ? 450 : 80); }
    }
    for (let i = 0; i < 5; i++) { await page.click('#tourBack'); await page.waitForTimeout(i === 4 ? 450 : 30); }
    console.log(`fits with no scrolling at ${w}x${h}:`, bad === 0 && !pics.includes('hidden'), '| picture heights (first/last step):', pics.join(','), '| pictures all shown:', !pics.includes('hidden'));
  }
  // the admin tour too (picture hidden only where the screen is too short for picture and text together)
  await page.evaluate(() => { closeGlobalHelpModal(); startTour('admin'); });
  for (const [w, h] of [[375, 553], [390, 664], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(450);
    let bad = 0;
    for (let i = 0; i < 7; i++) {
      const ok = await page.evaluate(() => { const b = document.getElementById('tourBody'); const c = document.getElementById('tourCard').getBoundingClientRect(); return b.scrollHeight <= b.clientHeight + 2 && c.top >= 0 && c.bottom <= innerHeight + 1; });
      if (!ok) bad++;
      if (i < 6) { await page.click('#tourNext'); await page.waitForTimeout(320); }
    }
    for (let i = 0; i < 6; i++) { await page.click('#tourBack'); await page.waitForTimeout(60); }
    console.log(`admin tour fits with no scrolling at ${w}x${h}:`, bad === 0);
  }
  await page.keyboard.press('Escape');
  console.log('errors', errors);
  await browser.close();
})();
