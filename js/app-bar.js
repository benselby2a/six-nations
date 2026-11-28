// The slim top bar: title, year, and an account menu (name, theme, help, log out)
// Classic script (shared global scope); load order is set in index.html.

function openAccountMenu() {
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('avatarBtn');
    if (!menu || !btn) return;
    // "What's new" only appears when there is something to announce (the list is empty until the owner chooses to add a note)
    const whatsNewItem = document.getElementById('menuWhatsNewBtn');
    if (whatsNewItem) whatsNewItem.hidden = typeof whatsNewForMe !== 'function' || !whatsNewForMe().length;
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
}

function closeAccountMenu() {
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('avatarBtn');
    if (!menu || !btn) return;
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
}

function toggleAccountMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('accountMenu');
    if (!menu) return;
    if (menu.classList.contains('hidden')) openAccountMenu(); else closeAccountMenu();
}

// What the avatar shows: the first letter of the display name, or "X&Y" for a pair such as "Trev and Carol"
function avatarInitials(displayName) {
    const name = (displayName || '').trim();
    if (!name) return '?';
    const first = (word) => (word.trim().match(/[A-Za-z0-9\u00C0-\u024F]/) || [''])[0].toUpperCase();
    const parts = name.split(/\s+(?:and|&|\+)\s+/i).filter(p => p.trim());
    if (parts.length >= 2) {
        const a = first(parts[0]);
        const b = first(parts[1]);
        if (a && b) return `${a}&${b}`;
    }
    return first(name) || name.charAt(0).toUpperCase() || '?';
}

// The avatar shows the initials, with a red dot for admins
function updateAvatar() {
    const initial = document.getElementById('avatarInitial');
    const dot = document.getElementById('avatarDot');
    const name = document.getElementById('currentUser');
    const btn = document.getElementById('avatarBtn');
    if (!initial || !name) return;
    const text = (name.textContent || '').replace(/admin$/i, '').trim();
    const shown = avatarInitials(text);
    initial.textContent = shown;
    if (btn) btn.classList.toggle('avatar-pair', shown.length > 1);
    if (dot) dot.classList.toggle('hidden', !(typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin()));
}

// Touch screens have no hover: show a tooltip's label for a moment when its button is tapped
document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const el = event.target.closest && event.target.closest('[data-tip]');
    if (!el) return;
    el.classList.add('tip-show');
    setTimeout(() => el.classList.remove('tip-show'), 1600);
});

(function bindAppBar() {
    document.addEventListener('click', (event) => {
        const menu = document.getElementById('accountMenu');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(event.target)) closeAccountMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const menu = document.getElementById('accountMenu');
            if (menu && !menu.classList.contains('hidden')) { closeAccountMenu(); const b = document.getElementById('avatarBtn'); if (b) b.focus(); }
        }
    });
    // Keep the avatar in step with the name (set from several places) without touching each of them
    const name = document.getElementById('currentUser');
    if (name) new MutationObserver(updateAvatar).observe(name, { childList: true, characterData: true, subtree: true });
    // While signed in (or browsing as a guest) the big title gives way to the slim bar
    const appView = document.getElementById('appView');
    const sync = () => document.body.classList.toggle('in-app', !!appView && !appView.classList.contains('hidden'));
    if (appView) { new MutationObserver(sync).observe(appView, { attributes: true, attributeFilter: ['class'] }); sync(); }
})();

// Belt and braces for the iPhone Home Screen app: if the page is ever dragged sideways, snap it back
window.addEventListener('scroll', () => {
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
}, { passive: true });

// ---- Open at the very top ----
// The iPhone Home Screen app (and a browser reload) otherwise brings the page back part-way down.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let appTouchedByUser = false;   // set once the person scrolls, so a late jump to the top never fights them
function scrollToTop() {
    window.scrollTo(0, 0);
}
// (a tap or click counts too: a late jump to the top must never undo what a button the person just pressed did, e.g. an admin screen scrolling itself into view)
['touchstart', 'pointerdown', 'mousedown', 'touchmove', 'wheel', 'keydown'].forEach(type => window.addEventListener(type, () => { appTouchedByUser = true; }, { passive: true, once: true }));

