// Sideways scrolling in Compact and Jumbo snaps to whole match columns against the pinned Rank/Name columns, so when the table comes to rest
// no sliver of a scrolled-under column (a cut-off score chip in the header, or a cell edge) shows beside the pinned Name column.
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

  for (const scheme of ['light', 'dark']) for (const width of [360, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, colorScheme: scheme });
    const page = await context.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(100);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(800);
    await page.addStyleTag({ content: ios });
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(600);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(500);
    for (const mode of ['compact', 'simple']) {
      await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(700);
      const results = [];
      for (const left of [23, 61, 110, 175]) {
        await page.evaluate((l) => { document.querySelector('.summary-container').scrollLeft = l; }, left); await page.waitForTimeout(500);
        results.push(await page.evaluate(() => {
          const box = document.querySelector('.summary-container'); const b = box.getBoundingClientRect();
          const real = document.querySelector('.summary-table:not(.summary-table-clone)');
          const pinRight = real.querySelector('td.competitor-name').getBoundingClientRect().right;
          const atEnd = box.scrollLeft >= box.scrollWidth - box.clientWidth - 1;
          // the first match column whose right edge is past the pinned edge must start exactly at the pinned edge (no cut-off sliver)
          const first = [...real.querySelectorAll('thead th.match-header-cell')].map(th => th.getBoundingClientRect()).find(r => r.right > pinRight + 1);
          return { scrollLeft: Math.round(box.scrollLeft), gap: first ? Math.round((first.left - pinRight) * 10) / 10 : null, atEnd };
        }));
      }
      const ok = results.every(r => r.atEnd || (r.gap !== null && Math.abs(r.gap) <= 1.5));
      console.log(`${scheme} ${mode} @${width}: at rest the first visible match column lines up with the pinned columns (no cut-off sliver beside them):`, ok, JSON.stringify(results));
    }
    await context.close();
  }
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
