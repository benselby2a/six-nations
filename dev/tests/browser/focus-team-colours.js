// Focus view: each team abbreviation in the match headers is in the colour Classic uses for that team's name (PDF_SCHEMES.team), on a chip
// the colour of the Classic sheet; Compact keeps its plain headings. Contrast against the chip is measured and logged.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');

// the same mocked database and sign-in as plain-headings.js
const src = fs.readFileSync(require('path').join(__dirname, 'plain-headings.js'), 'utf8');
const mock = src.slice(src.indexOf('const mock = `') + 'const mock = `'.length, src.indexOf('})();`;') + 5);

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { window.__noTourPrompts = true; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
  await page.goto('file://' + path); await page.waitForTimeout(800);
  await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(150);
  await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(1000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(800);

  // what the header spans look like: the text, colour, chip background and the box heights
  const read = () => page.evaluate(() => [...document.querySelectorAll('.summary-table thead .match-teams span')].map(e => {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    return { text: e.textContent.trim(), tint: e.classList.contains('team-tint'), color: cs.color, bg: cs.backgroundImage, h: Math.round(r.height * 10) / 10, clone: !!e.closest('.summary-table-clone, .summary-sticky-zone') };
  }));
  const names = { ENG: 'England', FRA: 'France', IRE: 'Ireland', ITA: 'Italy', SCO: 'Scotland', WAL: 'Wales' };
  const palette = await page.evaluate(() => ({ light: PDF_SCHEMES.light.team, dark: PDF_SCHEMES.dark.team }));

  // England and Wales are in the 2027 fixtures, which have no summary table in this mock: check their spans straight from the renderer
  const direct = await page.evaluate(() => ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'].map(t => { const d = document.createElement('div'); d.innerHTML = simpleTeamSpan(t); const e = d.firstChild; return { t, light: e.style.getPropertyValue('--team-l'), dark: e.style.getPropertyValue('--team-d'), text: e.textContent }; }));
  const toRgb = (c) => 'rgb(' + c.join(', ') + ')';
  console.log('all six teams carry exactly the Classic light and dark colours (single source PDF_SCHEMES):', direct.every(d => d.light === toRgb(palette.light[d.t]) && d.dark === toRgb(palette.dark[d.t])), JSON.stringify(direct.map(d => d.text)));
  const extra = ['England', 'Wales'].map(t => ({ t, light: Math.round(ratio(palette.light[t], [255, 255, 255]) * 100) / 100, dark: Math.round(ratio(palette.dark[t], [11, 26, 20]) * 100) / 100 }));
  console.log('England and Wales contrast on the chip (light on white, dark on the dark sheet colour):', JSON.stringify(extra), extra.every(x => x.light >= 4.5 && x.dark >= 4.5));

  for (const year of [2026]) {
    await page.evaluate((y) => switchYear(y), year); await page.waitForTimeout(500);
    await page.evaluate(() => setSummaryView('compact')); await page.waitForTimeout(500);
    const compact = await read();
    console.log(year + ' Compact is unchanged (no team colour chips, plain heading colour):', compact.length > 0 && compact.every(x => !x.tint && x.bg === 'none') && new Set(compact.map(x => x.color)).size === 1);
    await page.evaluate(() => setSummaryView('simple')); await page.waitForTimeout(500);
    const heightsBefore = await page.evaluate(() => { const th = document.querySelector('.summary-table:not(.summary-table-clone) thead th.match-header-cell'); return Math.round(th.getBoundingClientRect().height); });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); }, theme); await page.waitForTimeout(300);
      const spans = await read();
      const chipBg = theme === 'dark' ? [11, 26, 20] : [255, 255, 255];
      const rows = spans.map(x => {
        const team = names[x.text]; const want = palette[theme][team];
        const got = rgb(x.color);
        return { text: x.text, tint: x.tint, same: !!want && got.every((v, i) => v === want[i]), chip: /gradient/.test(x.bg), ratio: want ? Math.round(ratio(want, chipBg) * 100) / 100 : null, clone: x.clone };
      });
      const ok = rows.length > 0 && rows.every(r => r.tint && r.same && r.chip);
      console.log(year + ' Focus ' + theme + ': every team abbreviation (header and pinned copy) is in its Classic colour on a chip:', ok, JSON.stringify(rows.filter(r => !r.clone)));
      console.log(year + ' Focus ' + theme + ' contrast of the team colour against its chip:', JSON.stringify(Object.fromEntries(rows.filter(r => !r.clone).map(r => [r.text, r.ratio]))));
      console.log(year + ' Focus ' + theme + ': the pinned header copy has the colours too:', rows.some(r => r.clone) ? rows.filter(r => r.clone).every(r => r.tint && r.same) : 'no copy on screen');
      if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-' + theme + '.png', clip: { x: 0, y: 130, width: 390, height: 330 } });
      if (theme === 'dark') {
        // dark theme: the Classic dark colours are readable (>= 4.5:1) on the chip
        console.log(year + ' dark: all six read at 4.5:1 or better on the chip:', rows.filter(r => !r.clone).every(r => r.ratio >= 4.5));
      } else if (year === 2026) {
        console.log('light: contrast on the white chip (Classic prints the same colours on the same white):', JSON.stringify(rows.filter(r => !r.clone).map(r => r.text + ' ' + r.ratio)));
      }
    }
    // the chip adds no height: the header cell is the same height with the chip rules switched off (the class removed)
    const heightsAfter = await page.evaluate(() => { const th = document.querySelector('.summary-table:not(.summary-table-clone) thead th.match-header-cell'); return Math.round(th.getBoundingClientRect().height); });
    const withoutChips = await page.evaluate(() => { const spans = [...document.querySelectorAll('.summary-table thead .team-tint')]; spans.forEach(s => s.classList.remove('team-tint')); const th = document.querySelector('.summary-table:not(.summary-table-clone) thead th.match-header-cell'); const h = Math.round(th.getBoundingClientRect().height); spans.forEach(s => s.classList.add('team-tint')); return h; });
    console.log(year + ' the chip adds no height (header cell the same with and without the chip class):', withoutChips === heightsAfter, withoutChips, heightsAfter);
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  }

  // an unknown team keeps the plain heading colour (no chip)
  const unknown = await page.evaluate(() => simpleTeamSpan('Springboks'));
  console.log('a team with no Classic colour is left plain:', !/team-tint/.test(unknown), unknown);
  console.log('errors', errors);
  await browser.close();
})();
