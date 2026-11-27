// Years tab: one collapsed card per year (newest first), the viewed year highlighted, no View button and no blurb, the open state kept across re-renders
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
      {id:1,username:'ben',nickname:'Ben',supported_teams:null},
      {id:2,username:'sam',nickname:'Sam',supported_teams:null},
      {id:3,username:'newbie',nickname:'Newbie',supported_teams:null},
      {id:4,username:'only27',nickname:'Only27',supported_teams:null}
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
    usage_events: []
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
  const session = {user:{id:'u1',email:'ben@example.com'}};
  window.supabase = { createClient: () => ({
    from: builder,
    rpc: async (name) => name === 'check_login_email' ? {data: !window.__emailFree, error: null} : name === 'login_admin_names' ? {data: [], error: null} : name==='my_competitor' ? {data:[{username:'ben',nickname:'Ben'}],error:null} : name==='admin_list_accounts' ? {data:[],error:null} : {data:null,error:null},
    auth: { onAuthStateChange(cb){ setTimeout(()=>cb('INITIAL_SESSION', session),0); return {data:{subscription:{}}}; }, getSession: async()=>({data:{session}}), signInWithOtp: async()=>({error:null}), signOut: async()=>({error:null}) }
  })};
})();`;


(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
  const errors = []; let promptAnswer = null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { if (d.type() === 'prompt') { if (promptAnswer === null) await d.dismiss(); else await d.accept(promptAnswer); } else { await d.accept(); } });
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path); await page.waitForTimeout(900);
  await page.evaluate(() => switchYear(2027)); await page.waitForTimeout(700);
  await page.click('button[onclick="showTab(\'adminHome\')"]');
  await page.click('button[onclick="showTab(\'years\')"]'); await page.waitForTimeout(500);

  const cards = () => page.evaluate(() => [...document.querySelectorAll('#yearsListContainer details.year-card')].map(d => ({
    year: Number(d.dataset.year), open: d.open, active: d.classList.contains('year-card-active'),
    summary: d.querySelector('summary').textContent.replace(/\s+/g, ' ').trim(),
    stats: d.querySelector('.year-card-stats').textContent.trim(),
    badge: !!d.querySelector('summary .admin-badge'),
    bodyVisible: (() => { const b = d.querySelector('.year-card-body'); return typeof b.checkVisibility === 'function' ? b.checkVisibility({ contentVisibilityAuto: true }) : b.getBoundingClientRect().height > 0; })(),
    buttons: [...d.querySelectorAll('.year-card-body button')].map(b => b.textContent.trim()),
    details: d.querySelector('.year-card-details').textContent.replace(/\s+/g, ' ').trim(),
  })));

  // 1. collapsed by default, newest first, only the viewed year highlighted and badged
  let c = await cards();
  console.log('one card per year, newest first (2027, 2026), all collapsed by default:', JSON.stringify(c.map(x => x.year)) === '[2027,2026]' && c.every(x => !x.open && !x.bodyVisible), JSON.stringify(c.map(x => [x.year, x.open])));
  console.log('only the viewed year (2027) has the highlight class and the Viewing badge in its collapsed summary:', c[0].active && c[0].badge && !c[1].active && !c[1].badge, JSON.stringify(c.map(x => [x.year, x.active, x.badge])));
  console.log('the collapsed summary shows the year and a one-line stats summary:', /^2027 Viewing/.test(c[0].summary) && c[0].stats === '1 fixture · 1 prediction' && c[1].stats === '2 fixtures · 1 result · 3 predictions', JSON.stringify(c.map(x => x.stats)));
  console.log('no View button anywhere on the Years tab, and the explanatory blurb is gone:', await page.evaluate(() => ![...document.querySelectorAll('#yearsTab button')].some(b => b.textContent.trim() === 'View') && !/A year with results entered is locked/.test(document.getElementById('yearsTab').textContent) && !document.querySelector('#yearsListContainer .profile-hint:not(.year-card-body .profile-hint)')));

  // 2. the highlight is visible: an accent border and a tint that the other card does not have, in light and dark
  const look = () => page.evaluate(() => { const a = document.querySelector('details.year-card-active'), o = document.querySelector('details.year-card:not(.year-card-active)'); const s = (e) => { const c = getComputedStyle(e); return { border: c.borderTopColor, width: c.borderTopWidth, bg: c.backgroundColor }; }; return { a: s(a), o: s(o) }; });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme); await page.waitForTimeout(200);
    const l = await look();
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const gold = rgb(l.a.border);
    // the theme's accent: gold in the dark theme, the app's green in the light theme (its --bright-gold is green there)
    const accentOk = theme === 'dark' ? (gold[0] > 150 && gold[1] > 120 && gold[2] < 130) : (gold[1] > gold[0] && gold[1] > gold[2]);
    console.log(theme + ': the viewed year card has a thicker accent border and a different (tinted) background from the others:', parseFloat(l.a.width) > parseFloat(l.o.width) && accentOk && l.a.border !== l.o.border && l.a.bg !== l.o.bg, JSON.stringify(l));
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // 3. opening a card shows the stats and the buttons
  await page.click('details.year-card[data-year="2026"] summary'); await page.waitForTimeout(300);
  c = await cards();
  console.log('opening 2026 shows Fixtures / Results entered / Predictions and its buttons (Results entered: locked hint, Reset season; no Clear/Remove):', c[1].open && c[1].bodyVisible && /Fixtures\s*2/.test(c[1].details) && /Results entered\s*1/.test(c[1].details) && /Predictions\s*3 from 2 competitors, 1 tries/.test(c[1].details) && c[1].buttons.includes('Reset season') && !c[1].buttons.includes('Clear predictions') && !c[1].buttons.includes('Remove'), JSON.stringify([c[1].details, c[1].buttons]));
  console.log('opening one card leaves the other closed:', !c[0].open);

  // 4. the open state survives a reset of another year's... of its own card: reset 2027 while 2027 is open
  await page.click('details.year-card[data-year="2027"] summary'); await page.waitForTimeout(300);
  promptAnswer = '2027';
  await page.evaluate(() => resetSeasonForYear(2027)); await page.waitForTimeout(900);
  c = await cards();
  console.log('after Reset season the cards the admin had open (2027 and 2026) are still open:', c.every(x => x.open), JSON.stringify(c.map(x => [x.year, x.open])));
  console.log('the reset card now says "No fixtures yet" and offers Remove:', c[0].stats === 'No fixtures yet' && c[0].buttons.includes('Remove'), JSON.stringify([c[0].stats, c[0].buttons]));
  await page.click('details.year-card[data-year="2026"] summary'); await page.waitForTimeout(200);
  c = await cards();
  console.log('closing a card keeps it closed across a re-render:', !c[1].open && c[0].open, JSON.stringify(c.map(x => [x.year, x.open])));
  await page.evaluate(() => renderYearsTab()); await page.waitForTimeout(500);
  c = await cards();
  console.log('(re-render) 2027 still open, 2026 still closed:', c[0].open && !c[1].open);

  // 5. switching year with the header dropdown moves the highlight
  await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(700);
  await page.click('button[onclick="showTab(\'adminHome\')"]').catch(() => {});
  await page.click('button[onclick="showTab(\'years\')"]').catch(() => {}); await page.waitForTimeout(500);
  c = await cards();
  console.log('viewing 2026 moves the highlight and the badge to the 2026 card:', c[1].active && c[1].badge && !c[0].active && !c[0].badge, JSON.stringify(c.map(x => [x.year, x.active, x.badge])));

  // 6. everything open at 390px: no sideways overflow
  await page.evaluate(() => document.querySelectorAll('#yearsListContainer details.year-card').forEach(d => { d.open = true; })); await page.waitForTimeout(300);
  const fit = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, box: (() => { const e = document.getElementById('yearsListContainer'); return e.scrollWidth > e.clientWidth + 1; })() }));
  console.log('no sideways overflow at 390px with every card open:', !fit.page && !fit.box, JSON.stringify(fit));
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
