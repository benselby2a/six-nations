// "What's new": a pop-up that announces new features once per person per device, remembered in localStorage.
//
// To announce a feature, add a note at the TOP of WHATS_NEW below (newest first) with a new, stable `id`
// (not the build hash, which changes on every deploy). People who have not seen that id get the pop-up the next time
// they open the app; everyone else is left alone. Text only (no emoji), short bullets.

// Nothing is announced right now: the list is empty on purpose, so no pop-up shows and the "What's new" menu item is hidden.
// To announce something, add a note like this at the TOP (newest first):
//   {
//       id: '2026-12-some-feature',      // stable and unique, never the build hash
//       audience: 'all',                 // 'all' or 'admin'
//       date: '1 Dec 2026',
//       title: 'A short title',
//       tour: 'app',                     // optional: offers the matching tour ('app' or 'admin')
//       bullets: ['One short sentence per feature.']
//   }
const WHATS_NEW = [];
// tests add notes of their own here (before the app starts), so the machinery can be tested while the real list is empty
if (typeof window !== 'undefined' && Array.isArray(window.__whatsNewTestNotes)) WHATS_NEW.push(...window.__whatsNewTestNotes);

const WHATS_NEW_SEEN_PREFIX = 'whatsNewSeen:';   // + username: a JSON array of the note ids this person has seen on this device
const WHATS_NEW_MAX_NOTES = 3;                   // a returning person sees at most the newest few
let whatsNewDoneThisSession = false;             // once shown (or recorded) it is not offered again until the page is reloaded
let whatsNewTimer = null;
let whatsNewAttempts = 0;
let whatsNewReturnFocus = null;

function whatsNewKey() {
    return WHATS_NEW_SEEN_PREFIX + (currentUsername || '');
}

// { ok, ids } : ok is false when storage is blocked; ids is null when nothing has been recorded yet
function whatsNewReadSeen() {
    try {
        const raw = localStorage.getItem(whatsNewKey());
        if (raw === null) return { ok: true, ids: null };
        const list = JSON.parse(raw);
        return { ok: true, ids: Array.isArray(list) ? list.filter(id => typeof id === 'string') : [] };
    } catch (error) {
        return { ok: false, ids: null };
    }
}

function whatsNewWriteSeen(ids) {
    try { localStorage.setItem(whatsNewKey(), JSON.stringify([...new Set(ids)])); } catch (error) { /* not remembered: it will only be offered once per page load */ }
}

function whatsNewMarkSeen(ids) {
    const seen = whatsNewReadSeen();
    whatsNewWriteSeen([...(seen.ids || []), ...ids]);
}

