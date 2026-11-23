// No white flash on reload in dark mode (the cookie fallback is not testable from a file:// page): the saved colour mode is applied by a tiny inline script in <head> before the first paint,
// not only later by the bundle. The bundle (dist/app.min.js) is held back for 1.5s here, so what the page looks like BEFORE it runs is what a reload shows first.
const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const isDark = (c) => c.length === 3 && Math.max(...c) < 60;
const isLight = (c) => c.length === 3 && Math.min(...c) > 200;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const cases = [
    { name: 'explicit Dark (OS light)', os: 'light', seed: { rugbyPredictorColourMode: 'dark' }, dark: true },
    { name: 'Auto with the OS in dark', os: 'dark', seed: {}, dark: true },
    { name: 'explicit Light (OS dark) stays light', os: 'dark', seed: { rugbyPredictorColourMode: 'light' }, dark: false },
    { name: 'Auto with the OS in light stays light', os: 'light', seed: {}, dark: false },
    { name: 'old theme setting "dark" (no new key)', os: 'light', seed: { rugbyPredictorTheme: 'dark' }, dark: true },
  ];
  for (const c of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: c.os });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([seed]) => {
      if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const k in seed) localStorage.setItem(k, seed[k]); }
    }, [c.seed]);
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) };' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    // hold the bundle back so the first frames are what is on screen before it runs
    await page.route('**/dist/app.min.js**', async r => { await new Promise(res => setTimeout(res, 1500)); r.continue(); });
    const nav = page.goto('file://' + path, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.body && getComputedStyle(document.body).backgroundColor !== '', null, { timeout: 5000 });
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), body: getComputedStyle(document.body).backgroundColor, html: getComputedStyle(document.documentElement).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, bundleRan: typeof loadUserTheme === 'function' }));
    const buf = await page.screenshot({ clip: { x: 150, y: 400, width: 1, height: 1 } });
    const px = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); }, buf.toString('base64'));
    const bodyRgb = rgb(before.body), htmlRgb = rgb(before.html);
    const ok = c.dark
      ? before.theme === 'dark' && isDark(bodyRgb) && isDark(htmlRgb) && isDark(px) && /dark/.test(before.scheme)
      : before.theme !== 'dark' && isLight(bodyRgb) && isLight(px);
    console.log(c.name + ' (before the bundle runs: ' + (before.bundleRan ? 'it ALREADY ran, test is not isolating' : 'bundle not run yet') + '):', JSON.stringify({ theme: before.theme, body: before.body, html: before.html, scheme: before.scheme, pixel: px }), ok && !before.bundleRan);
    await nav.catch(() => {});
    await page.waitForTimeout(1800);
    // once the bundle has run, the same theme is still applied (nothing changes)
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log('  after the bundle runs the theme is unchanged:', after === before.theme, JSON.stringify({ before: before.theme, after }));
    await context.close();
  }
  // switching Dark -> Light in the app must still repaint light (the early script leaves no inline overrides behind)
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('rugbyPredictorColourMode', 'dark'); } catch (e) {} });
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) };' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => { changeTheme('light'); const h = getComputedStyle(document.documentElement).backgroundColor, b = getComputedStyle(document.body).backgroundColor; changeTheme('dark'); return { h, b, inline: document.documentElement.getAttribute('style') }; });
    console.log('switching to Light after an early Dark repaints light, no leftover inline style:', JSON.stringify(r), !isDark(rgb(r.b)) && !r.inline);
    await context.close();
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
