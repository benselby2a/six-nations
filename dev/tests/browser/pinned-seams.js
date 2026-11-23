// Pinned seams: the Rank and Name columns are sticky and opaque, but on a phone the table's left edge sits at a fractional pixel
// (10.59px = 31.78 device pixels at 3x), so the container's left edge and the Rank/Name seam fall inside a device pixel and whatever scrolls
// underneath (cell borders, column lines, tints) can show through as a hairline. Checked: (1) the pinned cells tile contiguously, (2) the
// Name cell reaches 1px over the Rank cell (the seam-proofing, ::before) so the seam is always covered, (3) with loud magenta/green scrolled
// cells dragged under the pinned columns, no device pixel beside the left edge or the seam is tinted. Compact and Jumbo, light and dark,
// 320 to 430px wide at 3x, with the iPhone-only CSS injected.
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
  const PNG = require('child_process');
  for (const scheme of ['light', 'dark']) {
    for (const width of [320, 360, 375, 390, 414, 430]) {
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
        await page.evaluate((m) => setSummaryView(m), mode); await page.waitForTimeout(600);
        const geo = await page.evaluate(() => {
          const box = document.querySelector('.summary-container'); const b = box.getBoundingClientRect(); const bl = parseFloat(getComputedStyle(box).borderLeftWidth) || 0;
          const real = document.querySelector('.summary-table:not(.summary-table-clone)');
          const gaps = []; let covered = true;
          for (const tr of real.querySelectorAll('tr')) {
            const rank = tr.querySelector('.rank-col'), name = tr.querySelector('td.competitor-name, th.competitor-col');
            if (!rank || !name) continue;
            const rr = rank.getBoundingClientRect(), nr = name.getBoundingClientRect();
            gaps.push(Math.abs(rr.right - nr.left), Math.abs(rr.left - (b.left + bl)));
            const pb = getComputedStyle(name, '::before'), pa = getComputedStyle(rank, '::after');
            if (pb.content === 'none' || parseFloat(pb.left) !== -1 || parseFloat(pb.width) !== 1 || pa.content === 'none' || parseFloat(pa.right) !== -1) covered = false;
          }
          return { maxGap: Math.max(...gaps), covered, rows: gaps.length / 2 };
        });
        // loud scrolled cells: magenta fill, green left lines
        const loud = await page.addStyleTag({ content: 'body .summary-table td.prediction-cell, body .summary-table th.match-header-cell { background: #ff00ff !important; background-image: none !important; box-shadow: inset 2px 0 0 #00ff00 !important; border-left: 1px solid #00ff00 !important; }' });
        let tinted = 0, shots = 0;
        for (const left of [0, 40, 90, 150, 230]) {
          await page.evaluate((l) => { document.querySelector('.summary-container').scrollLeft = l; window.scrollTo(0, 0); }, left); await page.waitForTimeout(250);
          const rows = await page.evaluate(() => [...document.querySelectorAll('.summary-table:not(.summary-table-clone) tbody tr')].map(tr => { const r = tr.querySelector('td.rank-col').getBoundingClientRect(); return { top: r.top, h: r.height, left: r.left, right: r.right }; }).filter(r => r.top > 0 && r.top + r.h < innerHeight));
          for (const r of rows.slice(0, 2)) {
            const png = await page.screenshot({ clip: { x: Math.floor(r.left) - 4, y: r.top + 3, width: Math.ceil(r.right - r.left) + 16, height: Math.max(6, r.h - 6) } });
            tinted += await page.evaluate(async ([b64, dpr, edge, seam]) => {
              const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
              const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
              let n = 0;
              // the strips beside the container's left edge and the Rank/Name seam (device pixels), over the whole height except the glyph rows are tolerated by the colour test itself
              for (const cx of [edge - 3, edge - 2, edge - 1, edge, edge + 1, edge + 2, seam - 3, seam - 2, seam - 1, seam, seam + 1, seam + 2]) {
                if (cx < 0 || cx >= img.width) continue;
                const col = g.getImageData(cx, 0, 1, img.height).data;
                for (let y = 0; y < img.height; y++) { const R = col[y * 4], G = col[y * 4 + 1], B = col[y * 4 + 2]; if ((R > 90 && B > 90 && G < 110 && R - G > 60) || (G > 150 && R < 120 && B < 120)) n++; }
              }
              return n;
            }, [png.toString('base64'), 3, Math.round((r.left - (Math.floor(r.left) - 4)) * 3), Math.round((r.right - (Math.floor(r.left) - 4)) * 3)]);
            shots++;
          }
        }
        await loud.evaluate((el) => el.remove());
        console.log(`${scheme} ${mode} @${width}: pinned cells tile (max gap ${geo.maxGap.toFixed(3)}px over ${geo.rows} rows), seam-proofing in place: ${geo.covered && geo.maxGap < 0.01}; no tinted pixel at the left edge or Rank/Name seam (${shots} strips): ${tinted === 0}${tinted ? ' (' + tinted + ' px)' : ''}`);
      }
      await context.close();
    }
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
