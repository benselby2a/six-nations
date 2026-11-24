// Tap or click a cell in Compact and Jumbo: its whole row and column are shaded with a light gold bar (::after overlay), the tapped cell a little
// stronger. Tapping another cell moves it, tapping the same cell or empty page clears it, a drag or scroll is not a tap, and a redraw clears it.
// The tap still opens what it opened (a prediction or match header opens its pop-up). Classic is not affected. Light and dark themes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path').resolve(__dirname, '../../../index.html');
const src = fs.readFileSync(require('path').join(__dirname, 'column-hover.js'), 'utf8');
const start = src.indexOf('const mock = `') + 'const mock = `'.length;
const mock = src.slice(start, src.indexOf('})();`;', start) + 5);
const SHOTS = '/tmp/claude-0/-home-user-six-nations/55e70b8c-24a4-53e8-973b-d120bef1189e/scratchpad/';

const goldish = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return false; const [r, g, b, a] = m[1].split(',').map(Number); return r > 200 && g > 150 && b < 140 && (a === undefined || a > 0.05); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (scheme) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, colorScheme: scheme });
    const page = await context.newPage();
    await page.addInitScript(() => { window.__noTourPrompts = true; window.__noWhatsNew = true; });
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await page.route('**/cdn.jsdelivr.net/**', r => r.request().url().includes('supabase') ? r.fallback() : r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.goto('file://' + path); await page.waitForTimeout(300);
    await page.fill('#loginEmail', 'ben@example.com'); await page.click('#sendLoginCodeBtn'); await page.waitForTimeout(200);
    await page.fill('#loginCode', '123456'); await page.click('#verifyCodeBtn'); await page.waitForTimeout(400);
    await page.evaluate(() => switchYear(2026)); await page.waitForTimeout(700);
    await page.click('#appView .app-bar > .tabs .tab:has-text("Match Summary")'); await page.waitForTimeout(600);
    return { page, context };
  };
  const T = '.summary-table:not(.summary-table-clone)';
  const state = (page) => page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const real = '.summary-table:not(.summary-table-clone)';
    const idx = (s) => q(s).map(c => c.cellIndex);
    const rowSel = q(real + ' .row-sel'), colSel = q(real + ' .col-sel'), cellSel = q(real + ' .cell-sel');
    return { rowCells: rowSel.length, rowTr: [...new Set(rowSel.map(c => c.parentElement.rowIndex))], colCells: colSel.length, colIdx: [...new Set(idx(real + ' .col-sel'))], cell: cellSel.length,
      rows: q(real + ' tbody tr').length, cols: document.querySelector(real + ' tbody tr').cells.length, scrollCopy: idx('.summary-sticky-scroll .col-sel'), pinCopy: idx('.summary-sticky-pinned .col-sel') };
  });
  const overlay = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const p = getComputedStyle(e, '::after'); return { bg: p.backgroundColor, content: p.content, pos: p.position }; }, sel);
  const chatShown = (page) => page.evaluate(() => { const m = document.getElementById('fixtureChat') || document.querySelector('.fixture-chat-sheet'); return !!m && !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none'; });

  for (const scheme of ['light', 'dark']) for (const view of ['compact', 'simple']) {
    const { page, context } = await open(scheme);
    const label = (view === 'compact' ? 'Compact' : 'Jumbo') + ' ' + scheme;
    await page.evaluate((v) => setSummaryView(v), view); await page.waitForTimeout(500);
    // tap a prediction cell (it also opens its pop-up, which is closed again so the page is as before)
    const cell = page.locator(T + ' tbody tr:nth-child(2) td').nth(4);
    await cell.tap(); await page.waitForTimeout(250);
    const a = await state(page);
    console.log(label + ': tapping a body cell shades its whole row and its whole column (one row, one column):', JSON.stringify({ rowCells: a.rowCells, cols: a.cols, colCells: a.colCells, rows: a.rows, colIdx: a.colIdx, cell: a.cell }), a.rowCells === a.cols && a.rowTr.length === 1 && a.colIdx.length === 1 && a.colIdx[0] === 4 && a.colCells === a.rows + 1 && a.cell === 1);
    console.log(label + ': the sideways header copy is shaded at the same column:', JSON.stringify(a.scrollCopy), a.scrollCopy.length === 1 && a.scrollCopy[0] === 4);
    console.log(label + ': the tap still opens the prediction pop-up (it is not swallowed):', await chatShown(page));
    await page.evaluate(() => { if (typeof closeFixtureChat === 'function') closeFixtureChat(); }); await page.waitForTimeout(250);
    const afterClose = await state(page);
    console.log(label + ': the selection is still there after the pop-up closes:', afterClose.cell === 1 && afterClose.colIdx[0] === 4);
    const ov = await overlay(page, T + ' tbody tr:nth-child(1) td:nth-child(5)');       // same column, another row: column bar only
    const ovCell = await overlay(page, T + ' tbody tr:nth-child(2) td:nth-child(5)');    // the tapped cell
    const ovRow = await overlay(page, T + ' tbody tr:nth-child(2) td:nth-child(2)');     // same row, Name column
    console.log(label + ': the bars are gold (not grey) and the crossing (tapped) cell is shaded once, the same as the bars:', JSON.stringify({ col: ov && ov.bg, cell: ovCell && ovCell.bg, row: ovRow && ovRow.bg }), goldish(ov && ov.bg) && goldish(ovCell && ovCell.bg) && goldish(ovRow && ovRow.bg) && parseFloat(ovCell.bg.split(',')[3]) === parseFloat(ov.bg.split(',')[3]) && ovCell.bg === ovRow.bg);
    const pinned = await page.evaluate(() => { const c = document.querySelector('.summary-table:not(.summary-table-clone) tbody tr:nth-child(2) td.competitor-name'); const s = getComputedStyle(c); return { pos: s.position, bg: s.backgroundColor }; });
    console.log(label + ': the pinned Name cell stays sticky and opaque:', JSON.stringify(pinned), pinned.pos === 'sticky' && !/rgba\(0, 0, 0, 0\)/.test(pinned.bg));
    await page.screenshot({ path: SHOTS + 'tap-' + view + '-' + scheme + '.png', clip: { x: 0, y: 150, width: 390, height: 520 } });
    // another cell moves the selection
    await page.locator(T + ' tbody tr:nth-child(1) td').nth(5).tap(); await page.waitForTimeout(250);
    await page.evaluate(() => { if (typeof closeFixtureChat === 'function') closeFixtureChat(); }); await page.waitForTimeout(200);
    const b = await state(page);
    console.log(label + ': tapping another cell moves the selection (still one row, one column):', JSON.stringify({ rows: b.rowTr, col: b.colIdx }), b.rowTr.length === 1 && b.rowTr[0] !== a.rowTr[0] && b.colIdx.length === 1 && b.colIdx[0] === 5 && b.cell === 1);
    // the same cell again clears it (a Name cell has no pop-up)
    const name = page.locator(T + ' tbody tr:nth-child(1) td.competitor-name');
    await name.tap(); await page.waitForTimeout(200);
    const n1 = await state(page);
    await name.tap(); await page.waitForTimeout(200);
    const n2 = await state(page);
    console.log(label + ': tapping a Name cell selects its row and the Name column, tapping it again clears:', JSON.stringify({ first: [n1.colIdx, n1.cell], second: [n2.colCells, n2.rowCells, n2.cell] }), n1.colIdx.join() === '1' && n1.cell === 1 && n2.colCells === 0 && n2.rowCells === 0 && n2.cell === 0);
    // empty page clears it
    await name.tap(); await page.waitForTimeout(200);
    await page.touchscreen.tap(195, 8); await page.waitForTimeout(250);
    const e = await state(page);
    console.log(label + ': a tap on empty page clears it:', JSON.stringify({ cells: e.cell, col: e.colCells }), e.cell === 0 && e.colCells === 0);
    // a drag across a cell: the cell is highlighted while the finger moves the table, and the highlight fades away once the scrolling has stopped
    const box = await page.locator(T + ' tbody tr:nth-child(2) td').nth(4).boundingBox();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 60, y: box.y + 20 }] });
    for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 60 - k * 12, y: box.y + 22 }] }); await page.waitForTimeout(40); }
    const dDuring = await state(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
    const dJust = await state(page);   // finger up, momentum / debounce still running
    await page.waitForTimeout(900);
    const dAfter = await state(page);
    console.log(label + ': a drag shows the highlight while scrolling and it is gone after the scrolling stops:', JSON.stringify({ during: dDuring.cell, justAfterLift: dJust.cell, after: [dAfter.cell, dAfter.colCells, dAfter.rowCells] }), dDuring.cell === 1 && dDuring.colCells > 0 && dAfter.cell === 0 && dAfter.colCells === 0 && dAfter.rowCells === 0);
    // a tap selection, then the table scrolls: still shown while it scrolls, cleared ~300ms after the last scroll event
    await name.tap(); await page.waitForTimeout(200);
    const s0 = await state(page);
    const scrolled = await page.evaluate(async () => {
      const box = document.querySelector('.summary-container'); const q = () => document.querySelectorAll('.summary-table-wrap .cell-sel').length;
      if (box.scrollWidth <= box.clientWidth + 40) document.querySelector('.summary-table:not(.summary-table-clone)').style.minWidth = (box.clientWidth + 400) + 'px';   // the mock's table may fit the screen: make it scrollable
      const seen = [];
      for (let k = 1; k <= 6; k++) { box.scrollLeft = k * 20; await new Promise(r => setTimeout(r, 60)); seen.push(q()); }
      return seen;
    });
    await page.waitForTimeout(800);
    const s1 = await state(page);
    console.log(label + ': a tap selection stays visible while the table scrolls and is cleared after the scrolling stops:', JSON.stringify({ before: s0.cell, whileScrolling: scrolled, after: [s1.cell, s1.colCells] }), s0.cell === 1 && scrolled.every(n => n === 1) && s1.cell === 0 && s1.colCells === 0);
    // a tap without any scrolling stays until something else clears it
    await name.tap(); await page.waitForTimeout(900);
    const s2 = await state(page);
    console.log(label + ': a tap with no scrolling stays selected:', JSON.stringify({ cell: s2.cell, col: s2.colCells }), s2.cell === 1 && s2.colCells > 0);
    // a redraw clears it
    await name.tap(); await page.waitForTimeout(200);
    await page.evaluate(() => showSummary()); await page.waitForTimeout(500);
    const r = await state(page);
    console.log(label + ': a redraw of the table clears it:', JSON.stringify({ cell: r.cell, col: r.colCells }), r.cell === 0 && r.colCells === 0);
    await context.close();
  }

  // a match header tap still opens its pop-up and shades its column only
  {
    const { page, context } = await open('light');
    await page.evaluate(() => setSummaryView('compact')); await page.waitForTimeout(500);
    await page.locator(T + ' thead th.match-header-cell').first().tap({ force: true }); await page.waitForTimeout(300);
    const h = await state(page);
    console.log('Compact: a header tap shades its column (not a row) and still opens the match pop-up:', JSON.stringify({ rowCells: h.rowCells, colCells: h.colCells }), h.rowCells === 0 && h.colCells === h.rows + 1 && await chatShown(page));
    await context.close();
  }
  // Classic: nothing is selected
  {
    const { page, context } = await open('light');
    await page.evaluate(() => setSummaryView('classic')); await page.waitForTimeout(500);
    await page.locator('.pdfv-sheet td').nth(5).tap({ force: true }).catch(() => {}); await page.waitForTimeout(250);
    const n = await page.evaluate(() => document.querySelectorAll('.row-sel, .col-sel, .cell-sel').length);
    console.log('Classic: a tap selects nothing:', n, n === 0);
    await context.close();
  }
  console.log('pageerrors', errors.length, errors.slice(0, 2));
  await browser.close();
})();
