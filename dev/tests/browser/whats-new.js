// The "What's new" pop-up: shown once per person per note (remembered in localStorage), never to brand-new people,
// never while something else is open, admin notes only to admins, and it never breaks the app when storage is blocked.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');

// the same mocked database and sign-in as app-bar.js, with the competitor "sam" (not an admin) able to sign in as well
const appBar = fs.readFileSync(require('path').join(__dirname, 'app-bar.js'), 'utf8');
let mock = appBar.slice(appBar.indexOf('const mock = `') + 'const mock = `'.length, appBar.indexOf('})();`;') + 5);
mock = mock.replace("{id:2,username:'sam',nickname:'Sam',supported_teams:null}", "{id:2,username:'sam',nickname:'Sam',supported_teams:null,auth_user_id:'u-sam@example.com'}");

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  // seeds: localStorage values written once, before the first page load of this context (a reload keeps what the app has written since)
  const open = async ({ seeds = {}, email = 'ben@example.com', width = 390, blockStorage = false, colorScheme = 'light' } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme });
    const page = await context.newPage();
    await page.addInitScript(([seeds, block]) => {
      window.__whatsNewForce = true;
      if (!sessionStorage.getItem('__seeded')) { try { sessionStorage.setItem('__seeded', '1'); for (const k in seeds) localStorage.setItem(k, seeds[k]); } catch (error) { /* blocked */ } }
      if (block) { Storage.prototype.getItem = function () { throw new Error('blocked'); }; Storage.prototype.setItem = function () { throw new Error('blocked'); }; }
    }, [seeds, blockStorage]);
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', email); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn');
    return page;
  };
  const popup = (page) => page.evaluate(() => { const m = document.getElementById('whatsNewModal'); return m ? { notes: [...m.querySelectorAll('.whats-new-note')].map(n => n.dataset.note), titles: [...m.querySelectorAll('.whats-new-note h3')].map(h => h.textContent.trim()), label: m.getAttribute('aria-labelledby'), role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), text: m.textContent } : null; });
  const seen = (page, user) => page.evaluate((u) => JSON.parse(localStorage.getItem('whatsNewSeen:' + u) || 'null'), user);
  const ALL = ['2026-11-admin-predictions-upload', '2026-11-views-and-appearance'];
  const returning = (user) => ({ ['tourAnswered:' + user]: 'no', summaryViewMode: 'compact' });
  const signInAgain = async (page, email) => {
    await page.fill('#loginEmail', email); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn');
  };

  // 1. brand new on this device: no pop-up, everything quietly recorded as seen (they get the tour prompt instead)
  let page = await open();
  await page.waitForTimeout(2200);
  console.log('brand new: no pop-up:', (await popup(page)) === null, '| recorded as seen:', JSON.stringify(await seen(page, 'ben')), JSON.stringify(await seen(page, 'ben')) === JSON.stringify(ALL));
  await page.context().close();

  // 2. returning admin: the pop-up appears, newest note first, with the right dialog markup; Got it records both and it stays away after a reload
  page = await open({ seeds: returning('ben') });
  await page.waitForTimeout(2200);
  let p = await popup(page);
  console.log('returning admin sees the pop-up, newest first:', JSON.stringify(p && p.notes), !!p && p.notes[0] === ALL[0] && p.notes[1] === ALL[1]);
  console.log('dialog markup (role, modal, labelled by the title):', !!p && p.role === 'dialog' && p.modal === 'true' && p.label === 'whatsNewTitle', '| the admin note says who it is for:', !!p && /Admins/.test(p.titles[0]) && !/Admins/.test(p.titles[1]));
  console.log('text only (no emoji):', !!p && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(p.text));
  await page.click('#whatsNewGotIt'); await page.waitForTimeout(150);
  const afterGotIt = await seen(page, 'ben');
  console.log('Got it closes it and records both ids:', (await popup(page)) === null, JSON.stringify(afterGotIt), JSON.stringify((afterGotIt || []).slice().sort()) === JSON.stringify(ALL.slice().sort()));
  await page.reload(); await page.waitForTimeout(300);
  await signInAgain(page, 'ben@example.com'); await page.waitForTimeout(2200);
  console.log('after a reload it does not come back:', (await popup(page)) === null);

  // 3. a note nobody has seen yet pops up on its own, and only that one
  await page.evaluate(() => { WHATS_NEW.unshift({ id: 'test-new-note', audience: 'all', date: 'Today', title: 'A brand new thing', bullets: ['It does something.'] }); whatsNewDoneThisSession = false; maybeShowWhatsNew(); });
  await page.waitForTimeout(200);
  p = await popup(page);
  console.log('a newer unseen note pops up alone:', JSON.stringify(p && p.notes), !!p && p.notes.length === 1 && p.notes[0] === 'test-new-note');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  console.log('Escape closes it and records it:', (await popup(page)) === null, ((await seen(page, 'ben')) || []).includes('test-new-note'));

  // 4. the menu item shows the latest notes again, seen or not; the X button closes it
  await page.click('#avatarBtn'); await page.waitForTimeout(100);
  console.log("menu has a What's new item:", await page.evaluate(() => /What's new/.test(document.getElementById('menuWhatsNewBtn').textContent)));
  await page.click('#menuWhatsNewBtn'); await page.waitForTimeout(150);
  p = await popup(page);
  console.log('the menu item reopens the latest notes:', JSON.stringify(p && p.notes), !!p && p.notes.length === 3 && p.notes[0] === 'test-new-note');
  await page.click('#whatsNewClose'); await page.waitForTimeout(100);
  console.log('the X closes it:', (await popup(page)) === null);

  // 5. 390px: nothing overflows sideways; dark mode uses the app's surface colour
  await page.evaluate(() => openWhatsNew()); await page.waitForTimeout(150);
  const fit = await page.evaluate(() => { const c = document.querySelector('#whatsNewModal .modal-content'); const r = c.getBoundingClientRect(); const wide = [...c.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > r.right - 0.5).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right) + '/' + Math.round(r.right)); return { fits: c.scrollWidth <= c.clientWidth + 1, sw: c.scrollWidth, cw: c.clientWidth, wide, inside: r.left >= 0 && r.right <= innerWidth, page: document.documentElement.scrollWidth <= innerWidth }; });
  console.log('390px: no sideways overflow, card inside the screen:', JSON.stringify(fit), fit.fits && fit.inside && fit.page);
  await page.evaluate(() => changeTheme('dark')); await page.waitForTimeout(200);
  const dark = await page.evaluate(() => { const c = document.querySelector('#whatsNewModal .modal-content'); return { bg: getComputedStyle(c).backgroundColor, theme: document.documentElement.getAttribute('data-theme') }; });
  console.log('dark mode: the card uses the surface colour:', JSON.stringify(dark), dark.theme === 'dark' && dark.bg === 'rgb(18, 38, 28)');
  await page.context().close();

  // 6. a competitor who is not an admin never sees the admin note
  page = await open({ seeds: returning('sam'), email: 'sam@example.com' });
  await page.waitForTimeout(2200);
  p = await popup(page);
  console.log('non-admin sees only the general note:', JSON.stringify(p && p.notes), !!p && p.notes.length === 1 && p.notes[0] === ALL[1]);
  await page.click('#whatsNewGotIt'); await page.waitForTimeout(100);
  console.log('and only that one is recorded for them:', JSON.stringify(await seen(page, 'sam')), JSON.stringify(await seen(page, 'sam')) === JSON.stringify([ALL[1]]));
  await page.context().close();

  // 7. not while the tour is open; it comes once the tour is finished
  page = await open({ seeds: returning('ben') });
  await page.waitForFunction(() => typeof startTour === 'function' && !document.getElementById('appView').classList.contains('hidden'));
  await page.evaluate(() => startTour()); await page.waitForTimeout(2600);
  console.log('tour open: no pop-up on top of it:', (await popup(page)) === null, await page.evaluate(() => document.body.classList.contains('tour-open')));
  await page.evaluate(() => endTour()); await page.waitForTimeout(1800);
  console.log('tour closed: the pop-up comes:', (await popup(page)) !== null);
  await page.context().close();

  // 8. while another pop-up is open it waits (here the sign-in tour prompt)
  page = await open({ seeds: { summaryViewMode: 'compact' } });   // used before, but never answered the tour prompt: the prompt shows
  await page.waitForTimeout(2200);
  const promptOpen = await page.evaluate(() => !document.getElementById('tourPromptModal').classList.contains('hidden'));
  console.log('tour prompt open: the notice waits:', promptOpen, (await popup(page)) === null);
  await page.evaluate(() => answerTourPrompt(false)); await page.waitForTimeout(2200);
  console.log('after the prompt is answered it shows:', (await popup(page)) !== null);
  await page.context().close();

  // 9. storage blocked: no crash, shown once per page load at most
  page = await open({ blockStorage: true });
  await page.waitForTimeout(2200);
  p = await popup(page);
  console.log('blocked storage: it still shows (once), nothing crashes:', p !== null);
  await page.click('#whatsNewGotIt'); await page.waitForTimeout(100);
  await page.evaluate(() => whatsNewSchedule()); await page.waitForTimeout(1800);
  console.log('and does not come back during this page load:', (await popup(page)) === null);
  await page.context().close();

  await browser.close();
  console.log('errors', JSON.stringify(errors));
})();
