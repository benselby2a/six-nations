// After the app reloads itself for a new version (js/connectivity.js sets the sessionStorage flag, the head script turns it into html.app-reloaded), the loading screen under the spinner says
// "Updating to the latest version..." instead of "Loading...". An ordinary open still says "Loading...". The bundle is held back so the loading screen is what is on screen.
const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '../../../index.html');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const c of [{ name: 'after an automatic update reload', flag: true, want: /Updating to the latest version/ }, { name: 'an ordinary open', flag: false, want: /^Loading\.\.\.$/ }]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([flag]) => { if (flag && !sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); sessionStorage.setItem('rugbyPredictorFadeIn', '1'); } }, [c.flag]);
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) };' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/dist/app.min.js**', async r => { await new Promise(res => setTimeout(res, 1500)); r.continue(); });
    await page.goto('file://' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const t = document.getElementById('loadingText'); const s = document.querySelector('.loading-spinner'); return { text: t.textContent, below: t.getBoundingClientRect().top >= s.getBoundingClientRect().bottom - 1, visible: getComputedStyle(document.getElementById('loadingScreen')).display !== 'none' }; });
    console.log(c.name + ': the loading text is "' + r.text + '", under the spinner, on screen:', c.want.test(r.text) && r.below && r.visible, JSON.stringify(r));
    await context.close();
  }
  console.log('pageerrors', errors.length);
  await browser.close();
})();
