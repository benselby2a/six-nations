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
  const errors = [];
  const open = async (viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; });
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async d => { await d.accept(); });
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({contentType:'application/javascript', body: mock}));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({contentType:'application/javascript', body:''}));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({body:''}));
    await page.goto('file://' + path);
    await page.waitForTimeout(Math.min(800, 40));
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(Math.min(150, 40));
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(Math.min(1000, 40));
    await page.evaluate(() => { const find = (t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.offsetParent !== null); find('Admin Functions').click(); find('Competitors').click(); });
    await page.waitForTimeout(Math.min(700, 40));
    return page;
  };

  // ---------------- phone ----------------
  let page = await open({ width: 390, height: 844 });
  const overflow = () => page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
  const cards = await page.evaluate(() => [...document.querySelectorAll('.competitor-card')].map(d => ({ id: d.id, open: d.open, summary: d.querySelector('summary').innerText.replace(/\s+/g, ' ').trim() })));
  console.log('1 phone, collapsed: cards =', cards.length, '| open ones:', cards.filter(c => c.open).length);
  cards.slice(0, 3).forEach(c => console.log('   ', c.id, '->', c.summary));
  console.log('2 horizontal overflow (collapsed):', JSON.stringify(await overflow()));
  await page.screenshot({ path: 'cards-collapsed.png', fullPage: false });

  await page.click('#user-row-sam > summary'); await page.waitForTimeout(Math.min(300, 40));
  const layout = await page.evaluate(() => {
    const card = document.getElementById('user-row-sam');
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) }; };
    const fields = [...card.querySelectorAll('input[type=text], input[type=email], select')].map(el => ({ id: el.id.replace('-sam', ''), ...box(el), font: parseFloat(getComputedStyle(el).fontSize) }));
    return { card: box(card), fields, toggles: [...card.querySelectorAll('.cc-toggle')].map(el => box(el).height), buttons: [...card.querySelectorAll('.cc-actions button')].map(el => ({ t: el.textContent.trim(), h: box(el).height, w: box(el).width })) };
  });
  console.log('3 expanded card width:', layout.card.width);
  layout.fields.forEach(f => console.log('    ', f.id.padEnd(10), 'left', f.left, 'width', f.width, 'height', f.height, 'font', f.font));
  const lefts = new Set(layout.fields.map(f => f.left)), widths = new Set(layout.fields.map(f => f.width));
  const tops = layout.fields.map(f => f.top); const stacked = tops.every((t, i) => i === 0 || t > tops[i - 1]);
  console.log('4 all fields share one left edge and width (stacked, full width):', lefts.size === 1 && widths.size === 1, '| each below the last:', stacked);
  console.log('5 tap targets: min field height', Math.min(...layout.fields.map(f => f.height)), '| min font', Math.min(...layout.fields.map(f => f.font)), '(16+ stops iOS zooming) | toggles', layout.toggles.join(','), '| buttons', JSON.stringify(layout.buttons));
  console.log('6 horizontal overflow (expanded):', JSON.stringify(await overflow()));
  await page.evaluate(() => document.getElementById('user-row-sam').scrollIntoView());
  await page.screenshot({ path: 'cards-expanded.png' });

  // open state and typed text survive the screen refreshing itself
  await page.fill('#edit-nickname-sam', 'Samuel (unsaved)');
  await page.evaluate(() => renderCompetitorManagement());
  console.log('7 after a re-render: sam still open', await page.evaluate(() => document.getElementById('user-row-sam').open), '| ben closed', await page.evaluate(() => !document.getElementById('user-row-ben').open), '| unsaved text kept:', await page.inputValue('#edit-nickname-sam'));
  await page.evaluate(() => { __db.competitor_emails.push({ user_id: 2, email: 'sam@x.com' }); return loadAuthAccounts().then(renderCompetitorManagement); }); await page.waitForTimeout(Math.min(300, 40));
  console.log('   after accounts reload: email from server shown:', await page.inputValue('#edit-email-sam'), '| unsaved name still kept:', await page.inputValue('#edit-nickname-sam'));

  // saving and toggles still work
  await page.fill('#edit-nickname-sam', 'Samuel'); await page.fill('#edit-email-sam', 'samuel@x.com');
  await page.click('#user-row-sam .cc-actions .btn-success'); await page.waitForTimeout(Math.min(600, 40));
  console.log('8 Save from the card: nickname', await page.evaluate(() => __db.users.find(u => u.username === 'sam').nickname), '| email', await page.evaluate(() => JSON.stringify(__db.competitor_emails.find(e => e.user_id === 2))));
  await page.evaluate(() => { document.getElementById('user-row-sam').open = true; });
  await page.check('#edit-active-sam'); await page.waitForTimeout(Math.min(400, 40));
  console.log('   Playing toggle saved:', await page.evaluate(() => JSON.stringify(__db.settings.filter(s => s.key.startsWith('active_overrides')))));

  // add a competitor from the first card
  await page.click('#new-competitor-card > summary'); await page.click('#new-competitor-details > summary'); await page.evaluate(() => { window.__emailFree = true; }); await page.waitForTimeout(Math.min(200, 40));
  await page.fill('#new-username-admin', 'zed'); await page.fill('#new-nickname-admin', 'Zed'); await page.fill('#new-email-admin', 'zed@x.com');
  await page.click('#new-competitor-card .cc-actions button'); await page.waitForTimeout(Math.min(700, 40));
  console.log('9 added from the card:', await page.evaluate(() => !!__db.users.find(u => u.username === 'zed')), '| card now listed:', await page.evaluate(() => !!document.getElementById('user-row-zed')));

  // ---------------- desktop ----------------
  page = await open({ width: 1200, height: 900 });
  await page.click('#user-row-sam > summary'); await page.waitForTimeout(Math.min(300, 40));
  const desk = await page.evaluate(() => { const g = (id) => document.getElementById(id).getBoundingClientRect(); const u = g('edit-username-sam'), n = g('edit-nickname-sam'), e = g('edit-email-sam'); return { sideBySide: Math.abs(u.top - n.top) < 4 && n.left > u.left, emailFullRow: e.width > u.width * 1.8, overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
  console.log('10 desktop: username and display name side by side:', desk.sideBySide, '| email spans the row:', desk.emailFullRow, '| no overflow:', desk.overflow);
  await page.screenshot({ path: 'cards-desktop.png' });
  console.log('pageerrors:', errors);
  await browser.close();
})();
