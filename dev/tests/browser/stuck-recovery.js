// Stuck on the spinner safety net (index.html): if the bundle never arrives or never starts within 5s, the app first falls back to the previous
// version (?fallback=1, served by sw.js from its saved copy), once; then clears its saved copies and reloads once; then offers a Reload button.
// A normal start never shows any of that. The 5s wait is shortened with window.__stuckAfterMs.
const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async ({ bundle }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const visited = []; page.on('framenavigated', f => { if (f === page.mainFrame()) visited.push(f.url().replace(/^.*index\.html/, '').replace(/r=\d+/, 'r=N')); });
    page.__visited = visited;
    await page.addInitScript(() => { window.__stuckAfterMs = 800; window.__noTourPrompts = true; window.__noWhatsNew = true; });
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) };' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    if (bundle === 'missing') await page.route('**/dist/app.min.js**', r => r.abort());
    if (bundle === 'hang') await page.route('**/dist/app.min.js**', () => { /* never answered */ });
    return { context, page };
  };
  const snap = (page) => page.evaluate(() => ({ text: document.getElementById('loadingText').textContent, button: !!document.getElementById('stuckReload'), url: location.search, fix: sessionStorage.getItem('rugbyPredictorStuckFix'), ready: !!window.__appReady }));

  // 1. a normal start: ready, no recovery, no button
  { const { context, page } = await open({ bundle: 'ok' });
    await page.goto('file://' + path); await page.waitForTimeout(2500);
    const r = await snap(page);
    console.log('normal start: app ready, no recovery marker, no button:', r.ready && !r.button && r.fix === null && r.url === '', JSON.stringify(r));
    await context.close(); }

  // 2. the bundle fails to load: it recovers at once (reload with ?r=), once; a second failure shows the Reload button
  { const { context, page } = await open({ bundle: 'missing' });
    await page.goto('file://' + path); await page.waitForTimeout(6000);
    const r = await snap(page);
    const v = page.__visited.join(' > ');
    console.log('bundle missing: first the previous version (?fallback=1), then one clean reload (?r=), then the Reload button, no looping:', /fallback=1/.test(v) && /\?r=N$/.test(v) && v.indexOf('fallback=1') < v.lastIndexOf('?r=N') && r.button && /Still loading/.test(r.text) && r.fix === '1', v);
    await context.close(); }

  // 3. the bundle never answers: after the wait it tries one recovery, then shows the button
  { const { context, page } = await open({ bundle: 'hang' });
    await page.goto('file://' + path, { waitUntil: 'commit' }); await page.waitForTimeout(9000);
    const r = await snap(page);
    const v = page.__visited.join(' > ');
    console.log('bundle hangs: previous version first, then one clean reload, then the Reload button:', /fallback=1/.test(v) && /\?r=N$/.test(v) && r.button && r.fix === '1', v);
    await context.close(); }

  console.log('pageerrors', errors.length);
  await browser.close();
})();