window.addEventListener('load', () => {
    scrollToTop();
    // The screens fill in as data arrives: check again while the person has not scrolled
    [300, 900, 2000].forEach(ms => setTimeout(() => { if (!appTouchedByUser) scrollToTop(); }, ms));
});
window.addEventListener('pageshow', (event) => { if (event.persisted) scrollToTop(); });

// Coming back to the app after a while away (more than 5 minutes) also starts at the top
let appHiddenAt = 0;
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        appHiddenAt = Date.now();
    } else if (appHiddenAt && Date.now() - appHiddenAt > 5 * 60 * 1000) {
        scrollToTop();
        appHiddenAt = 0;
    }
});

// Match Summary: while any part of the table is on screen, its header row stays pinned at the top (like the first columns stay pinned at the left).
// The table sits in a box that scrolls sideways, and a box like that cannot "stick" to the page. So a copy of the header sits in a
// sticky strip outside the box (the browser keeps that smooth), is scrolled sideways in step with the table, and is shown only once the real
// header has scrolled out of view. The two look identical, so the hand-over is not visible.
const PINNED_COLS = '.rank-col, .competitor-col, .pts-col';
let stickyResizeObserver = null;
let stickyScrollEl = null;   // the sideways-moving part of the pinned header
// Where the browser can tie an animation to a scroller (scroll-driven animations: Chrome, Safari 26) the sideways movement is done in CSS, on the
// graphics chip, exactly in step with the table (see .summary-sticky-scroll); only the distance is passed in (--sum-range). Elsewhere a scroll
// listener moves it, which is a frame behind and a little jerky.
const SCROLL_TIMELINE_OK = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
function syncSummaryStickyScroll() {
    const box = document.querySelector('.summary-table-wrap .summary-container');
    if (!box) return;
    if (SCROLL_TIMELINE_OK) {
        const wrap = box.closest('.summary-table-wrap');
        if (wrap) wrap.style.setProperty('--sum-range', String(Math.max(0, box.scrollWidth - box.clientWidth)));
        return;
    }
    if (stickyScrollEl) stickyScrollEl.style.transform = `translate3d(${-box.scrollLeft}px, 0, 0)`;
}
// Two layers: the first three columns (#, Competitor, Score) stay put; everything else is one layer that is moved sideways with a
// single transform (smooth, done by the graphics chip) in step with the table, and slides under the fixed columns like the real table.
function buildSummaryStickyHead() {
    const wrap = document.querySelector('.summary-table-wrap');
    if (!wrap) return;
    const box = wrap.querySelector('.summary-container');
    const table = box && box.querySelector('table.summary-table');
    const inner = wrap.querySelector('.summary-sticky-inner');
    if (!table || !table.tHead || !inner) return;
    inner.innerHTML = '';
    const makeTable = (head, extraClass) => {
        const t = document.createElement('table');
        t.className = 'summary-table summary-table-clone' + (extraClass ? ' ' + extraClass : '');
        t.setAttribute('aria-hidden', 'true');
        t.appendChild(head);
        t.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
        return t;
    };
    const scrolling = document.createElement('div');
    scrolling.className = 'summary-sticky-scroll';
    scrolling.appendChild(makeTable(table.tHead.cloneNode(true)));
    const pinHead = table.tHead.cloneNode(true);
    pinHead.querySelectorAll('th').forEach(th => { if (!th.matches(PINNED_COLS)) th.remove(); });
    const pinned = document.createElement('div');
    pinned.className = 'summary-sticky-pinned';
    pinned.appendChild(makeTable(pinHead, 'summary-table-clone-pinned'));
    inner.appendChild(scrolling);
    inner.appendChild(pinned);
    stickyScrollEl = scrolling;
    if (!SCROLL_TIMELINE_OK && !box.dataset.pinSync) {   // one listener per box (the box is replaced whenever the summary is redrawn)
        box.dataset.pinSync = '1';
        box.addEventListener('scroll', syncSummaryStickyScroll, { passive: true });
    }
    sizeSummaryStickyHead();
    // Row heights can change later (reactions arrive, fonts load): re-measure the zone whenever the table changes size
    if (stickyResizeObserver) stickyResizeObserver.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
        let queued = false;
        stickyResizeObserver = new ResizeObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; sizeSummaryStickyHead(); });
        });
        stickyResizeObserver.observe(table);
    }
}
// Column hover (Compact and Focus, mouse only): the cell under the pointer lights up its whole column the same way the row hover lights up a row.
// Cells in every row line up by position, so the column is "the cell at the same index in each row" of the table and of the pinned header copies.
let columnHoverIndex = -1;
function clearColumnHover() {
    columnHoverIndex = -1;
    document.querySelectorAll('.summary-table-wrap .col-hover').forEach(c => c.classList.remove('col-hover'));
}
function setColumnHover(index, anchor) {
    if (index === columnHoverIndex && anchor && anchor.classList.contains('col-hover')) return;   // nothing changed (a redraw wipes the classes, so the check looks at the cell)
    clearColumnHover();
    columnHoverIndex = index;
    const wrap = anchor && anchor.closest('.summary-table-wrap');
    if (!wrap || index < 0) return;
    wrap.querySelectorAll('table.summary-table tr').forEach(row => { const cell = row.cells[index]; if (cell) cell.classList.add('col-hover'); });
}
(function watchColumnHover() {
    if (typeof document === 'undefined' || typeof window.matchMedia !== 'function') return;
    let queued = null;
    const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches && document.body.classList.contains('summary-compact');
    document.addEventListener('mouseover', (event) => {
        const cell = event.target && event.target.closest ? event.target.closest('.summary-table-wrap table.summary-table td, .summary-table-wrap table.summary-table th') : null;
        if (!cell || !canHover()) { if (columnHoverIndex !== -1) clearColumnHover(); return; }
        if (queued) cancelAnimationFrame(queued);
        queued = requestAnimationFrame(() => { queued = null; setColumnHover(cell.cellIndex, cell); });
    }, { passive: true });
    document.addEventListener('mouseout', (event) => {
        const to = event.relatedTarget;
        if (to && to.closest && to.closest('.summary-table-wrap table.summary-table')) return;   // moving to another cell: mouseover sets it
        if (queued) { cancelAnimationFrame(queued); queued = null; }
        clearColumnHover();
    }, { passive: true });
    // the table moving under a still pointer (sideways scroll) would leave the wrong column lit: clear it, the next mouse move sets it again
    document.addEventListener('scroll', (event) => { if (columnHoverIndex !== -1 && event.target && event.target.classList && event.target.classList.contains('summary-container')) clearColumnHover(); }, { passive: true, capture: true });
})();
// Tap or click a cell in Compact and Jumbo: its whole row and column are shaded with a light gold bar (and the tapped cell a little stronger),
// like the hover on a computer. On a phone it stays visible while the table is scrolled and fades away once the scrolling stops; a tap with no scrolling stays until another cell is tapped, the same cell is tapped again, or a tap lands on empty page.
// The tap still does what it did (a prediction or match header still opens its pop-up): this only listens. A drag or scroll is not a tap.
let summarySel = null;   // { source: 'touch' | 'mouse', scrolled: boolean } while a selection is showing
function clearSummarySelection() {
    document.querySelectorAll('.summary-table-wrap .row-sel, .summary-table-wrap .col-sel, .summary-table-wrap .cell-sel').forEach(c => c.classList.remove('row-sel', 'col-sel', 'cell-sel'));
    document.querySelectorAll('.summary-table-wrap.sel-fade').forEach(w => w.classList.remove('sel-fade'));
    summarySel = null;
}
// On a phone the selection is a marker while the finger moves the table: it stays visible during the scroll (and its momentum) and fades
// away once the scrolling has stopped. A tap with no scrolling leaves it as it was.
function fadeOutSummarySelection() {
    const wrap = document.querySelector('.summary-table-wrap');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!wrap || reduce) { clearSummarySelection(); return; }
    wrap.classList.add('sel-fade');
    setTimeout(() => { if (summarySel && summarySel.fading) clearSummarySelection(); }, 230);
    if (summarySel) summarySel.fading = true;
}
function setSummarySelection(cell, source) {
    clearSummarySelection();
    const wrap = cell.closest('.summary-table-wrap');
    if (!wrap) return;
    summarySel = { source: source || 'mouse', scrolled: false };
    const index = cell.cellIndex;
    wrap.querySelectorAll('table.summary-table tr').forEach(row => { const c = row.cells[index]; if (c) c.classList.add('col-sel'); });
    if (cell.tagName === 'TD') [...cell.parentElement.cells].forEach(c => c.classList.add('row-sel'));
    // a tap on the pinned header copy marks the real header cell as the tapped one
    let anchor = cell;
    if (cell.closest('.summary-table-clone')) { const real = wrap.querySelector('.summary-container table.summary-table:not(.summary-table-clone) thead tr'); if (real && real.cells[index]) anchor = real.cells[index]; }
    anchor.classList.add('cell-sel');
}
(function watchSummaryTap() {
    if (typeof document === 'undefined') return;
    let down = null;
    let fingerDown = false, settleTimer = null;
    const inSummaryView = () => document.body.classList.contains('summary-compact');
    const CELL = '.summary-table-wrap table.summary-table td, .summary-table-wrap table.summary-table th';
    // touch selections end once the scrolling has: 300ms after the last scroll event, and only with the finger up (iPhone keeps scrolling by momentum)
    const armSettle = () => {
        if (!summarySel || summarySel.source !== 'touch') return;
        summarySel.scrolled = true;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { if (fingerDown) return; if (summarySel && summarySel.source === 'touch' && summarySel.scrolled) fadeOutSummarySelection(); }, 300);
    };
    document.addEventListener('touchstart', (event) => { fingerDown = event.touches.length > 0; clearTimeout(settleTimer); }, { passive: true, capture: true });
    const fingerUp = (event) => { fingerDown = event.touches.length > 0; if (!fingerDown && summarySel && summarySel.scrolled) armSettle(); };
    document.addEventListener('touchend', fingerUp, { passive: true, capture: true });
    document.addEventListener('touchcancel', fingerUp, { passive: true, capture: true });
    document.addEventListener('scroll', (event) => {
        if (!summarySel || summarySel.source !== 'touch') return;
        const t = event.target;
        if (t === document || t === document.documentElement || (t && t.classList && t.classList.contains('summary-container'))) armSettle();
    }, { passive: true, capture: true });
    document.addEventListener('pointerdown', (event) => {
        down = { x: event.clientX, y: event.clientY, t: Date.now(), id: event.pointerId, touch: event.pointerType === 'touch', wasSame: false, held: false };
        // touching a cell shows the selection straight away, so it is visible while the same gesture scrolls the table
        if (down.touch && inSummaryView()) {
            const cell = event.target && event.target.closest ? event.target.closest(CELL) : null;
            if (cell) {
                down.wasSame = !cell.closest('.summary-table-clone') && cell.classList.contains('cell-sel');
                setSummarySelection(cell, 'touch'); down.held = true;
            }
        }
    }, { passive: true });
    // the browser takes over a drag as a scroll and cancels the pointer: the selection stays and ends with the scrolling
    document.addEventListener('pointercancel', (event) => {
        if (down && down.id === event.pointerId && down.held && summarySel) { armSettle(); }
        down = null;
    }, { passive: true });
    document.addEventListener('pointerup', (event) => {
        const start = down; down = null;
        if (!start || start.id !== event.pointerId) return;
        if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8 || Date.now() - start.t > 700) { if (start.held && summarySel) armSettle(); return; }   // a drag or a long press is not a tap
        if (!inSummaryView()) return;
        const target = event.target && event.target.closest ? event.target : null;
        if (!target) return;
        const cell = target.closest(CELL);
        if (cell) {
            if (start.held) { if (start.wasSame) clearSummarySelection(); return; }   // the touch already selected it (tapping the same cell again clears)
            const real = cell.closest('.summary-table-clone') ? null : cell;
            if (real && real.classList.contains('cell-sel')) { clearSummarySelection(); return; }   // the same cell again
            setSummarySelection(cell, start.touch ? 'touch' : 'mouse');
            return;
        }
        // a tap on empty page clears it; taps on buttons, menus and pop-ups leave it alone
        if (!target.closest('button, a, select, input, textarea, label, .modal, .fixture-chat-sheet, .account-menu, .tour-layer')) clearSummarySelection();
    }, { passive: true });
})();
function sizeSummaryStickyHead() {
    const wrap = document.querySelector('.summary-table-wrap');
    if (!wrap) return;
    const box = wrap.querySelector('.summary-container');
    const table = box.querySelector('table.summary-table');
    const inner = wrap.querySelector('.summary-sticky-inner');
    const copy = inner.querySelector('.summary-sticky-scroll table');
    const pinCopy = inner.querySelector('.summary-sticky-pinned table');
    if (!table || !copy || !pinCopy) return;
    const real = [...table.tHead.querySelectorAll('th')];
    const setWidth = (el, w) => { el.style.width = w + 'px'; el.style.minWidth = w + 'px'; el.style.maxWidth = w + 'px'; };
    inner.style.left = box.clientLeft + 'px';
    inner.style.width = box.clientWidth + 'px';
    copy.style.width = table.offsetWidth + 'px';
    const mine = copy.tHead.querySelectorAll('th');
    real.forEach((th, i) => { if (mine[i]) setWidth(mine[i], th.getBoundingClientRect().width); });
    const pinReal = real.filter(th => th.matches(PINNED_COLS));
    const pinMine = pinCopy.tHead.querySelectorAll('th');
    let pinW = 0;
    pinReal.forEach((th, i) => { const w = th.getBoundingClientRect().width; pinW += w; if (pinMine[i]) setWidth(pinMine[i], w); });
    pinCopy.style.width = pinW + 'px';
    pinCopy.style.height = copy.offsetHeight + 'px';
    syncSummaryStickyScroll();
    layoutSummarySticky();
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (document.querySelector('.summary-sticky-inner')) sizeSummaryStickyHead(); });   // web fonts change row heights
let pinProbe = null;
function summaryPinTop() {
    if (!pinProbe) {
        pinProbe = document.createElement('div');
        pinProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
        document.body.appendChild(pinProbe);
    }
    return parseFloat(getComputedStyle(pinProbe).paddingTop) || 0;
}
// The pinned header is positioned by the browser alone (position: sticky inside a zone that ends just above the table's last row),
// so it follows the scroll exactly, with no script running per frame, and it slides away with the table without covering the last row.
// This only has to size the zone: once on build, and again on resize or when fonts change row heights.
function layoutSummarySticky() {
    const wrap = document.querySelector('.summary-table-wrap');
    if (!wrap) return;
    const box = wrap.querySelector('.summary-container');
    const table = box && box.querySelector('table.summary-table');
    const zone = wrap.querySelector('.summary-sticky-zone');
    const head = wrap.querySelector('.summary-sticky-head');
    const inner = wrap.querySelector('.summary-sticky-inner');
    if (!table || !table.tHead || !zone || !head || !inner) return;
    const lastRow = table.tBodies.length ? table.tBodies[table.tBodies.length - 1].lastElementChild : null;
    const pinnedH = inner.offsetHeight || table.tHead.offsetHeight;
    zone.style.top = (box.offsetTop + box.clientTop) + 'px';
    zone.style.height = Math.max(pinnedH, table.offsetHeight - (lastRow ? lastRow.offsetHeight : 0)) + 'px';
    head.style.height = pinnedH + 'px';
}
window.addEventListener('resize', () => { if (typeof fitFocusNameColumn === 'function' && typeof summaryViewMode !== 'undefined' && summaryViewMode === 'simple') { fitFocusNameColumn(); if (typeof layoutSummarySticky === 'function') layoutSummarySticky(); } sizeSummaryStickyHead(); const hint = document.getElementById('scrollHint'); const box = document.querySelector('.summary-container'); if (hint && box) hint.classList.toggle('hidden', box.scrollWidth <= box.clientWidth); if (typeof syncSummaryScrollLock === 'function') syncSummaryScrollLock(); if (typeof refreshWormChartLayout === 'function') refreshWormChartLayout(); });

