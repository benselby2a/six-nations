// Pinned header, sideways: the copy of the header row that stays at the top of the screen must follow the table's sideways scroll exactly
// (same x as the real header cell, every frame), in BOTH ways it can be driven: the browser's scroll-driven animation (Chrome, Safari 26) and the
// script fallback (browsers without it). Measured with a throttled CPU (4x) and touch flicks, at phone size with the iPhone-only CSS injected.
// Also checks the cost of scrolling: no long frames caused by scroll handlers, and that the header layer has its own compositing layer.
// Variants for measuring (not part of the run): NO_CLIP=1 drops the iPhone clip-path, NO_SNAP=1 drops scroll-snap, THROTTLE=n sets the CPU slowdown.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');

// the mocked database of pinned-divider.js, with six more fixtures so the table scrolls sideways
const src = fs.readFileSync(require('path').join(__dirname, 'pinned-divider.js'), 'utf8');
let mock = src.slice(src.indexOf('const mock = `') + 'const mock = `'.length, src.indexOf('})();`;') + 5);
const teams = [['France', 'Ireland'], ['Italy', 'Scotland'], ['England', 'Wales'], ['Ireland', 'Italy'], ['Scotland', 'England'], ['Wales', 'France']];
mock = mock.replace('{id:3,year:2027', teams.map((t, i) => `{id:${10 + i},year:2026,round:${2 + Math.floor(i / 3)},date:'Sat, Feb ${14 + i}',time:'14:10',team1:'${t[0]}',team2:'${t[1]}',actual_score1:${i < 2 ? 20 + i : null},actual_score2:${i < 2 ? 15 : null},actual_tries1:null,actual_tries2:null,joker_eligible:false}`).join(',\n      ') + ',\n      {id:3,year:2027');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const css = fs.readFileSync(path.replace('index.html', 'styles.css'), 'utf8');
  let ios = '';
  for (let at = css.indexOf('@supports (-webkit-touch-callout: none)'); at !== -1; at = css.indexOf('@supports (-webkit-touch-callout: none)', at + 1)) {
    let depth = 0;
    for (let e = css.indexOf('{', at); e < css.length; e++) { if (css[e] === '{') depth++; if (css[e] === '}') { depth--; if (!depth) { ios += '@media all ' + css.slice(css.indexOf('{', at), e + 1) + '\n'; break; } } }
  }
  const results = [];
  for (const how of ['native', 'fallback']) for (const mode of ['compact', 'simple']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.addInitScript((h) => {
      window.__noTourPrompts = true; window.__noWhatsNew = true;
      if (h === 'fallback') { const orig = CSS.supports.bind(CSS); CSS.supports = (a, b) => (typeof a === 'string' && /animation-timeline/.test(a)) ? false : orig(a, b); }
    }, how);
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(800);
    let extra = ios;
    if (process.env.NO_CLIP) extra += ' .summary-container { clip-path: none !important; }';
    if (process.env.NO_SNAP) extra += ' .summary-container { scroll-snap-type: none !important; }';
    if (how === 'fallback') extra += ' .summary-sticky-scroll { animation: none !important; }';   // only the script moves the header
    await page.addStyleTag({ content: extra });
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(800);
    // scroll the page down until the real header has left the screen, so the pinned copy is the one showing
    await page.evaluate(() => { const r = document.querySelector('.summary-table thead').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.bottom + 20); }); await page.waitForTimeout(400);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
    // every frame: the container's scrollLeft, the pinned copy's first match header x and the real header's x (they must be equal), the frame time
    await page.evaluate(() => {
      window.__lag = { frames: [], dt: [], handlerMs: 0, handlers: 0, stop: false };
      const box = document.querySelector('.summary-container');
      let hStart = 0;
      box.addEventListener('scroll', () => { window.__lag.handlers++; }, { passive: true, capture: true });
      let last = performance.now();
      const real = () => document.querySelector('.summary-table:not(.summary-table-clone) th.match-header-cell');
      const clone = () => document.querySelector('.summary-sticky-scroll th.match-header-cell');
      const loop = (t) => {
        const a = real(), b = clone();
        if (a && b) window.__lag.frames.push({ sl: box.scrollLeft, diff: Math.abs(a.getBoundingClientRect().left - b.getBoundingClientRect().left) });
        window.__lag.dt.push(t - last); last = t;
        if (!window.__lag.stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    if (process.env.SELECT) {   // touching a cell selects it (row and column bars) at pointerdown, right as the scroll starts
      await page.evaluate(() => { window.__lag.dt.length = 0; window.__t0 = performance.now(); const c = document.querySelector('.summary-table:not(.summary-table-clone) tbody td.prediction-cell'); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 200, clientY: 300, pointerId: 7 })); window.__selMs = performance.now() - window.__t0; });
    }
    // smooth sideways scrolls (the browser animates them, so the scroll position changes every frame like a flick would): right, back a bit, right again, back to the start
    for (const frac of [1, 0.4, 0.9, 0]) {
      await page.evaluate((f) => { const b = document.querySelector('.summary-container'); b.scrollTo({ left: f * (b.scrollWidth - b.clientWidth), behavior: 'smooth' }); }, frac);
      await page.waitForTimeout(900);
    }
    const r = await page.evaluate(() => {
      window.__lag.stop = true;
      const f = window.__lag.frames, dt = window.__lag.dt.slice(2);
      const diffs = f.map(x => x.diff), sorted = [...dt].sort((a, b) => a - b);
      const el = document.querySelector('.summary-sticky-scroll');
      const cs = el ? getComputedStyle(el) : null;
      return { frames: f.length, maxDiff: Math.max(0, ...diffs), meanDiff: diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length), longFrames: dt.filter(x => x > 40).length, p95: sorted[Math.floor(sorted.length * 0.95)] || 0, scrollRange: Math.max(...f.map(x => x.sl)) - Math.min(...f.map(x => x.sl)), animated: !!(cs && cs.animationName && cs.animationName !== 'none'), willChange: cs ? cs.willChange : null, handlers: window.__lag.handlers, selMs: window.__selMs, first: dt.slice(0, 12).map(x => Math.round(x)) };
    });
    results.push({ how, mode, ...r });
    await context.close();
  }
  for (const r of results) {
    const ok = r.scrollRange > 100 && r.frames > 20 && r.maxDiff <= 1.5;
    console.log(`${r.how} path, ${r.mode}: header x equals the real header x on every frame while flicking (max ${r.maxDiff.toFixed(2)}px, mean ${r.meanDiff.toFixed(2)}px over ${r.frames} frames, scrolled ${Math.round(r.scrollRange)}px, ${r.longFrames} long frames, p95 frame ${r.p95.toFixed(1)}ms, ${r.handlers} scroll events):`, ok, JSON.stringify({ animated: r.animated, willChange: r.willChange, selMs: r.selMs, first: r.first }));
  }
  console.log('the pinned header layer is promoted to its own layer (will-change: transform):', results.every(r => r.willChange === 'transform'));
  // The iPhone left-edge sliver without a clip-path: the box (and the Rank cell on it) must sit exactly on a device pixel. The browser here is told it is iOS
  // (CSS.supports('-webkit-touch-callout: none') is true) and the table is moved 0.4px sideways first, as the real fractional offset (about 10.6px) does.
  for (const dpr of [3, 2]) for (const mode of ['compact', 'simple']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; const orig = CSS.supports.bind(CSS); CSS.supports = (a, b) => (a === '-webkit-touch-callout: none' || a === '-webkit-touch-callout') ? true : orig(a, b); });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(800);
    await page.addStyleTag({ content: ios + ' .summary-table-wrap { margin-left: 0.4px !important; }' });
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(900);
    const g = await page.evaluate(() => {
      const dpr = window.devicePixelRatio, box = document.querySelector('.summary-container'), b = box.getBoundingClientRect();
      const rank = document.querySelector('.summary-table:not(.summary-table-clone) tbody td.rank-col').getBoundingClientRect();
      const pin = document.querySelector('.summary-sticky-pinned th').getBoundingClientRect();
      const frac = (v) => Math.abs(v * dpr - Math.round(v * dpr));
      return { box: frac(b.left), rank: frac(rank.left), pinned: frac(pin.left), same: Math.abs(rank.left - pin.left), nudge: getComputedStyle(box).getPropertyValue('--box-nudge'), pageX: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    console.log(`iPhone alignment at ${dpr}x, ${mode}: the box, the Rank cell and the pinned header's first cell all start on a whole device pixel and line up (no sliver, no clip-path):`, g.box < 0.07 && g.rank < 0.07 && g.pinned < 0.07 && g.same < 0.03 && !g.pageX, JSON.stringify(g));
    const clip = await page.evaluate(() => getComputedStyle(document.querySelector('.summary-container')).clipPath);
    console.log(`  no clip-path on the scrolling box (${dpr}x, ${mode}):`, clip === 'none', clip);
    await context.close();
  }
  console.log('pageerrors', errors.length);
  await browser.close();
})();
