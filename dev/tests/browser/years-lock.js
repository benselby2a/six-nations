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
  await page.addInitScript(() => { window.__noTourPrompts = true; });
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
  const ui = () => page.evaluate(() => ({ table:[...document.querySelectorAll('#yearsListContainer tbody tr')].map(r=>({ text:r.innerText.replace(/\s+/g,' ').trim(), removeShown: !!r.querySelector('button.btn-danger') })), feedback: document.getElementById('yearsFeedback').textContent }));

  await page.click('button[onclick="showTab(\'adminHome\')"]');
  await page.click('button[onclick="showTab(\'years\')"]'); await page.waitForTimeout(Math.min(300, 40));
  console.log('1', JSON.stringify(await ui()));

  // locked year: 2026 has a result entered
  promptAnswer = '2026';
  await page.evaluate(() => clearYearPredictions(2026)); await page.waitForTimeout(Math.min(200, 40));
  console.log('1a clearYearPredictions(2026) ->', (await ui()).feedback);
  await page.evaluate(() => removeYear(2026)); await page.waitForTimeout(Math.min(200, 40));
  console.log('1b removeYear(2026) ->', (await ui()).feedback);
  console.log('1c storage.clearSeasonPredictions(2026) ->', await page.evaluate(() => Storage.clearSeasonPredictions(2026)), '| storage.removeSeason(2026) ->', await page.evaluate(() => Storage.removeSeason(2026)));
  console.log('1d 2026 data untouched: predictions', (JSON.parse(await db('predictions'))).filter(p=>p.match_id<3).length, 'jokers', (JSON.parse(await db('user_joker_selections'))).filter(j=>j.match_id<3).length, 'tries', (JSON.parse(await db('user_tries'))).filter(t=>t.year===2026).length, 'seasons', await db('seasons'));
  console.log('1e dialogs so far (no prompt expected):', JSON.stringify(dialogs));

  // 2. an empty year can be added and removed
  await page.fill('#newYearInput','2028'); await page.click('button[onclick="addYearFromAdmin()"]'); await page.waitForTimeout(Math.min(400, 40));
  console.log('2a 2028 row', JSON.stringify((await ui()).table[0]));
  promptAnswer = '2028';
  await page.click('tr:has-text("2028") button.btn-danger'); await page.waitForTimeout(Math.min(400, 40));
  console.log('2b after remove 2028:', (await ui()).feedback, '| seasons', await db('seasons'));

  // 3. a year with predictions cannot be removed (UI function and storage layer)
  promptAnswer = '2027';
  await page.evaluate(() => removeYear(2027)); await page.waitForTimeout(Math.min(200, 40));
  console.log('3a removeYear(2027) ->', (await ui()).feedback);
  console.log('3b storage.removeSeason(2026) ->', await page.evaluate(() => Storage.removeSeason(2026)));
  console.log('   still there: seasons', await db('seasons'), '| predictions', (JSON.parse(await db('predictions'))).length, '| matches', (JSON.parse(await db('matches'))).length);

  // 4. clear 2027 predictions (wrong confirmation first)
  promptAnswer = '2026';
  await page.click('tr:has-text("2027") button:has-text("Clear predictions")'); await page.waitForTimeout(Math.min(300, 40));
  console.log('4a wrong confirm ->', (await ui()).feedback, '| 2027 preds', (JSON.parse(await db('predictions'))).filter(p=>p.match_id===3).length);
  promptAnswer = '2027';
  await page.click('tr:has-text("2027") button:has-text("Clear predictions")'); await page.waitForTimeout(Math.min(500, 40));
  const t = (await ui()).table;
  console.log('4b cleared ->', (await ui()).feedback, JSON.stringify(t[0]), JSON.stringify(t[1]));
  console.log('   predictions', await db('predictions'));
  console.log('   jokers', await db('user_joker_selections'), '| tries', await db('user_tries'));
  console.log('   fixtures kept', await page.evaluate(()=>JSON.stringify(__db.matches.map(m=>[m.id,m.year]))), '| rules', await page.evaluate(()=>JSON.stringify(__db.scoring_rules.map(r=>r.year))));

  // 5. now 2027 can be removed; 2026 data untouched
  promptAnswer = '2027';
  await page.click('tr:has-text("2027") button.btn-danger'); await page.waitForTimeout(Math.min(800, 40));
  console.log('5 after removing 2027: seasons', await db('seasons'), '| year now', await page.evaluate(()=>selectedYear));
  console.log('   2026 intact: predictions', (JSON.parse(await db('predictions'))).length, 'tries', await db('user_tries'));
  console.log('dialogs:', dialogs);
  console.log('pageerrors:', errors);
  await browser.close();
})();
