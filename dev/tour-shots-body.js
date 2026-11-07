  // ---- appended to the mock-Supabase head by dev/tour-shots.sh: takes the tour pictures on example data ----
  const fs = require('fs'), crypto = require('crypto'), REPO = '__REPO__';
  await page.waitForTimeout(300);
  const dismiss = async (name) => { const b = page.locator(`button:has-text("${name}")`).first(); if (await b.isVisible().catch(() => false)) await b.click(); };
  await page.evaluate(() => { localStorage.setItem('tourAnswered:ben', 'no'); localStorage.setItem('adminTourAnswered:ben', 'no'); });
  await dismiss('No thanks');
  await page.addScriptTag({ content: fs.readFileSync(REPO + '/dev/tour-demo.js', 'utf8') });
  await page.evaluate(() => enterTourDemo());
  await page.waitForTimeout(500);

  // Finds an element from a spec: a CSS selector, {sel, text} (button/element whose text starts with it), or {visible: sel} (first one actually on screen)
  await page.evaluate(() => {
    window.__find = (spec) => {
      if (typeof spec === 'string') return document.querySelector(spec);
      if (spec.text) return [...document.querySelectorAll(spec.sel)].find(e => e.offsetParent && e.textContent.trim().startsWith(spec.text)) || null;
      if (spec.visible) {
        const container = document.querySelector('.summary-container');
        const sticky = container && container.querySelector('th.pts-col');
        const edge = sticky ? sticky.getBoundingClientRect().right : 0;
        const right = container ? container.getBoundingClientRect().right : innerWidth;
        return [...document.querySelectorAll(spec.visible)].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= edge + 2 && r.right <= right; }) || null;
      }
      return null;
    };
    window.__rects = (specs) => specs.map(s => { const el = window.__find(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  });

  const manifest = {};
  const shot = async (id, { before, scrollTo, clip, marks, maxH }) => {
    if (before) await before();
    await page.evaluate((sel) => { window.scrollTo(0, 0); if (sel) { const el = window.__find(sel); if (el) el.scrollIntoView({ block: 'start' }); } }, scrollTo || null);
    await page.waitForTimeout(250);
    const clipRects = (await page.evaluate((specs) => window.__rects(specs), clip)).filter(Boolean);
    if (!clipRects.length) { console.log('NO CLIP for', id); return; }
    const pad = 10;
    let x0 = Math.max(0, Math.min(...clipRects.map(r => r.x)) - pad), y0 = Math.max(0, Math.min(...clipRects.map(r => r.y)) - pad);
    let x1 = Math.min(390, Math.max(...clipRects.map(r => r.x + r.w)) + pad), y1 = Math.min(1500, Math.max(...clipRects.map(r => r.y + r.h)) + pad);
    if (maxH && y1 - y0 > maxH) y1 = y0 + maxH;
    const c = { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
    const markRects = await page.evaluate((specs) => window.__rects(specs), marks);
    const buf = await page.screenshot({ clip: c, type: 'jpeg', quality: 82 });
    fs.mkdirSync(REPO + '/tour-images', { recursive: true });
    fs.writeFileSync(`${REPO}/tour-images/${id}.jpg`, buf);
    const pct = (v, total) => Math.round(v / total * 1000) / 10;
    manifest[id] = {
      src: `tour-images/${id}.jpg`, v: crypto.createHash('md5').update(buf).digest('hex').slice(0, 8), w: c.width * 2, h: c.height * 2,
      marks: markRects.map((r, i) => {
        if (!r) return null;
        const rx = Math.max(r.x, c.x), ry = Math.max(r.y, c.y), rr = Math.min(r.x + r.w, c.x + c.width), rb = Math.min(r.y + r.h, c.y + c.height);
        if (rr <= rx || rb <= ry) return null;
        return { n: i + 1, x: pct(rx - c.x, c.width), y: pct(ry - c.y, c.height), w: pct(rr - rx, c.width), h: pct(rb - ry, c.height) };
      }).filter(Boolean)
    };
    console.log(id, c.width + 'x' + c.height, 'marks:', manifest[id].marks.length, Math.round(buf.length / 1024) + 'KB');
  };
  const clickTab = async (text) => { await page.evaluate((t) => { const b = [...document.querySelectorAll('.tabs .tab')].find(e => e.offsetParent && e.textContent.trim() === t); if (b) b.click(); }, text); await page.waitForTimeout(500); };
  const clickAdmin = async (text) => { await page.evaluate((t) => { setAdminPanelCollapsed(false); const b = [...document.querySelectorAll('.admin-tabs .tab')].find(e => e.textContent.trim() === t); if (b) b.click(); }, text); await page.waitForTimeout(600); };
  const tab = (t) => ({ sel: '.tabs .tab', text: t });

  // ---- the app tour ----
  await shot('predictions', { before: () => clickTab('My Predictions'), clip: [tab('My Predictions'), '#matchesContainer .prediction-table-container'], marks: [tab('My Predictions'), '#matchesContainer .prediction-table-container button.btn-success'], maxH: 760 });
  await shot('score', { before: async () => { await clickTab('Match Summary'); await page.evaluate(() => { document.querySelector('#summaryTab > div:first-child').style.display = 'none'; }); }, clip: [tab('Match Summary'), '.summary-container'], marks: [tab('Match Summary'), '.summary-container'], maxH: 760 });
  await shot('pdf', { before: async () => { await page.evaluate(() => { document.querySelector('#summaryTab > div:first-child').style.display = ''; }); }, clip: ['#summaryTab > div:first-child'], marks: ['.export-btn'] });
  await shot('chips', { clip: ['.summary-container'], marks: [{ visible: '[data-chat-chip]' }, { visible: 'td[data-chat-user]' }], maxH: 560 });
  await shot('stats', { scrollTo: '#triesStatsContainer', clip: ['#triesStatsContainer', '#prizeMoneyContainer'], marks: ['#triesStatsContainer', '#prizeMoneyContainer'], maxH: 760 });

  // ---- the admin tour ----
  await clickTab('Admin Functions');
  await shot('admin-menu', { before: () => page.evaluate(() => setAdminPanelCollapsed(false)), clip: [tab('Admin Functions'), '.admin-tabs'], marks: [tab('Admin Functions'), '.admin-tabs'] });
  await shot('admin-fixtures', { before: () => clickAdmin('Fixtures and Scores'), scrollTo: '#resultsTab', clip: ['#resultsTab .results-table-container', { sel: '#resultsTab button', text: '+ Add New Fixture' }], marks: ['#resultsTab .results-table-container', { sel: '#resultsTab button', text: '+ Add New Fixture' }], maxH: 640 });
  await shot('admin-lock', { before: () => clickAdmin('Predictions'), scrollTo: '#scoreCorrectionsTab', clip: ['#scoreCorrectionsTab .lock-toggle', '.admin-score-corrections-toolbar', '#adminUserMatchesContainer'], marks: ['#scoreCorrectionsTab .lock-toggle', '.admin-score-corrections-toolbar'], maxH: 560 });
  await shot('admin-competitors', { before: () => clickAdmin('Competitors'), scrollTo: '#competitorsTab', clip: ['#new-competitor-card', '.competitor-card:not(.competitor-card-new)'], marks: ['#new-competitor-card', '.competitor-card:not(.competitor-card-new)'], maxH: 520 });
  await shot('admin-rules', { before: () => clickAdmin('Guesser Rules'), scrollTo: '#rulesTab', clip: ['#rulesTab > div:first-child', '#rulesTab .rules-card'], marks: ['#rulesTab .rules-card'], maxH: 640 });
  await shot('admin-prize', { before: () => clickAdmin('Prize Fund'), scrollTo: '#prizeFundTab', clip: ['#prizeFundTab > div:first-child', '#prizeFundTab .rules-card'], marks: ['#prizeFundTab .prize-fund-form'], maxH: 640 });
  await shot('admin-years', { before: () => clickAdmin('Years'), scrollTo: '#yearsTab', clip: ['#yearsTab .years-form', '#yearsListContainer'], marks: ['#yearsTab .years-form', '#yearsListContainer'], maxH: 640 });

  fs.writeFileSync(REPO + '/js/tour-images.js', '// Generated by dev/tour-shots.sh: the tour pictures and where the numbered marks sit on them. Do not edit by hand.\nconst TOUR_IMAGES = ' + JSON.stringify(manifest, null, 1) + ';\n');
  console.log('errors', errors);
  await browser.close();
})();
