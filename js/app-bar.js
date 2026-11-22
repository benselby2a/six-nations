// The slim top bar: title, year, and an account menu (name, theme, help, log out)
// Classic script (shared global scope); load order is set in index.html.

function openAccountMenu() {
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('avatarBtn');
    if (!menu || !btn) return;
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
['touchmove', 'wheel', 'keydown'].forEach(type => window.addEventListener(type, () => { appTouchedByUser = true; }, { passive: true, once: true }));

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
window.addEventListener('resize', () => { sizeSummaryStickyHead(); const hint = document.getElementById('scrollHint'); const box = document.querySelector('.summary-container'); if (hint && box) hint.classList.toggle('hidden', box.scrollWidth <= box.clientWidth); if (typeof syncSummaryScrollLock === 'function') syncSummaryScrollLock(); if (typeof refreshWormChartLayout === 'function') refreshWormChartLayout(); });

// Table view: Full, Compact, Focus (key simple; Compact with plain text only and colour-coded Jokers) or Classic. Compact (hides the emoji rows and, in the headers, the date and tries, to save space) or Classic (the table drawn
// like the PDF export, see js/pdf-view.js). Remembered on this device.
const SUMMARY_COMPACT_KEY = 'summaryCompact';        // the older two-way choice (still read, so nobody's choice is lost)
const SUMMARY_VIEW_MODE_KEY = 'summaryViewMode';
let summaryViewMode = 'full';
function applySummaryViewMode(mode, redraw) {
    if (!['full', 'compact', 'classic', 'simple'].includes(mode)) mode = 'full';
    summaryViewMode = mode;
    document.body.classList.toggle('summary-compact', mode === 'compact' || mode === 'simple');   // Simple is built on Compact
    document.body.classList.toggle('summary-simple', mode === 'simple');
    document.body.classList.toggle('summary-classic', mode === 'classic');
    document.querySelectorAll('#summaryViewSwitch .view-switch-btn').forEach(btn => {
        const on = btn.dataset.view === mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (redraw && typeof showSummary === 'function' && document.getElementById('summaryContainer')) showSummary();   // the redraw also rebuilds the pinned header
}
function setSummaryView(mode) {
    try { localStorage.setItem(SUMMARY_VIEW_MODE_KEY, mode); localStorage.setItem(SUMMARY_COMPACT_KEY, mode === 'compact' ? '1' : '0'); } catch (error) { /* not remembered */ }
    applySummaryViewMode(mode, true);
}
// Kept for older callers: flips between Compact and Full
function toggleSummaryCompact() { setSummaryView(summaryViewMode === 'compact' ? 'full' : 'compact'); }
// Kept for older callers
function applySummaryCompact(compact) { applySummaryViewMode(compact ? 'compact' : 'full', true); }

// Compact mode starts on for phones (a narrow screen, or a phone held sideways) unless the person has chosen for themselves
function isPhoneScreen() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 480px), (orientation: landscape) and (max-height: 500px) and (hover: none)').matches);
}
document.addEventListener('DOMContentLoaded', () => {
    let mode = null, legacy = null;
    try { mode = localStorage.getItem(SUMMARY_VIEW_MODE_KEY); legacy = localStorage.getItem(SUMMARY_COMPACT_KEY); } catch (error) { /* ignore */ }
    if (mode === 'pdf') mode = 'classic';   // this view was first called PDF
    if (!['full', 'compact', 'classic', 'simple'].includes(mode)) mode = legacy === '1' ? 'compact' : (legacy === '0' ? 'full' : (isPhoneScreen() ? 'compact' : 'full'));
    applySummaryViewMode(mode, false);
});