// Has this person used the app on this device before (so the lack of a record means "returning", not "brand new")?
function whatsNewUsedBefore() {
    try {
        const user = currentUsername || '';
        return !!(localStorage.getItem('tourAnswered:' + user) || localStorage.getItem('adminTourAnswered:' + user)
            || localStorage.getItem('summaryViewMode') || localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
        return false;
    }
}

function whatsNewForMe() {
    const admin = typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin();
    return WHATS_NEW.filter(note => note.audience !== 'admin' || admin);
}

// Something else is on screen or being edited: wait for a calmer moment
function whatsNewBusy() {
    if (typeof tourState !== 'undefined' && tourState) return true;
    if (document.getElementById('appView').classList.contains('hidden')) return true;
    if (document.querySelector('.modal:not(.hidden)')) return true;
    if (typeof unsavedDirtyAreas === 'function' && unsavedDirtyAreas().length) return true;
    return false;
}

// Returns true when it is finished with (shown, recorded or nothing to show), false when it should try again later
function maybeShowWhatsNew() {
    if ((window.__noTourPrompts || window.__noWhatsNew) && !window.__whatsNewForce) return true;   // test hooks: the tests that switch the tour prompts off (or this notice off) do not want it; whats-new.js forces it on
    if (whatsNewDoneThisSession) return true;
    if (!currentUsername || isGuest || (typeof isPdfExportMode !== 'undefined' && isPdfExportMode)) return true;
    const mine = whatsNewForMe();
    const seen = whatsNewReadSeen();
    if (seen.ok && seen.ids === null && !whatsNewUsedBefore()) {
        // Brand new on this device: they get the tour prompt instead. Quietly record everything as seen.
        whatsNewWriteSeen(WHATS_NEW.map(note => note.id));
        whatsNewDoneThisSession = true;
        return true;
    }
    const seenIds = seen.ids || [];
    const unseen = mine.filter(note => !seenIds.includes(note.id)).slice(0, WHATS_NEW_MAX_NOTES);
    if (!unseen.length) { whatsNewDoneThisSession = true; return true; }
    if (whatsNewBusy()) return false;
    whatsNewDoneThisSession = true;
    renderWhatsNew(unseen);
    return true;
}

// Try after the app has drawn, and keep trying every so often while something else is in the way
function whatsNewSchedule() {
    if (whatsNewDoneThisSession || whatsNewTimer) return;
    whatsNewAttempts = 0;
    const attempt = () => {
        whatsNewTimer = null;
        whatsNewAttempts++;
        let finished = true;
        try { finished = maybeShowWhatsNew(); } catch (error) { finished = true; }   // never let a notice break the app
        if (!finished && whatsNewAttempts < 80) whatsNewTimer = setTimeout(attempt, 1500);
    };
    whatsNewTimer = setTimeout(attempt, 800);
}

function openWhatsNew() {
    // From the menu: the latest notes again, whether or not they were seen
    const notes = whatsNewForMe().slice(0, WHATS_NEW_MAX_NOTES);
    if (!notes.length) return;
    renderWhatsNew(notes);
}

function whatsNewEscape(text) {
    return String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function renderWhatsNew(notes) {
    closeWhatsNew(false);
    whatsNewReturnFocus = document.activeElement;
    const tourKind = (notes.find(note => note.tour) || {}).tour || '';
    const modal = document.createElement('div');
    modal.id = 'whatsNewModal';
    modal.className = 'modal whats-new-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'whatsNewTitle');
    modal.dataset.noteIds = notes.map(note => note.id).join(',');
    modal.innerHTML = `<div class="modal-content whats-new-content">
        <button type="button" class="whats-new-close" id="whatsNewClose" aria-label="Close">&times;</button>
        <h2 id="whatsNewTitle" class="whats-new-title">What's new</h2>
        ${notes.map(note => `<section class="whats-new-note" data-note="${whatsNewEscape(note.id)}">
            <h3>${whatsNewEscape(note.title)}${note.audience === 'admin' ? ' <span class="whats-new-tag">Admins</span>' : ''}</h3>
            <div class="whats-new-date">${whatsNewEscape(note.date || '')}</div>
            <ul class="whats-new-list">${note.bullets.map(text => `<li>${whatsNewEscape(text)}</li>`).join('')}</ul>
        </section>`).join('')}
        <div class="fixture-modal-actions">
            <button type="button" id="whatsNewGotIt">Got it</button>
            ${tourKind ? '<button type="button" class="btn-cancel" id="whatsNewTour">Take the tour</button>' : ''}
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal) closeWhatsNew(true); });
    modal.querySelector('#whatsNewClose').addEventListener('click', () => closeWhatsNew(true));
    modal.querySelector('#whatsNewGotIt').addEventListener('click', () => closeWhatsNew(true));
    const tourButton = modal.querySelector('#whatsNewTour');
    if (tourButton) tourButton.addEventListener('click', () => { closeWhatsNew(true, true); startTour(tourKind === 'admin' ? 'admin' : undefined); });
    document.addEventListener('keydown', whatsNewKeys, true);
    modal.querySelector('#whatsNewGotIt').focus();
    if (typeof trackUsage === 'function') trackUsage('whats new shown');
}

function whatsNewKeys(event) {
    const modal = document.getElementById('whatsNewModal');
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeWhatsNew(true); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button')].filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) { event.preventDefault(); first.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function closeWhatsNew(markSeen, skipFocus) {
    const modal = document.getElementById('whatsNewModal');
    if (!modal) return;
    if (markSeen) whatsNewMarkSeen((modal.dataset.noteIds || '').split(',').filter(Boolean));
    document.removeEventListener('keydown', whatsNewKeys, true);
    modal.remove();
    if (!skipFocus && whatsNewReturnFocus && document.body.contains(whatsNewReturnFocus)) { try { whatsNewReturnFocus.focus(); } catch (error) { /* ignore */ } }
    whatsNewReturnFocus = null;
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') whatsNewSchedule(); });
