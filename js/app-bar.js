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
function buildSummaryStickyHead() {
    const wrap = document.querySelector('.summary-table-wrap');
    if (!wrap) return;
    const box = wrap.querySelector('.summary-container');
    const table = box && box.querySelector('table.summary-table');
    const inner = wrap.querySelector('.summary-sticky-inner');
    if (!table || !table.tHead || !inner) return;
    inner.innerHTML = '';
    const copy = document.createElement('table');
    copy.className = 'summary-table summary-table-clone';
    copy.setAttribute('aria-hidden', 'true');
    copy.appendChild(table.tHead.cloneNode(true));
    copy.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    inner.appendChild(copy);
    box.addEventListener('scroll', () => { inner.scrollLeft = box.scrollLeft; }, { passive: true });
    sizeSummaryStickyHead();
    updateSummaryStickyVisibility();
}
function sizeSummaryStickyHead() {
    const wrap = document.querySelector('.summary-table-wrap');
    if (!wrap) return;
    const box = wrap.querySelector('.summary-container');
    const table = box.querySelector('table.summary-table');
    const inner = wrap.querySelector('.summary-sticky-inner');
    const copy = inner.querySelector('table');
    if (!table || !copy) return;
    const real = table.tHead.querySelectorAll('th');
    const mine = copy.tHead.querySelectorAll('th');
    inner.style.left = box.clientLeft + 'px';
    inner.style.width = box.clientWidth + 'px';
    copy.style.width = table.offsetWidth + 'px';
    real.forEach((th, i) => {
        if (!mine[i]) return;
        const w = th.getBoundingClientRect().width + 'px';
        mine[i].style.width = w; mine[i].style.minWidth = w; mine[i].style.maxWidth = w;
    });
    inner.scrollLeft = box.scrollLeft;
}
let pinProbe = null;
function summaryPinTop() {
    if (!pinProbe) {
        pinProbe = document.createElement('div');
        pinProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
        document.body.appendChild(pinProbe);
    }
    return parseFloat(getComputedStyle(pinProbe).paddingTop) || 0;
}
function updateSummaryStickyVisibility() {
    const table = document.querySelector('.summary-table:not(.summary-table-clone)');
    const inner = document.querySelector('.summary-sticky-inner');
    if (!table || !table.tHead || !inner) return;
    const rect = table.getBoundingClientRect();
    const top = summaryPinTop();
    // Pinned while the table is on screen; at the end of the table it slides up above the last row instead of vanishing
    const pinnedH = inner.offsetHeight || table.tHead.offsetHeight;
    // The header never covers the last row: it slides up so that its bottom edge stays above that row
    const lastRow = table.tBodies.length ? table.tBodies[table.tBodies.length - 1].lastElementChild : null;
    const end = rect.bottom - (lastRow ? lastRow.getBoundingClientRect().height : 0);
    inner.classList.toggle('show', rect.top < top && end > top);
    const slide = Math.min(0, end - (top + pinnedH));
    inner.style.transform = slide < 0 ? `translate3d(0, ${Math.round(slide)}px, 0)` : '';
}
let pinQueued = false;
function queueSummaryStickyVisibility() {
    if (pinQueued) return;
    pinQueued = true;
    requestAnimationFrame(() => { pinQueued = false; updateSummaryStickyVisibility(); });
}
window.addEventListener('scroll', queueSummaryStickyVisibility, { passive: true });
window.addEventListener('resize', () => { sizeSummaryStickyHead(); queueSummaryStickyVisibility(); const hint = document.getElementById('scrollHint'); const box = document.querySelector('.summary-container'); if (hint && box) hint.classList.toggle('hidden', box.scrollWidth <= box.clientWidth); if (typeof syncSummaryScrollLock === 'function') syncSummaryScrollLock(); if (typeof refreshWormChartLayout === 'function') refreshWormChartLayout(); });

// Compact mode: hides the emoji rows and, in the headers, the date and tries, to save space. Remembered on this device.
const SUMMARY_COMPACT_KEY = 'summaryCompact';
function applySummaryCompact(compact) {
    document.body.classList.toggle('summary-compact', compact);
    const btn = document.getElementById('summaryCompactBtn');
    if (btn) {
        btn.setAttribute('aria-pressed', compact ? 'true' : 'false');
        btn.setAttribute('data-tip', compact ? 'Compact mode: on' : 'Compact mode');
        btn.setAttribute('aria-label', compact ? 'Compact mode: on' : 'Compact mode');
    }
    buildSummaryStickyHead();   // the pinned copy follows the new header height
}
function toggleSummaryCompact() {
    const compact = !document.body.classList.contains('summary-compact');
    try { localStorage.setItem(SUMMARY_COMPACT_KEY, compact ? '1' : '0'); } catch (error) { /* not remembered */ }
    applySummaryCompact(compact);
}
// Compact mode starts on for phones (a narrow screen, or a phone held sideways) unless the person has chosen for themselves
function isPhoneScreen() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 480px), (orientation: landscape) and (max-height: 500px) and (hover: none)').matches);
}
document.addEventListener('DOMContentLoaded', () => {
    let saved = null;
    try { saved = localStorage.getItem(SUMMARY_COMPACT_KEY); } catch (error) { saved = null; }
    const compact = saved === '1' || (saved === null && isPhoneScreen());
    if (compact) applySummaryCompact(true);
});
