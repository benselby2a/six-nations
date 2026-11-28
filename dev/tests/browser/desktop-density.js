// Wide desktops: Compact and Jumbo rows are one line tall and an adaptive density level (density-comfortable / -tight / -tightest on the
// table wrap, set by fitSummaryDensity in js/summary.js) steps down with more players so the whole table fits the screen without vertical scrolling.
// Phones and narrow windows are unchanged. Fixture: 15 matches (12 with results), N players, 2026.
const { chromium } = require('playwright');
const fs = require('fs');
const P = require('path');
const path = P.resolve(__dirname, '../../../index.html');
const SCR = process.env.SCR || '/tmp/claude-0/-home-user-six-nations/55e70b8c-24a4-53e8-973b-d120bef1189e/scratchpad';

const src = fs.readFileSync(P.join(__dirname, 'pinned-divider.js'), 'utf8');
const baseMock = src.slice(src.indexOf('const mock = `') + 'const mock = `'.length, src.indexOf('})();`;') + 5);

const NAMES = ['Ben', 'Ai', 'Nic', 'Jojo & Charlie', 'Claudia', 'Chris', 'Trev', 'Jude', 'Sarah', 'Louise & Ben', 'Simon', 'Carol & Gareth', 'Mary Ann Smith', 'Pete', 'Dom', 'Kerry', 'Tom', 'Anna-Marie', 'Raj', 'Lucy'];
const PAIRS = [['France', 'Ireland'], ['Italy', 'Scotland'], ['England', 'Wales'], ['Ireland', 'Italy'], ['Scotland', 'England'], ['Wales', 'France'], ['England', 'Ireland'], ['Wales', 'Scotland'], ['France', 'Italy'], ['Ireland', 'Wales'], ['Scotland', 'France'], ['Italy', 'England'], ['Ireland', 'Scotland'], ['Wales', 'Italy'], ['France', 'England']];

function fixture(n) {
  const rnd = (() => { let s = 7; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
  const matches = PAIRS.map((p, i) => ({ id: i + 1, year: 2026, round: 1 + Math.floor(i / 3), date: 'Sat, Feb ' + (7 + i * 2 % 21), time: '14:10', team1: p[0], team2: p[1],
    actual_score1: i < 12 ? 10 + Math.floor(rnd() * 40) : null, actual_score2: i < 12 ? 7 + Math.floor(rnd() * 30) : null, actual_tries1: i < 12 ? 3 : null, actual_tries2: i < 12 ? 2 : null, joker_eligible: i % 2 === 0 }));
  const users = NAMES.slice(0, n).map((nm, i) => ({ id: i + 1, username: i === 0 ? 'ben' : 'p' + i, nickname: nm, supported_teams: i % 3 === 0 ? null : (i % 2 ? 'England,Italy' : 'Wales,Ireland'), auth_user_id: i === 0 ? 'u-ben@example.com' : undefined }));
  const predictions = [], jokers = [], tries = [];
  users.forEach(u => { matches.forEach(m => predictions.push({ id: predictions.length + 1, user_id: u.id, match_id: m.id, team1_score: 8 + Math.floor(rnd() * 40), team2_score: 6 + Math.floor(rnd() * 32) })); jokers.push({ id: jokers.length + 1, user_id: u.id, match_id: matches[(u.id * 2) % 14].id }); tries.push({ user_id: u.id, year: 2026, total_tries: 60 + Math.floor(rnd() * 50) }); });
  return { matches, users, predictions, jokers, tries };
}
function mockFor(n) {
  const f = fixture(n);
  let m = baseMock;
  const swap = (key, value) => { const i = m.indexOf('    ' + key + ':'); const open = m.indexOf('[', i); let depth = 0, j = open; for (; j < m.length; j++) { if (m[j] === '[') depth++; if (m[j] === ']') { depth--; if (!depth) break; } } m = m.slice(0, open) + JSON.stringify(f[key === 'user_tries' ? 'tries' : key === 'user_joker_selections' ? 'jokers' : key]) + m.slice(j + 1); };
  swap('matches'); swap('users'); swap('predictions'); swap('user_tries'); swap('user_joker_selections');
  return m;
}

async function open(browser, { width, height, scheme = 'light', players = 10 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mockFor(players) }));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
  await page.goto('file://' + path); await page.waitForTimeout(300);
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(900);
  await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
  await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
  return { context, page, errors };
}
const measure = (page) => page.evaluate(() => {
  const real = document.querySelector('.summary-table:not(.summary-table-clone)');
  const rows = [...real.querySelectorAll('tbody tr')];
  const wrap = document.querySelector('.summary-table-wrap');
  const r = real.getBoundingClientRect();
  const head = real.querySelector('thead').getBoundingClientRect();
  const hs = rows.map(tr => Math.round(tr.getBoundingClientRect().height * 10) / 10);
  const cell = rows[0].querySelector('td.prediction-cell'); const cs = getComputedStyle(cell);
  const lines = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter(x => x.width > 0); return new Set(rs.map(x => Math.round(x.top / 4))).size; };
  const maxLines = (sel) => Math.max(...rows.map(tr => { const e = tr.querySelector(sel); return e ? lines(e) : 0; }));
  const box = document.querySelector('.summary-container');
  const hint = document.getElementById('scrollHint');
  return { density: [...wrap.classList].filter(c => c.startsWith('density-')).join(','), n: rows.length, rowH: hs[0], rowMax: Math.max(...hs), rowMin: Math.min(...hs), headH: Math.round(head.height), tableH: Math.round(r.height), top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), innerH: innerHeight, fits: r.bottom + scrollY <= innerHeight, scrollH: document.documentElement.scrollHeight,
    hScroll: document.documentElement.scrollWidth > innerWidth + 1, boxScroll: box.scrollWidth > box.clientWidth + 1, fs: parseFloat(cs.fontSize), cellLines: maxLines('td.prediction-cell'), nameLines: maxLines('td.competitor-name .comp-nick'), hint: !!hint && !hint.classList.contains('hidden') };
});
module.exports = { open, measure, mockFor, fixture, SCR };

