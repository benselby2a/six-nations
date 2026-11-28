// The score table must never paint outside its own left and right edges: when the table (or the pinned header's sideways layer) is scrolled,
// nothing of the scrolling columns may show in the page gutter to the left of the table (the strip between the screen's edge and the table),
// nor between the table's edge and the pinned Rank / Name columns. Checked on a phone at several sideways and page scroll positions in Compact
// and Jumbo, light and dark, with the iPhone-only CSS injected. Hit testing (elementsFromPoint) respects clipping, so a cell that leaks is found.
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
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, colorScheme: scheme });
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
      for (const sy of [0, 420]) {
        for (const pos of [0, 120, 250, 'max']) {
          await page.evaluate(([p, y]) => { const b = document.querySelector('.summary-container'); b.scrollLeft = p === 'max' ? b.scrollWidth : p; window.scrollTo(0, y); }, [pos, sy]);
          await page.waitForTimeout(300);
          const r = await page.evaluate(() => {
            const box = document.querySelector('.summary-container');
            const b = box.getBoundingClientRect();
            const real = document.querySelector('.summary-table:not(.summary-table-clone)');
            const rank = real.querySelector('td.rank-col').getBoundingClientRect();
            const inner = document.querySelector('.summary-sticky-inner').getBoundingClientRect();
            const ys = [];
            const top = Math.max(b.top, 0) + 4, bottom = Math.min(b.bottom, window.innerHeight) - 4;
            for (let y = top; y < bottom; y += 14) ys.push(y);
            if (window.scrollY > 0) for (let y = inner.top + 4; y < inner.bottom - 4; y += 14) ys.push(y);
            const inTable = (e) => e.closest && e.closest('.summary-table, .summary-sticky-scroll, .summary-sticky-pinned, .summary-sticky-inner, .summary-container');
            const hits = [];
            for (const y of ys) {
              // left gutter (screen edge to the table's edge) and right gutter
              for (const x of [1, b.left / 2, b.left - 1, b.right + 1, (b.right + innerWidth) / 2, innerWidth - 1]) {
                if (x < 0 || x > innerWidth - 0.5) continue;
                if (x > b.left - 0.01 && x < b.right + 0.01) continue;
                const els = document.elementsFromPoint(x, y).filter(inTable);
                if (els.length) hits.push([Math.round(x), Math.round(y), els[0].tagName + '.' + String(els[0].className).slice(0, 30)]);
              }
            }
            // between the table's inner edge and the pinned Rank column no scrolling cell may be the topmost thing
            const scrollers = [];
            for (const y of ys) {
              for (const x of [b.left + 1.2, rank.left + 1]) {
                const top1 = document.elementsFromPoint(x, y)[0];
                if (top1 && top1.closest && top1.closest('td.prediction-cell, th.match-header-cell')) scrollers.push([Math.round(x), Math.round(y), top1.tagName]);
              }
            }
            return { hits, scrollers, probes: ys.length };
          });
          results.push({ pos, sy, ...r });
        }
      }
      const bad = results.filter(r => r.hits.length || r.scrollers.length);
      console.log(`${scheme} ${mode}: nothing of the table paints in the gutters or over the pinned columns (${results.length} scroll positions, ${results[0].probes}+ probes each):`, bad.length === 0, JSON.stringify(bad.slice(0, 2).map(r => ({ pos: r.pos, sy: r.sy, hits: r.hits.slice(0, 2), scrollers: r.scrollers.slice(0, 2) }))));
    }
    await context.close();
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
