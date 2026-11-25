// Trial run (per year): the flag, the banner for everyone, the lifted results lock, and Reset season (see js/years-admin.js, Storage.setTrial / resetSeason)
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
  const errors = []; let promptAnswer = null; let confirmAnswer = true; const dialogs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { dialogs.push(d.type() + ': ' + d.message().split('\n')[0]); if (d.type() === 'confirm') { confirmAnswer ? await d.accept() : await d.dismiss(); } else if (promptAnswer === null) { await d.dismiss(); } else { await d.accept(promptAnswer); } });
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
  const yearRow = (y) => page.evaluate((y) => { const r = [...document.querySelectorAll('#yearsListContainer tbody tr')].find(x => x.innerText.includes(String(y))); return r ? { text: r.innerText.replace(/\s+/g, ' ').trim(), reset: !!r.querySelector('button[onclick^="resetSeasonForTrial"]'), trialBtn: (r.querySelector('button[onclick^="toggleTrialRun"]') || {}).textContent } : null; }, y);
  const banner = () => page.evaluate(() => { const b = document.getElementById('trialBanner'); return { shown: !!b && b.offsetParent !== null, text: b ? b.textContent : '' }; });

  // 2027: viewing; give it a result, a rule row, a tier, a lock and other per-year settings so the reset has everything to remove
  await page.evaluate(() => {
    __db.settings.push({ key: 'predictions_locked:2027', value: 'true' }, { key: 'rules_saved:2027', value: '2026-11-01T00:00:00Z' }, { key: 'prize_saved:2027', value: '2026-11-01T00:00:00Z' }, { key: 'active_overrides:2027', value: '{"ben":true}' }, { key: 'prize_exempt:2027', value: '{"sam":true}' });
    __db.scoring_rules.push({ id: 2, year: 2027, correct_result_points: 3, perfect_score_bonus: 3, draw_bonus: 2, max_jokers_per_user: 1, entry_fee_amount: 10, payout_first_pct: 100, payout_second_pct: 0, payout_third_pct: 0, payout_closest_tries_pct: 0 });
    __db.scoring_close_tiers.push({ id: 2, year: 2027, tier_order: 1, within_points: 5, bonus_points: 1 });
    const m = __db.matches.find(x => x.id === 3); m.actual_score1 = 20; m.actual_score2 = 10; m.actual_tries1 = 2; m.actual_tries2 = 1;
  });
  await page.evaluate(() => switchYear(2027)); await page.waitForTimeout(700);
  await page.click('button[onclick="showTab(\'adminHome\')"]');
  await page.click('button[onclick="showTab(\'years\')"]'); await page.waitForTimeout(500);

  // 1. trial OFF: the results lock holds (UI and storage), no banner, Reset season not offered
  let r27 = await yearRow(2027);
  console.log('trial off: Results entered: locked, button reads Trial run: OFF, no Reset season:', /locked/.test(r27.text) && r27.trialBtn === 'Trial run: OFF' && !r27.reset, JSON.stringify(r27.text));
  promptAnswer = '2027';
  await page.evaluate(() => clearYearPredictions(2027)); await page.waitForTimeout(300);
  console.log('trial off: clearing predictions is refused:', /results entered/.test(await feedback()) && (await rows(2027)).predictions === 1);
  console.log('trial off: storage.resetSeason / clearSeasonPredictions / removeSeason all refuse:', JSON.stringify(await page.evaluate(async () => [await Storage.resetSeason(2027), await Storage.clearSeasonPredictions(2027), await Storage.removeSeason(2027)])) === '[false,false,false]');
  console.log('trial off: no banner:', !(await banner()).shown);

  // 2. cancel the confirmation: still off
  confirmAnswer = false;
  await page.click('tr:has-text("2027") button[onclick^="toggleTrialRun"]'); await page.waitForTimeout(300);
  console.log('cancelling the Trial run confirmation changes nothing:', !(await banner()).shown && (await db('settings')).every(s => !s.key.startsWith('trial:')));

  // 3. switch trial ON: banner for everyone, lock lifted, Reset season offered
  confirmAnswer = true;
  await page.click('tr:has-text("2027") button[onclick^="toggleTrialRun"]'); await page.waitForTimeout(500);
  r27 = await yearRow(2027); const b = await banner();
  console.log('trial on: banner shown with the year and the wording:', b.shown && /Trial run for 2027/.test(b.text) && /wiped before the real season/.test(b.text), JSON.stringify(b.text));
  console.log('trial on: setting row saved, lock hint gone, Reset season and Clear predictions offered, button reads ON:', (await db('settings')).some(s => s.key === 'trial:2027' && s.value === 'true') && !/Results entered: locked/.test(r27.text) && r27.reset && r27.trialBtn === 'Trial run: ON' && /Clear predictions/.test(r27.text), JSON.stringify(r27.text));
  const fit = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, banner: (() => { const e = document.getElementById('trialBanner'); return e.scrollWidth > e.clientWidth + 1; })() }));
  console.log('trial on: no sideways overflow at 390px:', !fit.page && !fit.banner, JSON.stringify(fit));
  await page.click('button[onclick="showTab(\'summary\')"]'); await page.waitForTimeout(300);
  console.log('the banner shows on the main (summary) screen too:', (await banner()).shown);
  await page.evaluate(() => { renderReadinessChecklist(); }); await page.waitForTimeout(200);
  console.log('the Setup checklist shows the trial reminder:', await page.evaluate(() => /Trial run: remember to Reset season/.test(document.body.textContent)));

  // 4. 2026 is not a trial: still locked
  console.log('2026 (not a trial) stays locked at the storage layer:', JSON.stringify(await page.evaluate(async () => [await Storage.clearSeasonPredictions(2026), await Storage.removeSeason(2026)])) === '[false,false]');
  const before26 = await rows(2026);

  // 5. reset with the wrong year typed: nothing changes
  await page.click('button[onclick="showTab(\'adminHome\')"]'); await page.click('button[onclick="showTab(\'years\')"]'); await page.waitForTimeout(300);
  const before27 = await rows(2027);
  promptAnswer = '2026';
  await page.evaluate(() => resetSeasonForTrial(2027)); await page.waitForTimeout(400);
  console.log('reset with the wrong year typed does nothing:', /did not match/.test(await feedback()) && JSON.stringify(await rows(2027)) === JSON.stringify(before27));
  promptAnswer = null;
  await page.evaluate(() => resetSeasonForTrial(2027)); await page.waitForTimeout(300);
  console.log('cancelling the typed-year prompt does nothing:', JSON.stringify(await rows(2027)) === JSON.stringify(before27));

  // 6. reset for real
  console.log('before the reset 2027 has everything:', before27.matches === 1 && before27.predictions === 1 && before27.jokers === 1 && before27.tries === 1 && before27.rules === 1 && before27.tiers === 1, JSON.stringify(before27));
  promptAnswer = '2027';
  await page.evaluate(() => resetSeasonForTrial(2027)); await page.waitForTimeout(900);
  const after27 = await rows(2027);
  console.log('reset: 2027 fixtures, predictions, jokers, tries, rules, tiers and every per-year setting but the trial flag are gone:', after27.matches === 0 && after27.predictions === 0 && after27.jokers === 0 && after27.tries === 0 && after27.rules === 0 && after27.tiers === 0 && JSON.stringify(after27.settings) === JSON.stringify(['trial:2027']), JSON.stringify(after27));
  console.log('reset: the year, the competitors, admins and 2026 are untouched:', JSON.stringify(await rows(2026)) === JSON.stringify(before26) && (await db('seasons')).some(s => s.year === 2027) && (await db('users')).length === 4 && (await db('admin_usernames')).length === 1);
  console.log('reset: success message, banner still on, row still trial:', /has been reset/.test(await feedback()) && (await banner()).shown && /Trial run: ON/.test((await yearRow(2027)).text));
  const st = await page.evaluate(() => ({ matches: matches.length, all2027: allMatches.filter(m => m.year === 2027).length, rules: appSettings.rulesSavedAt, prize: appSettings.prizeSavedAt }));
  console.log('reset: the app state is reloaded (no 2027 fixtures in memory, rules/prize not saved):', st.matches === 0 && st.all2027 === 0 && st.rules === null && st.prize === null, JSON.stringify(st));

  // 7. trial OFF again: banner goes, Reset season no longer offered, the lock rules are back
  await page.click('tr:has-text("2027") button[onclick^="toggleTrialRun"]'); await page.waitForTimeout(500);
  const off = await yearRow(2027);
  console.log('trial off again: banner gone, no Reset season, flag removed:', !(await banner()).shown && !off.reset && off.trialBtn === 'Trial run: OFF' && (await db('settings')).every(s => !s.key.startsWith('trial:')), JSON.stringify(off.text));
  console.log('and a reset is refused again at the storage layer:', await page.evaluate(async () => (await Storage.resetSeason(2027)) === false));
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