if (require.main === module) (async () => {
  const browser = await chromium.launch();
  const errors = [];
  const OLD = { compact: 81.8, simple: 72 };   // the row heights on a wide desktop before this layout existed
  const rank = (d) => ['density-comfortable', 'density-tight', 'density-tightest'].indexOf(d);

  // 1. wide desktops: the table fits the screen without scrolling down, rows are much shorter, one-line names, nothing wrapped or clipped
  for (const [w, h, players] of [[1920, 1080, 10], [1920, 1080, 15], [1920, 1080, 20], [1440, 900, 10]]) for (const mode of ['compact', 'simple']) {
    const { context, page, errors: e } = await open(browser, { width: w, height: h, players });
    errors.push(...e);
    await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(700);
    const m = await measure(page);
    const label = w + 'x' + h + ' ' + players + ' players ' + mode;
    console.log(label + ': the whole table fits the screen without scrolling down (table bottom ' + m.bottom + ' <= ' + m.innerH + '), level ' + m.density + ', rows ' + m.rowH + 'px (was ' + OLD[mode] + '):', m.fits && m.rowMax <= OLD[mode] - 20 && /density-/.test(m.density) && m.rowMax === m.rowMin);
    console.log(label + ': names on one line, nothing wider than the screen (no page or box scrolling beyond the baseline), fonts at least 13px:', m.nameLines === 1 && !m.hScroll && (w >= 1920 ? !m.boxScroll : true) && m.fs >= 13, JSON.stringify({ nameLines: m.nameLines, hScroll: m.hScroll, boxScroll: m.boxScroll, fs: m.fs }));
    if (w === 1920 && players === 10 && mode === 'compact') console.log('the Scroll left and right hint is not shown when the table fits sideways:', !m.hint);
    await context.close();
  }

  // 2. the level steps down with more players; the type never gets smaller than 13px (names, scores) and 12px (points)
  { const a = await open(browser, { width: 1920, height: 1080, players: 10 }); const b = await open(browser, { width: 1920, height: 1080, players: 20 });
    errors.push(...a.errors, ...b.errors);
    const da = (await measure(a.page)).density, db = (await measure(b.page)).density;
    console.log('more players, denser rows (10 players ' + da + ', 20 players ' + db + '):', rank(db) > rank(da));
    for (const mode of ['compact', 'simple']) {
      await b.page.evaluate((m) => setSummaryView(m), mode); await b.page.waitForTimeout(500);
      for (const level of ['density-comfortable', 'density-tight', 'density-tightest']) {
        const f = await b.page.evaluate((lvl) => { const wrap = document.querySelector('.summary-table-wrap'); ['density-comfortable', 'density-tight', 'density-tightest'].forEach(c => wrap.classList.remove(c)); wrap.classList.add(lvl);
          const t = wrap.querySelector('.summary-table:not(.summary-table-clone)'); const px = (sel) => parseFloat(getComputedStyle(t.querySelector(sel)).fontSize);
          return { name: px('tbody .comp-nick'), score: px('tbody td.prediction-cell .pred-score'), pts: px('tbody td.prediction-cell .points-earned:not(.points-placeholder)'), row: Math.round(t.querySelector('tbody tr').getBoundingClientRect().height) }; }, level);
        console.log(mode + ' ' + level + ': ' + JSON.stringify(f) + ' name and score >= 13px, points >= 12px:', f.name >= 13 && f.score >= 13 && f.pts >= 12);
      }
    }
    await a.context.close(); await b.context.close(); }

  // 3. the details switch (date and tries rows in the headers) is counted: the level steps down so the table still fits
  { const { context, page, errors: e } = await open(browser, { width: 1920, height: 1080, players: 15 });
    errors.push(...e);
    await page.evaluate(() => setSummaryView('simple')); await page.waitForTimeout(500);
    const off = await measure(page);
    await page.click('#headerDetailBtn'); await page.waitForTimeout(800);
    const on = await measure(page);
    console.log('details on: taller header (' + off.headH + ' -> ' + on.headH + '), denser rows (' + off.density + ' -> ' + on.density + '), still fits:', on.headH > off.headH && rank(on.density) >= rank(off.density) && on.fits);
    // the pinned header copy keeps matching the real header
    await page.evaluate(() => window.scrollTo(0, 200)); await page.waitForTimeout(400);
    const pin = await page.evaluate(() => { const real = document.querySelector('.summary-table:not(.summary-table-clone) thead').getBoundingClientRect(); const clone = document.querySelector('.summary-sticky-scroll .summary-table-clone thead'); const c = clone.getBoundingClientRect(); return { realH: Math.round(real.height), cloneH: Math.round(c.height), realW: Math.round(real.width), cloneW: Math.round(c.width) }; });
    console.log('the pinned header copy is as tall and wide as the real header:', Math.abs(pin.realH - pin.cloneH) <= 1 && Math.abs(pin.realW - pin.cloneW) <= 1, JSON.stringify(pin));
    await context.close(); }

  // 4. nothing changes on phones, narrow windows or touch screens: no density class, and the row heights are what they were
  for (const [w, h, touch, label] of [[390, 844, true, 'phone 390px'], [1024, 768, false, 'narrow window 1024px'], [1280, 800, true, 'touch screen 1280px']]) for (const mode of ['compact', 'simple']) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mockFor(10) }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(900);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(700);
    const m = await measure(page);
    const was = { 'phone 390px': { compact: [64.2, 71], simple: [70, 83] }, 'narrow window 1024px': { compact: [81.8, 90], simple: [72, 98] }, 'touch screen 1280px': { compact: [81.8, 90], simple: [72, 98] } }[label][mode];
    console.log(label + ' ' + mode + ': unchanged (no density class, rows ' + m.rowH + ' was ' + was[0] + ', header ' + m.headH + ' was ' + was[1] + '):', m.density === '' && Math.abs(m.rowH - was[0]) <= 0.6 && Math.abs(m.headH - was[1]) <= 1);
    await context.close();
  }
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
