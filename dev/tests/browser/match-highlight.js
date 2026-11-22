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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { window.__noTourPrompts = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.clock.install({ time: new Date('2026-02-01T09:00:00') });
  await page.goto('file://' + path);
  const tick = async (ms) => { await page.clock.runFor(ms); };
  await tick(200);
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await tick(200);
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await tick(300);
  await page.evaluate((f) => { window.__db.matches = f.concat([{id:9,year:2027,round:1,date:'Fri, Feb 5',time:'20:10',team1:'England',team2:'Wales',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true}]); }, FIXTURES);
  await page.evaluate(() => switchYear(2026)); await tick(800);
  await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await tick(600);

  // which match columns carry the tint (header + body cells)
  const state = () => page.evaluate(() => {
    const T = '.summary-table:not(.summary-table-clone)';
    const heads = [...document.querySelectorAll(T + ' thead th.match-header-cell')];
    const rows = [...document.querySelectorAll(T + ' tbody tr')];
    const cols = heads.map((th, i) => {
      const hl = /match-col-(now|next)/.exec(th.className);
      return { i, kind: hl ? hl[1] : null, text: th.querySelector('.match-teams') ? th.querySelector('.match-teams').textContent.replace(/\s+/g, '') : '', sr: (th.querySelector('.sr-only') || {}).textContent || '' };
    });
    const tinted = document.querySelectorAll(T + ' td.match-col-now, ' + T + ' td.match-col-next').length;
    const perCol = heads.map((th, i) => rows.filter(r => { const tds = [...r.children].filter(c => c.tagName === 'TD' && !c.classList.contains('rank-col') && !c.classList.contains('competitor-name') && !c.classList.contains('pts-col') && !c.classList.contains('tries-col')); return tds[i] && /match-col-(now|next)/.test(tds[i].className); }).length);
    const clone = document.querySelectorAll('.summary-sticky-inner th.match-col-now, .summary-sticky-inner th.match-col-next').length;
    const f = (e) => e ? getComputedStyle(e).backgroundImage : null;
    const bgs = { th: f(document.querySelector(T + ' thead th.match-col-now, ' + T + ' thead th.match-col-next')), td: f(document.querySelector(T + ' td.match-col-now, ' + T + ' td.match-col-next')) };
    return { cols, rows: rows.length, tinted, perCol, clone, bgs, mode: summaryViewMode };
  });
  const setTime = async (iso) => { await page.clock.setFixedTime(new Date(iso)); await page.evaluate(() => { showSummary(); }); await tick(300); };
  const summarise = (s) => s.cols.filter(c => c.kind).map(c => c.kind + ':' + c.text).join(' | ') || 'none';
  const marked = (s) => s.cols.filter(c => c.kind);

  await page.evaluate(() => setSummaryView('compact')); await tick(400);

  // 1. nothing is in play: the next kick-off is Sat 7 Feb 14:10 (match 2); match 1 already has its result
  await setTime('2026-02-06T09:00:00');
  let s = await state();
  console.log('1 compact, before the next match:', summarise(s), '| rows tinted per column', JSON.stringify(s.perCol), JSON.stringify(s.bgs));
  console.log('1 only match 2 (ITA SCO) is "next"; every row of its column is tinted, the pinned header copy too, with a hidden "Next match" label:', marked(s).length === 1 && marked(s)[0].kind === 'next' && /ITA/.test(marked(s)[0].text) && s.perCol.filter(n => n === s.rows).length === 1 && s.clone === 1 && /Next match/.test(marked(s)[0].sr));
  console.log('1 the tint is a gradient layer, so cells keep their own colour:', /linear-gradient/.test(s.bgs.th || '') && /linear-gradient/.test(s.bgs.td || ''));

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-compact-light.png', clip: { x: 0, y: 150, width: 390, height: 520 } });

  // 2. kick-off has passed with no result yet: "now"
  await setTime('2026-02-07T14:30:00');
  s = await state();
  console.log('2 just after kick-off:', summarise(s));
  console.log('2 match 2 is "now" (in play), with a hidden "In play now" label:', marked(s).length === 1 && marked(s)[0].kind === 'now' && /ITA/.test(marked(s)[0].text) && /In play now/.test(marked(s)[0].sr));

  // 3. match 2 still has no result (within 3 hours) but match 3 has kicked off since: the latest kick-off in play wins
  await setTime('2026-02-07T17:00:00');
  s = await state();
  console.log('3 match 3 in play too:', summarise(s));
  console.log('3 the latest kick-off in play (match 3, ENG WAL) is highlighted, not the older one:', marked(s).length === 1 && /ENG/.test(marked(s)[0].text) && marked(s)[0].kind === 'now');

  // 4. over 3 hours after both kick-offs with no result entered: nothing is "now"; the next not-yet-started kick-off (two simultaneous matches on 14 Feb) is highlighted
  await setTime('2026-02-07T21:00:00');
  s = await state();
  console.log('4 results not entered, 3h+ later:', summarise(s));
  console.log('4 the two simultaneous 14 Feb matches are both "next":', marked(s).length === 2 && marked(s).every(c => c.kind === 'next') && marked(s).some(c => /IRE/.test(c.text)) && marked(s).some(c => /SCO/.test(c.text)));

  // 5. a result is entered for the match in play: the highlight moves to the next match when the summary redraws
  await setTime('2026-02-07T14:30:00');
  const before = summarise(await state());
  await page.evaluate(() => { const m = matches.find(x => x.id === 2); m.actualScore1 = 20; m.actualScore2 = 10; m.actualTries1 = 2; m.actualTries2 = 1; });
  await page.evaluate(() => { showSummaryIfChanged(); }); await tick(300);
  s = await state();
  console.log('5 before:', before, '| after the result for match 2 is in:', summarise(s));
  console.log('5 the highlight moves off match 2 to match 3 (16:40, not started yet, so "next"):', /^now:/.test(before) && /ITA/.test(before) && marked(s).length === 1 && marked(s)[0].kind === 'next' && /ENG/.test(marked(s)[0].text));

  // 6. the highlight follows the clock by itself: the once-a-minute check redraws it when the next match kicks off
  await page.evaluate(() => { const m = matches.find(x => x.id === 2); m.actualScore1 = null; m.actualScore2 = null; m.actualTries1 = null; m.actualTries2 = null; });
  await setTime('2026-02-07T14:00:00');
  s = await state();
  const t0 = summarise(s);
  await page.clock.setFixedTime(new Date('2026-02-07T14:20:00'));
  await page.clock.runFor(61 * 1000); await tick(300);
  s = await state();
  console.log('6 before the clock moved:', t0, '| a minute tick after kick-off:', summarise(s));
  console.log('6 the timer redraws the table by itself and the column becomes "now":', /^next:/.test(t0) && /^now:/.test(summarise(s)) && /ITA/.test(summarise(s)));

  // 7. Focus works too, in light and dark; Classic has none
  await setTime('2026-02-06T09:00:00');
  await page.evaluate(() => setSummaryView('simple')); await tick(400);
  s = await state();
  console.log('7 focus:', summarise(s), JSON.stringify(s.bgs));
  console.log('7 Focus highlights the same column, as a gradient layer:', s.mode === 'simple' && marked(s).length === 1 && /ITA/.test(marked(s)[0].text) && /linear-gradient/.test(s.bgs.td || ''));
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme); await tick(300);
    const bg = await page.evaluate(() => { const T = '.summary-table:not(.summary-table-clone)'; const o = (e) => getComputedStyle(e).backgroundImage; return { th: o(document.querySelector(T + ' thead th.match-col-next')), td: o(document.querySelector(T + ' td.match-col-next')), plain: o(document.querySelector(T + ' td.prediction-cell:not(.match-col-next)')) }; });
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-focus-' + theme + '.png', clip: { x: 0, y: 150, width: 390, height: 520 } });
    console.log('7 ' + theme + ' tint:', JSON.stringify(bg), 'tinted, the other columns are not:', /linear-gradient/.test(bg.th) && /linear-gradient/.test(bg.td) && bg.plain === 'none');
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await page.evaluate(() => setSummaryView('classic')); await tick(500);
  const classic = await page.evaluate(() => document.querySelectorAll('#summaryContainer .match-col-now, #summaryContainer .match-col-next').length);
  console.log('7 Classic has no highlighted column:', classic === 0);

  // 8. everything finished: nothing is highlighted
  await page.evaluate(() => setSummaryView('compact')); await tick(300);
  await page.evaluate(() => { matches.forEach(m => { m.actualScore1 = 20; m.actualScore2 = 10; m.actualTries1 = 2; m.actualTries2 = 1; }); });
  await setTime('2026-02-20T09:00:00');
  s = await state();
  console.log('8 all results in:', summarise(s), '- no highlighted column:', s.cols.every(c => !c.kind) && s.tinted === 0);

  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
