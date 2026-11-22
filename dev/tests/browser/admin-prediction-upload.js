const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

const mock = `
(() => {
  const db = {
    seasons: [{year:2026},{year:2027}],
    matches: [
      {id:1,year:2026,round:1,date:'Thu, Feb 5',time:'20:10',team1:'France',team2:'Ireland',actual_score1:30,actual_score2:20,actual_tries1:4,actual_tries2:2,joker_eligible:true},
      {id:2,year:2026,round:1,date:'Sat, Feb 7',time:'14:10',team1:'Italy',team2:'Scotland',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:false},
      {id:3,year:2027,round:1,date:'Fri, Feb 5',time:'20:10',team1:'England',team2:'Wales',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true},
      {id:4,year:2026,round:2,date:'Sat, Feb 14',time:'14:10',team1:'England',team2:'Wales',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true},
      {id:5,year:2026,round:2,date:'Sun, Feb 15',time:'15:10',team1:'Wales',team2:'Italy',actual_score1:null,actual_score2:null,actual_tries1:null,actual_tries2:null,joker_eligible:true}
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





const fs = require('fs');
const out = (label, ok, extra) => console.log(label + ':', ok, extra === undefined ? '' : (typeof extra === 'string' ? extra : JSON.stringify(extra)));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__noTourPrompts = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
  await page.goto('file://' + path); await page.waitForTimeout(300);
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(1200);
  await page.selectOption('#yearSelect', '2026'); await page.waitForTimeout(1200);
  await page.click('.admin-top-tab'); await page.waitForTimeout(300);
  await page.click('#adminPanel .admin-tabs button:has-text("Predictions")'); await page.waitForTimeout(600);
  out('template tools are hidden until a competitor is chosen', await page.evaluate(() => document.getElementById('adminTemplateTools').classList.contains('hidden')));
  await page.selectOption('#adminPredictionUserSelect', 'sam'); await page.waitForTimeout(400);
  out('template tools show for the chosen competitor', await page.evaluate(() => !document.getElementById('adminTemplateTools').classList.contains('hidden')));

  // ---- download the .xlsx and read it back ----
  const tmp = require('os').tmpdir();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download template (.xlsx)")')]);
  const xlsxPath = tmp + '/tpl-' + Date.now() + '.xlsx'; await dl.saveAs(xlsxPath);
  out('xlsx file name', /predictions-template-2026-sam\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const grid = await page.evaluate(async (b64) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return await readXlsx(bytes); }, fs.readFileSync(xlsxPath).toString('base64'));
  const hdrIdx = grid.findIndex(r => r[0] === 'Match id');
  out('xlsx: season, player, username and tries cells', grid[1][1] === '2026' && grid[2][1] === 'Sam' && grid[3][1] === 'sam' && grid[4][0] === 'Total tries' && grid[4][1] === '', JSON.stringify(grid.slice(1, 6)));
  out('xlsx: header row and one row per 2026 fixture', hdrIdx === 9 && grid.length - hdrIdx - 1 === 4 && grid[hdrIdx].join('|') === 'Match id|Round|Date|Time|Home team|Away team|Home score|Away score|Joker', JSON.stringify(grid.slice(hdrIdx)));
  const rowOf = (id) => grid.find((r, i) => i > hdrIdx && r[0] === String(id));
  out('xlsx: existing prediction pre-filled, Joker n/a on a fixture that cannot take one, No on an eligible one', rowOf(1)[6] === '20' && rowOf(1)[7] === '25' && rowOf(2)[8] === 'n/a' && rowOf(4)[8] === 'No' && rowOf(4)[6] === '', JSON.stringify([rowOf(1), rowOf(2), rowOf(4)]));
  // an independent check that it is a real zip package Excel can open
  const py = require('child_process').spawnSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(",".join(sorted(z.namelist())))', xlsxPath]);
  out('xlsx is a valid zip with the workbook parts', py.status === 0 && /xl\/worksheets\/sheet1\.xml/.test(String(py.stdout)) && /\[Content_Types\]\.xml/.test(String(py.stdout)), String(py.stdout).trim() || String(py.stderr).trim());
  const sheetXml = require('child_process').spawnSync('python3', ['-c', 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read("xl/worksheets/sheet1.xml").decode())', xlsxPath]).stdout.toString();
  out('xlsx has score, tries and Joker data validation', /type="whole"/.test(sheetXml) && /type="list"/.test(sheetXml) && /Yes,No/.test(sheetXml));
  const xl = require('child_process').spawnSync('python3', ['-c', 'import openpyxl,sys; ws=openpyxl.load_workbook(sys.argv[1]).active; print(ws["A10"].value, ws["I14"].value, ws.max_row)', xlsxPath]);
  if (xl.status === 0) out('openpyxl opens the template', /Match id/.test(String(xl.stdout)), String(xl.stdout).trim()); else console.log('openpyxl not available, skipped');

  // ---- csv download ----
  const [dlCsv] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download as CSV")')]);
  const csvPath = tmp + '/tpl-' + Date.now() + '.csv'; await dlCsv.saveAs(csvPath);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const csvGrid = await page.evaluate((t) => parseCsv(t), csvText);
  out('csv download has a BOM, the same cells, and round-trips', csvText.charCodeAt(0) === 0xFEFF && csvGrid.findIndex(r => r[0] === 'Match id') === 9 && csvGrid[3][1] === 'sam' && csvGrid.length >= 14, JSON.stringify(csvGrid.slice(9, 11)));

  // a filled-in file made from the template
  const makeFile = async (name, edit, format) => {
    const g = JSON.parse(JSON.stringify(grid));
    edit(g);
    const b64 = await page.evaluate(({ g, format }) => {
      if (format === 'csv') return btoa(unescape(encodeURIComponent(toCsv(g))));
      if (format === 'csv-semicolon') return btoa(unescape(encodeURIComponent('﻿' + g.map(r => r.join(';')).join('\r\n'))));
      const bytes = writeXlsx({ sheetName: 'Predictions', rows: g }); let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s);
    }, { g, format });
    const p = tmp + '/' + name; fs.writeFileSync(p, Buffer.from(b64, 'base64')); return p;
  };
  const setRow = (g, id, h, a, j) => { const r = g.find((x, i) => i > 9 && String(x[0]) === String(id)); r[6] = h; r[7] = a; if (j !== undefined) r[8] = j; return r; };
  const preview = () => page.evaluate(() => { const p = document.getElementById('adminUploadPreview'); return { shown: !p.classList.contains('hidden'), text: p.innerText, confirmDisabled: (document.getElementById('adminUploadConfirm') || {}).disabled, errors: [...p.querySelectorAll('.admin-upload-errors li')].map(l => l.textContent), warnings: [...p.querySelectorAll('.admin-upload-warnings li')].map(l => l.textContent) }; });
  const upload = async (file) => { await page.setInputFiles('#adminUploadFile', file); await page.waitForTimeout(500); return await preview(); };
  const db = () => page.evaluate(() => ({ preds: window.__db.predictions.filter(p => p.user_id === 2).map(p => [p.match_id, p.team1_score, p.team2_score]).sort((a, b) => a[0] - b[0]), tries: window.__db.user_tries.filter(t => t.user_id === 2).map(t => [t.year, t.total_tries]), jokers: window.__db.user_joker_selections.filter(j => j.user_id === 2).map(j => j.match_id).sort() }));
  const before = await db();
  out('sam starts with one prediction, no tries and no Joker', JSON.stringify(before) === JSON.stringify({ preds: [[1, 20, 25]], tries: [], jokers: [] }), before);

  // ---- invalid files: errors, nothing saved ----
  const bad = await makeFile('bad.xlsx', g => {
    setRow(g, 1, '-3', '10');          // negative
    setRow(g, 2, '12', '', 'Yes');     // one blank score, Joker on a fixture that cannot take one
    setRow(g, 4, '20', '15', 'Yes');
    setRow(g, 5, '9', '9', 'Yes');     // a second Joker (only 1 allowed)
    g.push([99, 3, 'x', 'x', 'A', 'B', '1', '1', 'No']);   // unknown match id
    g[4][1] = 'lots';                  // tries not a number
  });
  let pv = await upload(bad);
  out('invalid file: preview shows errors and Save is disabled', pv.shown && pv.errors.length >= 5 && (pv.confirmDisabled === true || pv.confirmDisabled === undefined), pv.errors);
  out('errors name the problem (negative score, one blank score, unknown match id, tries, too many Jokers)', pv.errors.some(e => /Row \d+ .*whole numbers/.test(e)) && pv.errors.some(e => /enter both scores/.test(e)) && pv.errors.some(e => /match id 99/.test(e)) && pv.errors.some(e => /Total tries/.test(e)) && pv.errors.some(e => /Too many Jokers/.test(e)), '');
  out('Joker on a fixture that is not eligible is refused', pv.errors.some(e => /not Joker-eligible/.test(e)), '');
  out('nothing was saved by the invalid file', JSON.stringify(await db()) === JSON.stringify(before));
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- wrong season ----
  pv = await upload(await makeFile('season.xlsx', g => { g[1][1] = '2025'; setRow(g, 4, '1', '2'); }));
  out('a template for another season is refused', pv.errors.some(e => /2025 season/.test(e)), pv.errors);
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- wrong player: warning and an explicit tick ----
  pv = await upload(await makeFile('player.xlsx', g => { g[3][1] = 'ben'; setRow(g, 4, '21', '14'); }));
  out('a template made for another player warns and Save is off until ticked', pv.warnings.some(w => /"ben"/.test(w)) && pv.confirmDisabled === true && !pv.errors.length, pv.warnings);
  await page.check('#adminUploadAck'); await page.waitForTimeout(100);
  out('ticking "save anyway" enables Save', await page.evaluate(() => !document.getElementById('adminUploadConfirm').disabled));
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- a good .xlsx: scores, tries and a Joker, then confirm ----
  const good = await makeFile('good.xlsx', g => { g[4][1] = '52'; setRow(g, 1, '30', '20'); setRow(g, 4, '21', '14', 'Yes'); setRow(g, 5, '', '', 'No'); });
  pv = await upload(good);
  out('valid xlsx: preview lists new and changed rows, tries, a note about the lock and a result warning', pv.shown && !pv.errors.length && /England v Wales[\s\S]*21-14 \(new\)/.test(pv.text) && /30-20 \(changed\)/.test(pv.text) && /Total tries: not set to 52/.test(pv.text) && pv.warnings.some(w => /already has a result/.test(w)) && /locked for competitors/.test(pv.text) && pv.confirmDisabled === false, pv.text.replace(/\s+/g, ' ').slice(0, 400));
  if (process.env.SHOT) await (await page.$('#adminTemplateTools')).screenshot({ path: process.env.SHOT + '-preview.png' });
  out('nothing is saved until confirmed', JSON.stringify(await db()) === JSON.stringify(before));
  await page.click('#adminUploadConfirm'); await page.waitForTimeout(700);
  const after = await db();
  out('confirm saves the scores, the tries and the Joker', JSON.stringify(after) === JSON.stringify({ preds: [[1, 30, 20], [4, 21, 14]], tries: [[2026, 52]], jokers: [4] }), after);
  out('the screen shows a success message and the preview is gone', await page.evaluate(() => /Saved 4 changes for Sam/.test(document.getElementById('adminUploadStatus').textContent) && document.getElementById('adminUploadPreview').classList.contains('hidden')), await page.evaluate(() => document.getElementById('adminUploadStatus').textContent));
  out('the Edit list on the same screen now shows the new prediction and the Joker', await page.evaluate(() => /Predicted: 21-14/.test(document.getElementById('admin-match-card-4').innerText) && document.getElementById('admin-match-card-4').classList.contains('joker-selected') && document.getElementById('adminTotalTries').value === '52'));

  // ---- the Joker moves; blank cells keep what is saved ----
  const moved = await makeFile('moved.csv', g => { setRow(g, 1, '30', '20'); setRow(g, 4, '', '', 'No'); setRow(g, 5, '7', '3', 'Yes'); g[4][1] = ''; }, 'csv');
  pv = await upload(moved);
  out('csv upload: moving the Joker; blank scores and blank tries keep what is saved', !pv.errors.length && /7-3 \(new\)/.test(pv.text) && /no change/.test(pv.text) && !/Total tries:/.test(pv.text) && pv.confirmDisabled === false, pv.text.replace(/\s+/g, ' ').slice(0, 300));
  await page.click('#adminUploadConfirm'); await page.waitForTimeout(700);
  const after2 = await db();
  out('after the Joker moved: Joker on the new fixture, the old prediction and tries are kept', JSON.stringify(after2) === JSON.stringify({ preds: [[1, 30, 20], [4, 21, 14], [5, 7, 3]], tries: [[2026, 52]], jokers: [5] }), after2);

  // ---- a Joker on a fixture that cannot take one ----
  pv = await upload(await makeFile('nopred.csv', g => { setRow(g, 4, '', '', 'No'); setRow(g, 5, '7', '3', 'No'); const r = g.find((x, i) => i > 9 && String(x[0]) === '2'); r[8] = 'Yes'; }, 'csv'));
  out('a Joker on a fixture that is not eligible is refused (csv)', pv.errors.some(e => /not Joker-eligible/.test(e)), pv.errors);
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- semicolon csv (Excel in some regions) ----
  pv = await upload(await makeFile('semi.csv', g => { setRow(g, 4, '10', '11', 'Yes'); setRow(g, 5, '7', '3', 'No'); }, 'csv-semicolon'));
  out('semicolon separated csv is read too', !pv.errors.length && /10-11 \(changed\)/.test(pv.text), pv.errors.concat(pv.text.replace(/\s+/g, ' ').slice(0, 200)));
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- not a template at all ----
  fs.writeFileSync(tmp + '/junk.txt', 'hello there');
  await page.setInputFiles('#adminUploadFile', tmp + '/junk.txt'); await page.waitForTimeout(400);
  out('a file that is not a template shows a plain error and saves nothing', await page.evaluate(() => /Match id/.test(document.getElementById('adminUploadPreview').innerText)), await page.evaluate(() => document.getElementById('adminUploadPreview').innerText));
  await page.click('.admin-upload-actions .btn-cancel'); await page.waitForTimeout(100);

  // ---- a different competitor clears the preview ----
  await page.setInputFiles('#adminUploadFile', csvPath); await page.waitForTimeout(400);
  await page.selectOption('#adminPredictionUserSelect', 'ben'); await page.waitForTimeout(400);
  out('changing competitor clears any waiting preview', await page.evaluate(() => document.getElementById('adminUploadPreview').classList.contains('hidden') && document.getElementById('adminUploadPreview').innerHTML === ''));
  out('no sideways scrolling at 390px', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
