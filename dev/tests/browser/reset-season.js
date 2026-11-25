// Reset season (any year): the button on every year's row, the typed-year confirmation with its WARNING for years with results or in the past,
// what it deletes and keeps, and the unchanged results lock on Clear predictions / Remove (see js/years-admin.js, Storage.resetSeason)
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
  const errors = []; let promptAnswer = null; const prompts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { if (d.type() === 'prompt') { prompts.push(d.message()); if (promptAnswer === null) await d.dismiss(); else await d.accept(promptAnswer); } else { await d.accept(); } });
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path); await page.waitForTimeout(900);
  const db = (k) => page.evaluate((k) => JSON.parse(JSON.stringify(__db[k] || [])), k);
  const rows = (year) => page.evaluate((y) => ({
    matches: __db.matches.filter(m => m.year === y).length,
    predictions: __db.predictions.filter(p => { const m = __db.matches.find(x => x.id === p.match_id); return m && m.year === y; }).length,
    jokers: __db.user_joker_selections.filter(j => { const m = __db.matches.find(x => x.id === j.match_id); return m && m.year === y; }).length,
    tries: __db.user_tries.filter(t => t.year === y).length,
    rules: __db.scoring_rules.filter(r => r.year === y).length,
    tiers: __db.scoring_close_tiers.filter(r => r.year === y).length,
    settings: __db.settings.filter(s => s.key.endsWith(':' + y)).map(s => s.key).sort(),
  }), year);
  const feedback = () => page.evaluate(() => (document.getElementById('yearsFeedback') || {}).textContent || '');
  const yearRow = (y) => page.evaluate((y) => { const r = [...document.querySelectorAll('#yearsListContainer tbody tr')].find(x => x.innerText.includes(String(y))); return r ? { text: r.innerText.replace(/\s+/g, ' ').trim(), reset: !!r.querySelector('button[onclick^="resetSeasonForYear"]'), clear: !!r.querySelector('button[onclick^="clearYearPredictions"]'), remove: !!r.querySelector('button[onclick^="removeYear"]') } : null; }, y);

  // give 2027 a result, rules, a tier, a lock and other per-year settings so the reset has everything to remove
  await page.evaluate(() => {
    __db.settings.push({ key: 'predictions_locked:2027', value: 'true' }, { key: 'rules_saved:2027', value: '2026-11-01T00:00:00Z' }, { key: 'prize_saved:2027', value: '2026-11-01T00:00:00Z' }, { key: 'active_overrides:2027', value: '{"ben":true}' }, { key: 'prize_exempt:2027', value: '{"sam":true}' });
    __db.scoring_rules.push({ id: 2, year: 2027, correct_result_points: 3, perfect_score_bonus: 3, draw_bonus: 2, max_jokers_per_user: 1, entry_fee_amount: 10, payout_first_pct: 100, payout_second_pct: 0, payout_third_pct: 0, payout_closest_tries_pct: 0 });
    __db.scoring_close_tiers.push({ id: 2, year: 2027, tier_order: 1, within_points: 5, bonus_points: 1 });
    const m = __db.matches.find(x => x.id === 3); m.actual_score1 = 20; m.actual_score2 = 10; m.actual_tries1 = 2; m.actual_tries2 = 1;
  });
  await page.evaluate(() => switchYear(2027)); await page.waitForTimeout(700);
  await page.click('button[onclick="showTab(\'adminHome\')"]');
  await page.click('button[onclick="showTab(\'years\')"]'); await page.waitForTimeout(500);

  // 1. Reset season is on every year's row, including the ones with results; the results lock on Clear/Remove is as it was
  const r26 = await yearRow(2026), r27 = await yearRow(2027);
  console.log('Reset season is offered on every year (2026 and 2027, both have results/predictions):', r26.reset && r27.reset, JSON.stringify([r26.text, r27.text]));
  console.log('the results lock is unchanged: "Results entered: locked", no Clear predictions or Remove on a year with results:', /Results entered: locked/.test(r27.text) && !r27.clear && !r27.remove && !r26.clear && !r26.remove);
  console.log('there is no Trial run control or banner any more:', await page.evaluate(() => !/Trial run/.test(document.body.textContent) && !document.getElementById('trialBanner')));
  console.log('the lock still holds at the storage layer (clear/remove refuse on a year with results):', JSON.stringify(await page.evaluate(async () => [await Storage.clearSeasonPredictions(2027), await Storage.removeSeason(2027)])) === '[false,false]');
  const fit = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, table: (() => { const e = document.getElementById('yearsListContainer'); return e.scrollWidth > e.clientWidth + 1; })() }));
  console.log('no sideways overflow at 390px with the extra button:', !fit.page && !fit.table, JSON.stringify(fit));

  // 2. a wrong or cancelled typed year changes nothing
  const before27 = await rows(2027), before26 = await rows(2026);
  promptAnswer = '2026';
  await page.evaluate(() => resetSeasonForYear(2027)); await page.waitForTimeout(400);
  console.log('wrong year typed: nothing changes and it says so:', /did not match/.test(await feedback()) && JSON.stringify(await rows(2027)) === JSON.stringify(before27));
  promptAnswer = null;
  await page.evaluate(() => resetSeasonForYear(2027)); await page.waitForTimeout(300);
  console.log('cancelled prompt: nothing changes:', JSON.stringify(await rows(2027)) === JSON.stringify(before27));

  // 3. the confirmation text: lists what is deleted and what is kept, with a strong warning when results exist or the year is past
  const text = prompts[prompts.length - 1] || '';
  console.log('the prompt lists what is deleted and kept and asks to type the year:', /fixture/.test(text) && /prediction/.test(text) && /scoring and prize rules/.test(text) && /Kept: the year itself, competitors/.test(text) && /Type 2027 to confirm/.test(text));
  console.log('2027 has results: the prompt carries the strong WARNING and points to Database Recovery:', /WARNING: 2027 has 1 result entered/.test(text) && /permanently lost/.test(text) && /Database Recovery/.test(text), JSON.stringify(text.match(/WARNING[^\n]*/)));
  await page.evaluate(() => { __db.matches.find(x => x.id === 3).actual_score1 = null; __db.matches.find(x => x.id === 3).actual_score2 = null; });
  promptAnswer = null;
  await page.evaluate(() => { appNow = () => new Date(2027, 5, 1); }); await page.evaluate(() => resetSeasonForYear(2026)); await page.waitForTimeout(300);
  const textPast = prompts[prompts.length - 1] || '';
  console.log('a past year (2026 when it is 2027) also gets the WARNING:', /WARNING: 2026 /.test(textPast) && /past year/.test(textPast), JSON.stringify(textPast.match(/WARNING[^\n]*/)));
  await page.evaluate(() => { appNow = () => new Date(2026, 10, 25); });
  await page.evaluate(() => { const m = __db.matches.find(x => x.id === 3); m.actual_score1 = null; m.actual_score2 = null; });
  promptAnswer = null;
  await page.evaluate(() => resetSeasonForYear(2027)); await page.waitForTimeout(300);
  console.log('a current year with no results gets no WARNING line:', !/WARNING/.test(prompts[prompts.length - 1] || ''));

  // 4. reset 2027 for real
  console.log('before the reset 2027 has everything:', before27.matches === 1 && before27.predictions === 1 && before27.jokers === 1 && before27.tries === 1 && before27.rules === 1 && before27.tiers === 1, JSON.stringify(before27));
  promptAnswer = '2027';
  await page.evaluate(() => resetSeasonForYear(2027)); await page.waitForTimeout(900);
  const after27 = await rows(2027);
  console.log('reset: fixtures, predictions, jokers, tries, rules, tiers and every per-year setting are gone:', after27.matches === 0 && after27.predictions === 0 && after27.jokers === 0 && after27.tries === 0 && after27.rules === 0 && after27.tiers === 0 && after27.settings.length === 0, JSON.stringify(after27));
  console.log('reset: the year, the competitors, admins and 2026 are untouched:', JSON.stringify(await rows(2026)) === JSON.stringify(before26) && (await db('seasons')).some(s => s.year === 2027) && (await db('users')).length === 4 && (await db('admin_usernames')).length === 1);
  console.log('reset: success message and the row now offers Remove (nothing left in 2027):', /has been reset/.test(await feedback()) && (await yearRow(2027)).remove, JSON.stringify((await yearRow(2027)).text));
  const st = await page.evaluate(() => ({ matches: matches.length, all2027: allMatches.filter(m => m.year === 2027).length, rules: appSettings.rulesSavedAt, prize: appSettings.prizeSavedAt, locked: appSettings.predictionsLocked }));
  console.log('reset: the app state is reloaded (no 2027 fixtures in memory, rules/prize not saved, not locked):', st.matches === 0 && st.all2027 === 0 && st.rules === null && st.prize === null && st.locked === false, JSON.stringify(st));

  // 5. a year that is not the one being viewed can be reset too (2026, with a result): wipes only 2026
  promptAnswer = '2026';
  await page.evaluate(() => resetSeasonForYear(2026)); await page.waitForTimeout(900);
  const after26 = await rows(2026);
  console.log('reset 2026 (not the viewed year): 2026 is empty, 2027 untouched, competitors kept:', after26.matches === 0 && after26.predictions === 0 && after26.tries === 0 && after26.rules === 0 && (await db('users')).length === 4 && (await db('seasons')).length === 2, JSON.stringify(after26));
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
