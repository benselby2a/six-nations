// Stuck on the spinner safety net (index.html): if the bundle never arrives or never starts, the app clears its saved copies and reloads once
// by itself; if that does not help it offers a Reload button. A normal start never shows either. The 12s wait is shortened with window.__stuckAfterMs.
const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async ({ bundle }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
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
    await page.goto('file://' + path); await page.waitForTimeout(3500);
    const r = await snap(page);
    console.log('bundle missing: reloaded itself once (?r=) and now offers the Reload button, not looping:', /\?r=\d+/.test(r.url) && r.button && /Still loading/.test(r.text) && r.fix === '1', JSON.stringify(r));
    await context.close(); }

  // 3. the bundle never answers: after the wait it tries one recovery, then shows the button
  { const { context, page } = await open({ bundle: 'hang' });
    await page.goto('file://' + path, { waitUntil: 'commit' }); await page.waitForTimeout(5000);
    const r = await snap(page);
    console.log('bundle hangs: one automatic recovery, then the Reload button:', /\?r=\d+/.test(r.url) && r.button && r.fix === '1', JSON.stringify(r));
    await context.close(); }

  console.log('pageerrors', errors.length);
  await browser.close();
})();
