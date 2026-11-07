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
  const page = await browser.newPage();
  const errors = [], dialogs = [];
  let promptAnswer = null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { dialogs.push(d.type().toUpperCase()+': '+d.message().split('\n')[0]); await d.accept(d.type()==='prompt' ? promptAnswer : undefined); });
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path);
  await page.waitForTimeout(Math.min(900, 40));
  const db = (k) => page.evaluate((k)=>JSON.stringify(__db[k]), k);
  const ui = () => page.evaluate(() => ({ table:[...document.querySelectorAll('#yearsListContainer tbody tr')].map(r=>({ text:r.innerText.replace(/\s+/g,' ').trim(), removeDisabled: r.querySelector('button.btn-danger').disabled })), feedback: document.getElementById('yearsFeedback').textContent }));



  const clickByText = (text) => page.evaluate((t) => { if (typeof setAdminPanelCollapsed === 'function' && document.querySelector('#adminPanel.collapsed') && [...document.querySelectorAll('#adminPanel .admin-tabs button')].some(b => b.textContent.trim() === t)) setAdminPanelCollapsed(false); [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.offsetParent !== null).click(); }, text);
  const checklist = () => page.evaluate(() => { const c = document.getElementById('readinessChecklist'); return { cls: c.className, title: (c.querySelector('.readiness-title')||{}).textContent, summary: (c.querySelector('.readiness-summary')||{}).textContent, items: [...c.querySelectorAll('.readiness-item')].map(i => (i.classList.contains('ok') ? '[x] ' : '[ ] ') + i.querySelector('.readiness-label').textContent + ' | ' + i.querySelector('.readiness-detail').textContent + (i.querySelector('button') ? ' | btn: ' + i.querySelector('button').textContent : '')) }; });
  const settings = () => page.evaluate(() => JSON.stringify(__db.settings));

  await clickByText('Admin Functions');
  console.log('1 initial', JSON.stringify(await checklist(), null, 1));

  // fixtures: 2027 has 1 fixture already; import 14 more -> 15
  await clickByText('Fixtures and Scores');
  const lines = [];
  const teams = ['England','France','Ireland','Italy','Scotland','Wales'];
  for (let i = 0; i < 14; i++) lines.push(`${1 + Math.floor(i/3)}, ${String(1+i).padStart(2,'0')}/02/2027, 14:30, ${teams[i%6]}, ${teams[(i+1)%6]}`);
  await page.evaluate((txt) => { showBulkImport(); document.getElementById('bulkImportData').value = txt; }, lines.join('\n'));
  await page.evaluate(() => processBulkImport()); await page.waitForTimeout(Math.min(500, 40));
  console.log('2 after importing 14 fixtures:', (await checklist()).items[0]);

  // rules and prize via the real Save buttons
  await clickByText('Guesser Rules'); await page.waitForTimeout(Math.min(300, 40));
  await clickByText('Save Updated Rules'); await page.waitForTimeout(Math.min(500, 40));
  console.log('3 after saving rules:', (await checklist()).items.slice(2).join('  ||  '));
  console.log('  settings', await settings());
  await clickByText('Prize Fund'); await page.waitForTimeout(Math.min(300, 40));
  await clickByText('Save Updated Prize Rules'); await page.waitForTimeout(Math.min(500, 40));
  console.log('4 after saving prize:', (await checklist()).items.slice(2).join('  ||  '));

  // predictions: complete only27 for every fixture
  await page.evaluate(() => { matches.forEach(m => { users.only27.predictions[m.id] = {team1: 20, team2: 10}; }); users.only27.totalTries = 7; });
  await clickByText('Predictions'); await page.waitForTimeout(Math.min(300, 40));
  console.log('5 predictions row:', (await checklist()).items[1]);
  const visible = () => page.evaluate(() => { const c = document.getElementById('readinessChecklist'); return { hidden: c.classList.contains('hidden'), displayed: getComputedStyle(c).display !== 'none', html: c.innerHTML.length }; });
  console.log('6 all four done -> checklist:', JSON.stringify(await visible()));
  // something becomes outstanding again: it comes back
  await page.evaluate(() => { delete users.only27.predictions[matches[0].id]; renderReadinessChecklist(); });
  console.log('7 a prediction removed -> checklist:', JSON.stringify(await visible()), '|', (await checklist()).title, '|', (await checklist()).summary);
  await page.evaluate(() => { users.only27.predictions[matches[0].id] = {team1: 1, team2: 2}; renderReadinessChecklist(); });
  console.log('8 fixed again -> checklist:', JSON.stringify(await visible()));

  // lock toggle now lives on the Predictions tab
  const where = await page.evaluate(() => ({ inPredictions: !!document.querySelector('#scoreCorrectionsTab #lockToggle'), inFixtures: !!document.querySelector('#resultsTab #lockToggle'), label: document.querySelector('#scoreCorrectionsTab .lock-toggle strong').textContent, visible: document.getElementById('lockToggle').offsetParent !== null, active: document.getElementById('lockToggle').classList.contains('active') }));
  console.log('9 lock toggle location:', JSON.stringify(where));
  await page.click('#lockToggle'); await page.waitForTimeout(Math.min(400, 40));
  console.log('10 after click: active', await page.evaluate(() => document.getElementById('lockToggle').classList.contains('active')), '| settings', await settings());
  await clickByText('Fixtures and Scores');
  console.log('11 fixtures tab has no lock toggle visible:', await page.evaluate(() => !document.querySelector('#resultsTab #lockToggle')));
  console.log('pageerrors:', errors);
  await browser.close();
})();
