// Live-match auto refresh, "no signal" banner, and a read-only fallback copy of the last good data.
// Reads use the saved copy only when the network fails; writes are blocked in network.js and never use it.
// Classic script (shared global scope); loaded before app-shell.js so the wrapping is in place before data loads.

// ---- Last good copy of the data (reads only) ----
const READ_CACHE_PREFIX = 'rugbyPredictorReadCache:v1:';
const CACHED_READS = {
    getSeasons: false, getMatches: false, getAdminUsernames: false,
    getUsers: true, getSettings: true, getActiveScoringRules: true, getUserJokerSelections: true
};
let staleDataAt = null;   // when the copy being shown was saved, while the app is showing a saved copy

function readCacheKey(name, perYear) {
    return READ_CACHE_PREFIX + name + (perYear && typeof selectedYear !== 'undefined' ? ':' + selectedYear : '');
}
function readCacheLoad(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function readCacheSave(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); } catch (e) { /* full or private mode: just no saved copy */ }
}
// Signing out removes the saved copy so the next person on a shared device does not see it
function clearReadCache() {
    try {
        Object.keys(localStorage).filter(k => k.startsWith(READ_CACHE_PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    staleDataAt = null;
}

Object.keys(CACHED_READS).forEach(name => {
    const original = Storage[name];
    if (typeof original !== 'function') return;
    Storage[name] = async function (...args) {
        const perYear = CACHED_READS[name];
        const before = NET.failures;
        let result, error = null;
        try { result = await original.apply(Storage, args); } catch (e) { error = e; }
        const failed = !!error || NET.failures !== before;
        const key = readCacheKey(name, perYear);
        if (!failed) { readCacheSave(key, result); return result; }
        const saved = readCacheLoad(key);
        if (saved) {
            staleDataAt = staleDataAt ? Math.min(staleDataAt, saved.at) : saved.at;
            connectionBannerUpdate();
            return saved.value;
        }
        if (error) throw error;
        return result;
    };
});

// ---- Banner ----
let blockedWriteTimer = null;
function formatClock(ms) { return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

function connectionBannerUpdate(blockedWrite) {
    const el = document.getElementById('connectionBanner');
    if (!el) return;
    if (blockedWrite) {
        el.textContent = '📡 No signal: that change was not saved. Try again when you are back online.';
        el.classList.remove('hidden');
        clearTimeout(blockedWriteTimer);
        blockedWriteTimer = setTimeout(() => connectionBannerUpdate(), 6000);
        return;
    }
    if (!NET.offline && !staleDataAt) { el.classList.add('hidden'); return; }
    el.textContent = staleDataAt
        ? `📡 No signal. Showing scores saved at ${formatClock(staleDataAt)}. Changes can't be saved until you are back online.`
        : '📡 No signal. Changes can\'t be saved until you are back online.';
    el.classList.remove('hidden');
}

NET.listeners.push(kind => {
    if (kind === 'write-blocked') { connectionBannerUpdate(true); return; }
    if (kind === 'online') { staleDataAt = null; connectionBannerUpdate(); if (typeof refreshAfterReconnect === 'function') refreshAfterReconnect(); return; }
    if (kind === 'online-event') {   // the browser says the connection is back: check, and the next good request clears the banner
        if (typeof refreshAfterReconnect === 'function') refreshAfterReconnect();
        return;
    }
    connectionBannerUpdate();
});

function summaryTabIsShowing() {
    const appView = document.getElementById('appView');
    const summaryTab = document.getElementById('summaryTab');
    return !!appView && !appView.classList.contains('hidden') && !!summaryTab && !summaryTab.classList.contains('hidden');
}

let reconnectRefreshing = false;
async function refreshAfterReconnect() {
    if (reconnectRefreshing || document.visibilityState !== 'visible' || typeof manualRefreshSummary !== 'function') return;
    if (typeof isLoading !== 'undefined' && isLoading) return;
    reconnectRefreshing = true;
    try {
        if (summaryTabIsShowing()) await refreshKeepingPlace();
        else await Storage.getSeasons();   // a cheap read: success clears the banner
    } finally { reconnectRefreshing = false; }
}

// ---- Live matches: refresh every 2 minutes from kick-off until 3 hours later ----
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const LIVE_REFRESH_EVERY_MS = 2 * 60 * 1000;

function isLiveMatchWindow(now = new Date()) {
    if (typeof matches === 'undefined' || typeof getMatchKickoffDate !== 'function') return false;
    return matches.some(m => {
        const kickoff = getMatchKickoffDate(m);
        if (!kickoff) return false;
        const elapsed = now.getTime() - kickoff.getTime();
        return elapsed >= 0 && elapsed < LIVE_WINDOW_MS;
    });
}

// Refresh without losing the reader's place in the table or the page
async function refreshKeepingPlace() {
    const box = document.querySelector('.summary-container');
    const left = box ? box.scrollLeft : 0;
    const top = window.scrollY;
    await manualRefreshSummary();
    const newBox = document.querySelector('.summary-container');
    if (newBox) newBox.scrollLeft = left;
    window.scrollTo(window.scrollX, top);
}

// During a match only the fixtures (scores, tries) change, so the live refresh fetches just those
async function refreshLiveScores() {
    const year = selectedYear;
    const fresh = await Storage.getYearMatches(year);
    if (!fresh || year !== selectedYear) return false;   // no signal, or the year was switched meanwhile
    allMatches = allMatches.filter(m => m.year !== year).concat(fresh);
    applySelectedYearMatches();
    lastDataRefreshAt = Date.now();
    updateSummaryUpdatedAt();
    showSummaryIfChanged();
    return true;
}

async function refreshLiveScoresKeepingPlace() {
    if (summaryRefreshInFlight) return;
    summaryRefreshInFlight = true;
    const box = document.querySelector('.summary-container');
    const left = box ? box.scrollLeft : 0;
    const top = window.scrollY;
    try {
        await refreshLiveScores();
    } finally {
        summaryRefreshInFlight = false;
    }
    const newBox = document.querySelector('.summary-container');
    if (newBox) newBox.scrollLeft = left;
    window.scrollTo(window.scrollX, top);
}

function liveRefreshTick() {
    if (document.visibilityState !== 'visible' || (typeof isLoading !== 'undefined' && isLoading)) return;
    if (typeof summaryRefreshInFlight !== 'undefined' && summaryRefreshInFlight) return;
    if (!summaryTabIsShowing() || !isLiveMatchWindow()) return;
    if (Date.now() - lastDataRefreshAt < LIVE_REFRESH_EVERY_MS - 5000) return;
    refreshLiveScoresKeepingPlace();
}
setInterval(liveRefreshTick, 30 * 1000);

// ---- New version check: a Home Screen app can keep an old copy of the page for a long time ----
// On start (within a few seconds) and whenever the app comes back to the front, ask the server for a fresh index.html and
// compare version tags. A newer version reloads the app automatically. It never reloads while a pop-up is open, so nothing
// half-typed is lost; it simply tries again next time.
const APP_VERSION_TAG = (() => {
    const el = document.querySelector('script[src*="app.min.js"]');
    const m = el && /[?&]v=([\w-]+)/.exec(el.getAttribute('src') || '');
    return m ? m[1] : null;
})();
let lastVersionCheckAt = 0;

async function checkForNewVersion() {
    if (!APP_VERSION_TAG || NET.offline || navigator.onLine === false || location.protocol === 'file:') return;
    if (Date.now() - lastVersionCheckAt < 30 * 1000) return;
    lastVersionCheckAt = Date.now();
    try {
        const response = await fetch(location.pathname + '?_=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return;
        const html = await response.text();
        const m = /src="dist\/app\.min\.js\?v=([\w-]+)"/.exec(html);
        if (!m || m[1] === APP_VERSION_TAG) return;
        if (document.querySelector('.modal:not(.hidden), body.tour-open')) return;   // do not interrupt: try again next time
        let tried = null;
        try { tried = sessionStorage.getItem('rugbyPredictorReloadedFor'); } catch (e) { /* ignore */ }
        if (tried === m[1]) return;   // already reloaded for this version once (never loop)
        try { sessionStorage.setItem('rugbyPredictorReloadedFor', m[1]); sessionStorage.setItem('rugbyPredictorFadeIn', '1'); } catch (e) { /* ignore */ }
        // Fade the page out first, and fade the new one in (see the start of index.html), so the update is not a flash
        document.documentElement.classList.add('app-updating');
        setTimeout(() => location.reload(), 280);
    } catch (e) { /* no signal or blocked: try again next time */ }
}

setTimeout(checkForNewVersion, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForNewVersion(); });

// ---- Service worker: lets the app open with no signal (see sw.js; reads only, nothing is queued) ----
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* not available here: the app works without it */ }); });
}