// Table view: Compact, Classic or Jumbo (key simple: Compact with plain text only and a light gold shade for Jokers).
// Compact keeps the match headers short (countries and score); the "details" switch beside the download button brings the date and tries
// back into them (body class summary-detail, remembered separately). Classic draws the table like the PDF export, see js/pdf-view.js.
// Everything is remembered on this device.
const SUMMARY_COMPACT_KEY = 'summaryCompact';        // the oldest two-way choice (still read, so nobody's choice is lost)
const SUMMARY_VIEW_MODE_KEY = 'summaryViewMode';
const SUMMARY_DETAIL_KEY = 'summaryHeaderDetail';
const SUMMARY_VIEW_MODES = ['compact', 'classic', 'simple'];
let summaryViewMode = 'compact';
let summaryHeaderDetail = false;
function applySummaryViewMode(mode, redraw) {
    if (!SUMMARY_VIEW_MODES.includes(mode)) mode = 'compact';
    summaryViewMode = mode;
    document.body.classList.toggle('summary-compact', mode === 'compact' || mode === 'simple');   // Simple is built on Compact
    document.body.classList.toggle('summary-simple', mode === 'simple');
    document.body.classList.toggle('summary-classic', mode === 'classic');
    document.querySelectorAll('#summaryViewSwitch .view-switch-btn').forEach(btn => {
        const on = btn.dataset.view === mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // the view switch in the top bar (wide screens) mirrors the menu's
    document.querySelectorAll('#topViewSwitch .bar-switch-btn').forEach(btn => {
        const on = btn.dataset.view === mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (redraw && typeof showSummary === 'function' && document.getElementById('summaryContainer')) showSummary();   // the redraw also rebuilds the pinned header
}
// The table view switch in the top bar only matters on Match Summary: show it there, hide it on My Predictions and the Admin screens
function syncTopBarToggles() {
    const view = document.getElementById('topViewSwitch');
    const summary = document.getElementById('summaryTab');
    if (view && summary) view.classList.toggle('hidden', summary.classList.contains('hidden'));
}
function setSummaryView(mode) {
    try { localStorage.setItem(SUMMARY_VIEW_MODE_KEY, mode); } catch (error) { /* not remembered */ }
    applySummaryViewMode(mode, true);
}
// The match-details switch beside the download button: puts the date and tries back into the Compact / Jumbo headers
function applySummaryHeaderDetail(on, redraw) {
    summaryHeaderDetail = !!on;
    document.body.classList.toggle('summary-detail', summaryHeaderDetail);
    const btn = document.getElementById('headerDetailBtn');
    if (btn) {
        const tip = summaryHeaderDetail ? 'Hide match details' : 'Show match details';
        btn.setAttribute('aria-pressed', summaryHeaderDetail ? 'true' : 'false');
        btn.setAttribute('aria-label', tip);
        btn.setAttribute('data-tip', tip);
        const label = btn.querySelector('.toolbar-btn-label');
        if (label) label.textContent = summaryHeaderDetail ? 'Hide details' : 'Show details';   // visible on desktop-sized screens
    }
    if (redraw && typeof showSummary === 'function' && document.getElementById('summaryContainer')) showSummary();   // the redraw also rebuilds the pinned header
}
function toggleSummaryHeaderDetail() {
    const on = !summaryHeaderDetail;
    try { localStorage.setItem(SUMMARY_DETAIL_KEY, on ? '1' : '0'); } catch (error) { /* not remembered */ }
    applySummaryHeaderDetail(on, true);
}

document.addEventListener('DOMContentLoaded', () => {
    let mode = null, legacy = null, detail = null;
    try { mode = localStorage.getItem(SUMMARY_VIEW_MODE_KEY); legacy = localStorage.getItem(SUMMARY_COMPACT_KEY); detail = localStorage.getItem(SUMMARY_DETAIL_KEY); } catch (error) { /* ignore */ }
    if (mode === 'pdf') mode = 'classic';   // this view was first called PDF
    // The Full view is gone. Anyone who had it (or the oldest "not compact" choice) gets Compact with the match details switched on, which is the header they were used to
    if (mode === 'full' || (!SUMMARY_VIEW_MODES.includes(mode) && legacy === '0')) {
        mode = 'compact';
        if (detail === null) detail = '1';
        try { localStorage.setItem(SUMMARY_VIEW_MODE_KEY, 'compact'); localStorage.setItem(SUMMARY_DETAIL_KEY, detail); } catch (error) { /* ignore */ }
    }
    if (!SUMMARY_VIEW_MODES.includes(mode)) mode = 'compact';
    applySummaryViewMode(mode, false);
    applySummaryHeaderDetail(detail === '1', false);
    syncTopBarToggles();
});
