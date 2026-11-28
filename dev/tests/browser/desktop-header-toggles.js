// Wide screens (1100px and up): the table view switch (Compact | Classic | Jumbo) and a sun / moon pair sit in the top bar, left of the initial circle.
// They use the same functions as the account menu's switches and stay in sync with them. Hidden below 1100px (phones and tablets are untouched).
// The view switch only shows on Match Summary; sun / moon forces Light / Dark (Auto stays in the menu: then the icon of the theme showing is
// highlighted and the tooltip says so).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');
const src = fs.readFileSync(require('path').join(__dirname, 'column-hover.js'), 'utf8');
const start = src.indexOf('const mock = `') + 'const mock = `'.length;
const mock = src.slice(start, src.indexOf('})();`;', start) + 5);
const SHOTS = '/tmp/claude-0/-home-user-six-nations/55e70b8c-24a4-53e8-973b-d120bef1189e/scratchpad/';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (width, height, scheme = 'light') => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await context.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(800);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(500);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    return { context, page };
  };
  const geo = (page) => page.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height }; };
    const bar = document.querySelector('.app-bar'), av = document.getElementById('avatarBtn'), tv = document.getElementById('topViewSwitch'), tt = document.getElementById('topThemeSwitch');
    const tabs = document.querySelector('#appView .app-bar > .tabs'), title = document.querySelector('.app-bar-title'), chip = document.querySelector('.year-chip');
    return { viewShown: vis(tv), themeShown: vis(tt), viewR: vis(tv) ? r(tv) : null, themeR: vis(tt) ? r(tt) : null, avatar: r(av), bar: r(bar), tabs: r(tabs), title: r(title), chip: r(chip),
      barOverflow: [...bar.children].filter(c => c.offsetParent !== null && getComputedStyle(c).position !== 'absolute').some(c => c.getBoundingClientRect().right > bar.getBoundingClientRect().right + 1), pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  const state = (page) => page.evaluate(() => ({
    body: ['summary-compact', 'summary-simple', 'summary-classic'].filter(c => document.body.classList.contains(c)).join(' '),
    saved: localStorage.getItem('summaryViewMode'), topActive: [...document.querySelectorAll('#topViewSwitch .active')].map(b => b.dataset.view).join(),
    menuActive: [...document.querySelectorAll('#summaryViewSwitch .active')].map(b => b.dataset.view).join(),
    theme: document.documentElement.getAttribute('data-theme') || 'light', savedTheme: localStorage.getItem('rugbyPredictorColourMode'),
    topThemeActive: [...document.querySelectorAll('#topThemeSwitch .active')].map(b => b.dataset.themeMode).join(), menuThemeActive: [...document.querySelectorAll('#themeSwitch .active')].map(b => b.dataset.themeMode).join(),
    titles: [...document.querySelectorAll('#topThemeSwitch .bar-switch-btn')].map(b => b.title) }));

  // 1. the wide layouts: both switches sit on the bar's row, left of the initial circle, nothing wraps or overflows
  for (const [w, h] of [[1100, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
    const { context, page } = await open(w, h);
    const g = await geo(page);
    const left = g.viewShown && g.themeShown && g.viewR.r <= g.themeR.l + 1 && g.themeR.r <= g.avatar.l + 1;
    const sameRow = g.viewShown && g.themeShown && Math.abs((g.viewR.t + g.viewR.h / 2) - (g.avatar.t + g.avatar.h / 2)) < 10 && Math.abs((g.themeR.t + g.themeR.h / 2) - (g.avatar.t + g.avatar.h / 2)) < 10;
    const noWrap = g.bar.h < 80 && Math.abs(g.tabs.t - g.title.t) < 40 && g.chip.h < 50 && !g.barOverflow && !g.pageOverflow;
    console.log(`@${w}: view switch and sun/moon are left of the initial circle on the bar's row, nothing wraps or overflows:`, left && sameRow && noWrap, JSON.stringify({ viewR: g.viewR && [Math.round(g.viewR.l), Math.round(g.viewR.r)], themeR: g.themeR && [Math.round(g.themeR.l), Math.round(g.themeR.r)], av: Math.round(g.avatar.l), barH: Math.round(g.bar.h) }));
    console.log(`@${w}: tap targets are at least 32px high:`, !!g.viewR && g.viewR.h >= 32 && g.themeR.h >= 32);
    await context.close();
  }

  // 2. below 1100px they are hidden (phones and tablets are untouched)
  for (const [w, h] of [[1099, 800], [768, 900], [390, 844]]) {
    const { context, page } = await open(w, h);
    const g = await geo(page);
    console.log(`@${w}: both switches are hidden:`, !g.viewShown && !g.themeShown);
    await context.close();
  }

  // 3. behaviour at 1440: view switch, menu follows, view switch only on Match Summary
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await open(1440, 900, scheme);
    for (const [mode, cls] of [['simple', 'summary-compact summary-simple'], ['classic', 'summary-classic'], ['compact', 'summary-compact']]) {
      await page.click(`#topViewSwitch .bar-switch-btn[data-view="${mode}"]`); await page.waitForTimeout(500);
      const s = await state(page);
      console.log(`${scheme}: top ${mode} -> the view changes, is remembered, and the menu switch follows:`, s.body === cls && s.saved === mode && s.topActive === mode && s.menuActive === mode, JSON.stringify(s.body));
    }
    // a change made elsewhere moves the top switch too
    await page.evaluate(() => setSummaryView('simple')); await page.waitForTimeout(400);
    const viaMenu = await state(page);
    console.log(`${scheme}: a change made elsewhere (menu / tour) updates the top switch:`, viaMenu.topActive === 'simple');
    // only on Match Summary
    await page.click('#appView .app-bar > .tabs .tab:has-text("My Predictions")'); await page.waitForTimeout(400);
    const onPred = await geo(page);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    const onSum = await geo(page);
    console.log(`${scheme}: the view switch only shows on Match Summary, the sun/moon always:`, !onPred.viewShown && onPred.themeShown && onSum.viewShown && onSum.themeShown);
    // sun / moon force the theme, the menu switch follows
    await page.click('#topThemeSwitch [data-theme-mode="dark"]'); await page.waitForTimeout(300);
    const dark = await state(page);
    console.log(`${scheme}: moon forces Dark (saved, menu follows, moon highlighted):`, dark.theme === 'dark' && dark.savedTheme === 'dark' && dark.topThemeActive === 'dark' && dark.menuThemeActive === 'dark', JSON.stringify([dark.theme, dark.savedTheme, dark.topThemeActive, dark.menuThemeActive]));
    await page.click('#topThemeSwitch [data-theme-mode="light"]'); await page.waitForTimeout(300);
    const light = await state(page);
    console.log(`${scheme}: sun forces Light (saved, menu follows, sun highlighted):`, light.theme === 'light' && light.savedTheme === 'light' && light.topThemeActive === 'light' && light.menuThemeActive === 'light', JSON.stringify([light.theme, light.savedTheme, light.topThemeActive, light.menuThemeActive]));
    // Auto: the icon of the theme showing is highlighted and the tooltip says it is following the device
    await page.evaluate(() => changeTheme('auto')); await page.waitForTimeout(300);
    const auto = await state(page);
    console.log(`${scheme}: Auto highlights the theme showing (${scheme}) and the tooltip explains it:`, auto.topThemeActive === scheme && auto.menuThemeActive === 'auto' && auto.titles.every(t => /^Auto \(following your device\): click to force (Light|Dark)$/.test(t)), JSON.stringify([auto.topThemeActive, auto.titles]));
    await page.screenshot({ path: SHOTS + `bar-1440-${scheme}-auto.png`, clip: { x: 0, y: 0, width: 1440, height: 130 } });
    // the OS theme changes while Auto: the highlight follows
    const other = scheme === 'dark' ? 'light' : 'dark';
    await page.emulateMedia({ colorScheme: other }); await page.waitForTimeout(400);
    const flipped = await state(page);
    console.log(`${scheme}: in Auto, an OS theme change moves the highlight:`, flipped.topThemeActive === other, JSON.stringify(flipped.topThemeActive));
    await context.close();
  }
  { const { context, page } = await open(1920, 1080, 'light');
    await page.screenshot({ path: SHOTS + 'bar-1920-light.png', clip: { x: 0, y: 0, width: 1920, height: 130 } });
    await page.click('#topThemeSwitch [data-theme-mode="dark"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: SHOTS + 'bar-1920-dark.png', clip: { x: 0, y: 0, width: 1920, height: 130 } });
    await context.close(); }
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
