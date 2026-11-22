// "What's new": a pop-up that announces new features once per person per device, remembered in localStorage.
//
// To announce a feature, add a note at the TOP of WHATS_NEW below (newest first) with a new, stable `id`
// (not the build hash, which changes on every deploy). People who have not seen that id get the pop-up the next time
// they open the app; everyone else is left alone. Text only (no emoji), short bullets.

const WHATS_NEW = [
    {
        id: '2026-11-admin-predictions-upload',
        audience: 'admin',          // 'all' or 'admin'
        date: '22 Nov 2026',
        title: 'Admin tools',
        tour: 'admin',              // offers the matching tour ('app' or 'admin'), optional
        bullets: [
            'Predictions: download an Excel template for a player, fill in their scores, Joker and total tries, and upload it to enter their predictions for them. A preview shows any problems before anything is saved.',
            'Opening a section in Admin Functions now scrolls it into view, and Help is a normal button in the same list.'
        ]
    },
    {
        id: '2026-11-views-and-appearance',
        audience: 'all',
        date: '22 Nov 2026',
        title: 'New ways to read the table',
        tour: 'app',
        bullets: [
            'Focus view: an easy-to-read table in plain text with larger type. Jokers are shaded light gold. Choose it under Table view in your account menu (your initial, top right).',
            'Compact now has a Show match details button next to the download button. It adds the date and tries to the match headings. The old Full view is part of Compact now.',
            'Appearance: choose Light, Dark or Auto (follows your phone) in the same menu.',
            'The match being played, or the next one, is tinted in Compact and Focus.',
            'Classic view keeps the names and dates on the left while you scroll sideways.'
        ]
    }
];

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
