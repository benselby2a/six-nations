// Guided tour of the main features, started from the App Help pop-up (admin features have their own tour)
// Classic script (shared global scope); load order is set in index.html.

let tourState = null;           // { index, steps, kind }
let tourDemoActive = false;     // set by dev/tour-demo.js while the tour screenshots are taken; stops reloads from replacing example data
let tourSuppressOffer = false;

function tourRulesHtml() {
    const r = getEffectiveScoringRules();
    const pts = (n) => `${n} point${n === 1 ? '' : 's'}`;
    const items = [];
    items.push(`Pick the right winner (or a draw): <strong>${pts(r.correctResultPoints)}</strong>.`);
    items.push(`Get the exact score: <strong>+${r.perfectScoreBonus}</strong> bonus.`);
    if (r.drawBonus > 0) items.push(`Call a draw correctly: <strong>+${r.drawBonus}</strong> bonus.`);
    r.closeTiers.filter(t => t.bonusPoints > 0).forEach(t => {
        items.push(`Each team's score within <strong>${t.withinPoints}</strong> of the real one: <strong>+${t.bonusPoints}</strong>.`);
    });
    if (r.maxJokersPerUser > 0) {
        items.push(`<strong>${r.maxJokersPerUser} Joker${r.maxJokersPerUser === 1 ? '' : 's'}</strong>: choose ${r.maxJokersPerUser === 1 ? 'it' : 'them'} on a Joker eligible match and the points for that match are doubled.`);
    }
    const prizes = [];
    if (r.payoutFirstPct > 0) prizes.push(`1st ${r.payoutFirstPct}%`);
    if (r.payoutSecondPct > 0) prizes.push(`2nd ${r.payoutSecondPct}%`);
    if (r.payoutThirdPct > 0) prizes.push(`3rd ${r.payoutThirdPct}%`);
    if (r.payoutClosestTriesPct > 0) prizes.push(`closest tries ${r.payoutClosestTriesPct}%`);
    if (r.entryFeeAmount > 0 || prizes.length) {
        items.push(`Prizes${r.entryFeeAmount > 0 ? ` (entry ${formatCurrencyAmount(r.entryFeeAmount)})` : ''}: ${prizes.join(', ') || 'to be confirmed'}.`);
    }
    return `<ul class="tour-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}


function tourCanAddToHomeScreen() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !isStandaloneApp();
}

// ---- Steps: a fixed card with a static picture of the feature (taken from the app on example data),
// numbered marks on the picture, and numbered instructions that match them. Pictures: tour-images/, js/tour-images.js ----
function tourStep(id, title, items, extra) {
    return { id, title, items, extra: extra || '' };
}

function tourBuildSteps(rulesHtml) {
    const steps = [];
    steps.push({ id: null, title: 'Review the rules', raw: () => `<p>Here is how points are won in ${selectedYear}.</p>${rulesHtml}` });
    steps.push(tourStep('predictions', 'Add your predictions', [
        'Tap <strong>My Predictions</strong> at the top of the screen.',
        'Tap <strong>Edit</strong> next to a match, enter your scores, tick <strong>Use Joker</strong> on a Joker match, then tap <strong>Save</strong>.'
    ], isGuest
        ? '<p>Sign in to enter your own predictions.</p>'
        : '<p>Predictions lock when the tournament starts, so get them in early. Open <strong>Rules</strong> at the top of the screen any time to see how points are won.</p>'));
    steps.push(tourStep('score', 'See the leaderboard', [
        'Tap <strong>Match Summary</strong> at the top of the screen. It is the screen you land on after signing in.',
        'Everyone\'s rank and total score are on the left, with each prediction and the points it earned for every match.',
        'Choose how the table looks (<strong>Compact, Classic or Jumbo</strong>) on the next screen.'
    ], '<p>Tap any prediction to see how it was scored. The header row stays at the top as you scroll, and a 🃏 marks a Joker. <strong>All matches / Current round</strong> sits above the table.</p>'));
    steps.push({ id: null, title: 'Choose your view', raw: () => tourViewsHtml(), needsViewChoice: true });
    steps.push(tourStep('menu-view', 'Change your view any time', [
        'Tap your <strong>initial</strong> at the top right to open the player menu.',
        'Under <strong>Table view</strong>, choose Compact, Classic or Jumbo whenever you like.',
        'Under <strong>Appearance</strong>, choose Light, Dark or Auto.'
    ], '<p>Your choices are remembered on this device. Auto follows your phone\'s light or dark setting.</p>'));
    steps.push(tourStep('pdf', 'Download and print', [
        'Tap the <strong>download icon</strong> above the table to save the Classic page as a PDF, or to print it.',
        'The button just before it, <strong>Show match details</strong>, adds the date and tries to the column headings in Compact and Jumbo.'
    ], '<p>The Classic view is the same Excel-styled page, shown on screen. On a computer the icon opens the file in a pop-up with Print and Save buttons. The picture shows the page you get.</p>'));
    if (tourCanAddToHomeScreen()) {
        steps.push({ id: null, title: 'Add it to your Home Screen', raw: () => '<p>For one-tap access, add the Six Nations Guesser to your iPhone Home Screen.</p><p>Tap the <strong>Share</strong> button <svg class="tour-share-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> in your browser, then choose <strong>Add to Home Screen</strong>. Open it from there and sign in with a code.</p><p><strong>Can\'t see the Share button?</strong> Press and hold (long press) the browser address at the bottom of the screen, then choose <strong>Share</strong>.</p>' });
    }
    return steps;
}

// The summary view choices, each with a picture: tapping one makes it the default (the same switch as above the table)
const TOUR_VIEW_OPTIONS = [
    ['compact', 'Compact', [
        'Designed for small screens: just the countries and scores, so more fits.',
        'Tap the details button beside the download icon to add match dates and try counts to the headers.',
        'Tap a match header or a prediction for the full details. The header row stays pinned as you scroll.'
    ]],
    ['classic', 'Classic', [
        'Best on a bigger screen (or pinch to zoom on a phone).',
        'An Excel-styled page: a spreadsheet-style grid, in light or dark.',
        'The whole tournament on one sheet, with win and lose shading and rank colours.'
    ]],
    ['simple', 'Jumbo', [
        'The easiest to read: larger plain text, no icons or flags.',
        'Compact\'s layout: just the countries and scores.',
        'A Joker is shown by light gold shading on the cell, not a card.'
    ]]
];
// A big picture of the chosen view above the choices, and what is good about it below. Tapping a choice makes it the default.
function tourViewsHtml() {
    const chosen = !!(tourState && tourState.viewChosen);
    const current = (typeof summaryViewMode !== 'undefined') ? summaryViewMode : 'compact';
    const pictures = TOUR_VIEW_OPTIONS.map(([mode, label]) => {
        const image = (typeof TOUR_IMAGES !== 'undefined') ? TOUR_IMAGES['view-' + mode] : null;
        const img = image ? `<img src="${image.src}?v=${image.v}" alt="The ${label} view" width="${image.w}" height="${image.h}" style="aspect-ratio:${image.w}/${image.h}">` : '';
        return `<div class="tour-view-pic" data-view="${mode}"${mode === current ? '' : ' hidden'}>${img}</div>`;
    }).join('');
    // Nothing is highlighted until the person taps a view: that tap is their choice of default, and it unlocks Next
    const tabs = TOUR_VIEW_OPTIONS.map(([mode, label]) => {
        const on = chosen && mode === current;
        return `<span class="tour-view-cell"><button type="button" class="tour-view-tab${on ? ' on' : ''}" data-view="${mode}" aria-pressed="${on}" onclick="tourPickView('${mode}')"><i class="tour-radio" aria-hidden="true"></i><b>${label}</b></button></span>`;
    }).join('');
    const points = TOUR_VIEW_OPTIONS.map(([mode, label, list]) =>
        `<ul class="tour-view-points" data-view="${mode}"${mode === current ? '' : ' hidden'}>${list.map(t => `<li>${t}</li>`).join('')}</ul>`).join('');
    // A column: the picture takes whatever room is left above, so the choices and their highlights keep their place at the bottom
    return `<div class="tour-views-wrap"><p class="tour-views-intro">Tap a view to make it your default. You can change it any time from your player menu (next screen).</p>`
        + `<div class="tour-view-pics">${pictures}</div><div class="tour-view-tabs${chosen ? '' : ' pending'}" role="group" aria-label="Choose your view">${tabs}</div>`
        + `<p class="tour-views-need"${chosen ? ' hidden' : ''}>Choose a view to continue.</p><div class="tour-view-points-stack">${points}</div></div>`;
}
function tourPickView(mode) {
    if (typeof setSummaryView === 'function') setSummaryView(mode);
    if (tourState) tourState.viewChosen = true;
    tourUpdateNext();
    const group = document.querySelector('#tourBody .tour-view-tabs');
    if (group) group.classList.remove('pending');
    const need = document.querySelector('#tourBody .tour-views-need');
    if (need) need.hidden = true;
    document.querySelectorAll('#tourBody [data-view]').forEach(el => {
        const on = el.dataset.view === mode;
        if (el.classList.contains('tour-view-tab')) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
        else el.hidden = !on;
    });
    if (typeof tourFitSoon === 'function') tourFitSoon();
}

function tourBuildAdminSteps() {
    return [
        tourStep('admin-menu', 'Your admin menu', [
            'Tap <strong>Admin Functions</strong> at the top of the screen.',
            'Each button opens a section, and the menu stays at the top so you can jump between sections.'
        ], '<p>The <strong>Setup Checklist</strong> button opens a screen showing which setup tasks for the year are done, including locking predictions once everyone is in and entering scores for finished matches.</p>'),
        tourStep('admin-fixtures', 'Fixtures and Scores', [
            'Admin Functions, then <strong>Fixtures and Scores</strong>. Tap a row to edit a fixture, set it Joker eligible, or enter its score and tries.',
            '<strong>Bulk Import</strong> adds a whole year at once, one fixture per line. Tip: ask Google AI to write the lines as <em>DD/MM/YYYY, HH:MM, Home, Away</em>.'
        ], '<p>Add New Fixture adds a single match. Rounds are worked out from the dates.</p>'),
        tourStep('admin-scores', 'Adding scores to matches', [
            'Quickest, on the day: tap the red <strong>+ score</strong> button above the Match Summary, enter the score and tries, and save. It offers the match that is on now (or the next one still without a score), and becomes <strong>Update</strong> once a score is in.',
            'Any other match, or to correct a mistake: Admin Functions, then <strong>Fixtures and Scores</strong>, tap <strong>Edit</strong> on the fixture and enter its score and tries.',
            'The <strong>Setup Checklist</strong> lists matches still missing a score and takes you straight to Fixtures and Scores.'
        ], '<p>Points, ranks and the Points Progression chart update as soon as a score is saved. Everyone\'s Match Summary picks it up on their next refresh (every 2 minutes during a match).</p>'),
        tourStep('admin-lock', 'Predictions and the lock', [
            'Admin Functions, then <strong>Predictions</strong>.',
            'Switch on <strong>Lock Predictions</strong> when the tournament starts. Each year has its own lock.',
            'Pick a competitor to review or correct their predictions, Jokers and tries guess.'
        ]),
        tourStep('admin-competitors', 'Competitors', [
            'Admin Functions, then <strong>Competitors</strong>.',
            'To add someone, enter their email in <strong>+ Add a competitor</strong>. They sign in with an emailed code and fill in their own name and teams.',
            'Each card lets you change a name, email (two per person are allowed), teams, whether they are playing this year, whether they are <strong>exempt from the prize fund</strong> (has not paid), and admin access.'
        ]),
        tourStep('admin-rules', 'Guesser Rules', [
            'Admin Functions, then <strong>Guesser Rules</strong>.',
            'Set the points for a correct result, an exact score, draws, close scores and Jokers. Check the preview, then save.'
        ], '<p>Competitors see these rules at the start of their tour.</p>'),
        tourStep('admin-prize', 'Prize Fund', [
            'Admin Functions, then <strong>Prize Fund</strong>.',
            'Set the entry fee and how the pot is split between 1st, 2nd, 3rd and closest tries.'
        ], '<p>Everyone sees the projected prize money under the Match Summary.</p>'),
        tourStep('admin-years', 'Years', [
            'Admin Functions, then <strong>Years</strong>.',
            'Add a new year here, copying last year\'s rules if you like.',
            'Each year lists its fixtures, results and predictions.'
        ], '<p>A year that still has predictions cannot be removed until they are cleared.</p>')
    ];
}

// Load the tour pictures ahead of time so each one is already there when its step opens
const tourPreloaded = [];
function tourPreload(kind, urgent) {
    if (typeof TOUR_IMAGES === 'undefined') return;
    Object.keys(TOUR_IMAGES).filter(id => (kind === 'admin') === id.startsWith('admin-')).forEach(id => {
        const info = TOUR_IMAGES[id];
        const src = `${info.src}?v=${info.v}`;
        if (tourPreloaded.some(img => img.dataset.src === src)) return;
        const img = new Image();
        img.dataset.src = src;
        img.decoding = 'sync';
        img.fetchPriority = urgent ? 'high' : 'low';   // quietly in the background, but at once when the tour has been opened
        img.src = src;
        tourPreloaded.push(img);   // keep a reference so the download is not dropped
    });
}

// Fit the card to the area that is really visible (iPhone Safari's toolbars change it), not to 100vh
let tourLastW = 0, tourLastH = 0;
function tourFitScreen(evt) {
    const vv = window.visualViewport;
    const h = Math.round((vv && vv.height) || window.innerHeight);
    const w = Math.round((vv && vv.width) || window.innerWidth);
    document.documentElement.style.setProperty('--tour-h', `${h}px`);
    const top = (vv && vv.offsetTop) || 0;
    document.getElementById('tourLayer').style.top = `${Math.round(top)}px`;
    // Scrolling the page behind the tour makes iPhone Safari's toolbars collapse and expand, which fires resize / visual-viewport
    // events: only the first fit and a real size change re-fit the card (and then without hiding the picture), so nothing flickers
    const changed = !tourLastH || Math.abs(h - tourLastH) > 1 || Math.abs(w - tourLastW) > 1;
    const first = !evt || !tourLastH;
    tourLastW = w; tourLastH = h;
    if (first) tourFitSoon();
    else if (changed) tourFitSoon(true);
}

// Make everything fit without scrolling: the picture shrinks to the space left after the text; on very small screens
// the text tightens up, and as a last resort the picture is left out so the instructions are always fully visible
// Fit now, then once more after the browser has laid out (resizes and iPhone toolbars settle a moment later)
let tourSizeAnimating = false;

// The small text-only card and the full picture card are different sizes: ease from one to the other
function tourAnimateSize(before) {
    const card = document.getElementById('tourCard');
    const after = card.getBoundingClientRect().height;
    if (before < 20 || Math.abs(after - before) < 6 || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || !card.animate) return;
    tourSizeAnimating = true;
    const move = card.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 300, easing: 'ease-out' });
    const done = () => { tourSizeAnimating = false; if (tourState) tourFitSoon(); };
    move.finished.then(done, done);
}

function tourFitSoon(quiet) {
    // Pictures stay invisible until they have loaded and been sized (no flash of a wrong size, never shown tiny)
    const hideable = () => [document.querySelector('#tourBody .tour-figure'), document.querySelector('#tourBody .tour-view-pics')].filter(Boolean);
    if (!quiet) hideable().forEach(el => { el.style.visibility = 'hidden'; });   // quiet: a re-fit after a resize keeps the picture on screen
    if (tourSizeAnimating) return;   // sizes are measured once the card has finished changing size (then this runs again)
    requestAnimationFrame(() => {
        tourFitContent(true);
        setTimeout(() => {
            tourFitContent(true);
            // A picture that has not arrived yet has no size to fit: keep it hidden, and fit again the moment it loads
            const waiting = [...document.querySelectorAll('#tourBody img')].filter(i => !i.complete);
            if (!waiting.length && !quiet) hideable().forEach(el => { el.style.visibility = ''; });
            waiting.forEach(i => i.addEventListener('load', () => { if (tourState) tourFitSoon(); }, { once: true }));
        }, 120);
    });
}

function tourFitContent(allowHide) {
    const body = document.getElementById('tourBody');
    const card = document.getElementById('tourCard');
    if (!body || !card || !tourState) return;
    // The view-choice step: the picture area absorbs the difference between the three pictures (it is a flexible region above the
    // choices); here it is only made smaller if the text under it would otherwise not fit without scrolling
    if (body.querySelector('.tour-view-pics')) {
        card.classList.remove('tour-compact');
        const pics = body.querySelector('.tour-view-pics');
        const overflows = () => body.scrollHeight > body.clientHeight + 1;
        const screenH = (window.visualViewport && window.visualViewport.height) || innerHeight;
        let min = Math.round(screenH * 0.3);
        pics.style.minHeight = min + 'px';
        while (overflows() && min > 50) { min -= 8; pics.style.minHeight = min + 'px'; }
        // A short screen: when the picture would end up small, tighten everything below it (no intro, smaller cards, two highlights)
        if (overflows() || pics.clientHeight < 120) {
            card.classList.add('tour-compact');
            pics.style.minHeight = Math.round(screenH * 0.3) + 'px';
            min = Math.round(screenH * 0.3);
            while (overflows() && min > 30) { min -= 8; pics.style.minHeight = min + 'px'; }
        }
        return;
    }
    const fig = body.querySelector('.tour-figure');
    const img = fig && fig.querySelector('img');
    let naturalHeight = 0;   // how tall the picture would like to be
    const room = () => {
        if (!img) return null;
        img.style.maxHeight = 'none';
        naturalHeight = img.offsetHeight;
        const figStyle = getComputedStyle(fig);
        const figOuter = fig.offsetHeight + parseFloat(figStyle.marginBottom || 0);
        const chrome = fig.offsetHeight - img.offsetHeight;
        const textHeight = body.scrollHeight - figOuter;
        return body.clientHeight - textHeight - parseFloat(figStyle.marginBottom || 0) - chrome;
    };
    card.classList.remove('tour-compact');
    const extra = body.querySelector('.tour-extra');
    if (extra) extra.style.display = '';
    if (fig) fig.style.display = '';
    let space = room();
    if (img && space < Math.min(150, naturalHeight)) { card.classList.add('tour-compact'); space = room(); }
    if (img && space < Math.min(110, naturalHeight) && extra) { extra.style.display = 'none'; space = room(); }
    if (img && space < Math.min(55, naturalHeight) && allowHide) { fig.style.display = 'none'; img.style.maxHeight = ''; if (extra) extra.style.display = ''; card.classList.remove('tour-compact'); return tourFitText(card, body); }
    if (img) {
        let max = Math.max(Math.floor(space) - 4, 40);
        img.style.maxHeight = `${max}px`;
        // Correct any rounding left over: shrink the picture by whatever still overflows
        for (let i = 0; i < 4 && body.scrollHeight > body.clientHeight + 2; i++) {
            max -= (body.scrollHeight - body.clientHeight) + 2;
            img.style.maxHeight = `${Math.max(max, 40)}px`;
        }
        if (allowHide && body.scrollHeight > body.clientHeight + 2) { fig.style.display = 'none'; img.style.maxHeight = ''; }
    }
    tourFitText(card, body);
}

// Text-only steps (and the picture-less fallback) tighten up if they would still need to scroll
function tourFitText(card, body) {
    if (body.scrollHeight > body.clientHeight + 2) card.classList.add('tour-compact');
}

// The page behind the tour does not scroll (that made the toolbars of iPhone Safari move and the card flicker); only the card's own text may
function tourBlockScroll(e) {
    if (!tourState) return;
    const t = e.target && e.target.closest ? e.target.closest('#tourBody') : null;
    if (t && t.scrollHeight > t.clientHeight + 1) return;   // the card's text scrolls when it is longer than the card
    e.preventDefault();
}

function startTour(kind) {
    if (kind !== 'admin') kind = 'app';
    if (kind === 'admin' && !isCurrentUserAdmin()) return;
    closeGlobalHelpModal();
    tourPreload(kind, true);   // the tour is open: fetch every picture now
    const steps = kind === 'admin' ? tourBuildAdminSteps() : tourBuildSteps(tourRulesHtml());
    tourState = { index: 0, steps, kind };
    tourLastW = 0; tourLastH = 0;
    tourFitScreen();
    document.addEventListener('touchmove', tourBlockScroll, { passive: false });
    document.addEventListener('wheel', tourBlockScroll, { passive: false });
    window.addEventListener('resize', tourFitScreen);
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', tourFitScreen); window.visualViewport.addEventListener('scroll', tourFitScreen); }
    document.body.classList.add('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'false');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (tourState) tourFitSoon(); });   // web fonts that arrive late change the text height
    document.addEventListener('keydown', tourKeys);
    showTourStep(0);
}

function tourKeys(event) {
    if (!tourState) return;
    if (event.key === 'Escape') endTour();
    else if (event.key === 'ArrowRight') nextTourStep();
    else if (event.key === 'ArrowLeft') prevTourStep();
}

function tourFigureHtml(id) {
    const image = (typeof TOUR_IMAGES !== 'undefined') ? TOUR_IMAGES[id] : null;
    if (!image) return '';
    const marks = (image.marks || []).map(m =>
        `<span class="tour-mark" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"><b>${m.n}</b></span>`).join('');
    return `<div class="tour-figure"><div class="tour-figure-inner"><img src="${image.src}?v=${image.v}" alt="" width="${image.w}" height="${image.h}" style="aspect-ratio:${image.w}/${image.h}">${marks}</div></div>`;
}

function showTourStep(index) {
    if (!tourState) return;
    const step = tourState.steps[index];
    const sizeBefore = document.getElementById('tourCard').getBoundingClientRect().height;
    const direction = index > tourState.index ? 'next' : (index < tourState.index ? 'prev' : 'none');
    tourState.index = index;
    const total = tourState.steps.length;
    document.getElementById('tourCount').textContent = `${index + 1} of ${total}`;
    document.getElementById('tourTitle').textContent = step.title;
    const text = step.raw
        ? step.raw()
        : `<ol class="tour-items">${step.items.map(i => `<li>${i}</li>`).join('')}</ol>${step.extra ? `<div class="tour-extra">${step.extra}</div>` : ''}`;
    document.getElementById('tourBody').innerHTML = (step.id ? tourFigureHtml(step.id) : '') + text;
    document.getElementById('tourBody').classList.toggle('tour-body-views', !!step.needsViewChoice);   // this step is a column that fills the card
    document.getElementById('tourBody').scrollTop = 0;
    document.getElementById('tourBack').disabled = index === 0;
    document.getElementById('tourNext').textContent = index === total - 1 ? 'Done' : 'Next';
    document.getElementById('tourDots').innerHTML = tourState.steps.map((_, i) => `<span class="tour-dot ${i === index ? 'on' : ''}"></span>`).join('');
    document.getElementById('tourCard').classList.toggle('tour-short', !step.id);
    tourAnimateSize(sizeBefore);
    tourAnimateStep(direction);
    tourFitSoon();
    tourUpdateNext();
    if (!tourNextBlocked()) document.getElementById('tourNext').focus();
}

// Slide the new step's title and content in from the side you are heading towards (the card itself stays put)
function tourAnimateStep(direction) {
    const card = document.getElementById('tourCard');
    card.classList.remove('tour-go-next', 'tour-go-prev');
    if (direction === 'none') return;
    void card.offsetWidth;   // restart the animation
    card.classList.add(direction === 'next' ? 'tour-go-next' : 'tour-go-prev');
}

// The view step cannot be skipped past: Next waits until a default view has been chosen
function tourNextBlocked() {
    const step = tourState && tourState.steps[tourState.index];
    return !!(step && step.needsViewChoice && !tourState.viewChosen);
}
function tourUpdateNext() {
    const btn = document.getElementById('tourNext');
    if (!btn || !tourState) return;
    btn.disabled = tourNextBlocked();
    btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
    // On the view step the button says what is needed until a view has been chosen
    if (btn.disabled) btn.textContent = 'Select view';
    else btn.textContent = tourState.index === tourState.steps.length - 1 ? 'Done' : 'Next';
}
function nextTourStep() {
    if (!tourState || tourNextBlocked()) return;
    if (tourState.index >= tourState.steps.length - 1) { endTour(true); return; }
    showTourStep(tourState.index + 1);
}

function prevTourStep() {
    if (!tourState || tourState.index === 0) return;
    showTourStep(tourState.index - 1);
}

function endTour(completed) {
    if (!tourState) return;
    if (completed === true) {
        if (tourState.kind === 'admin') rememberAdminTourAnswer('yes'); else rememberTourAnswer('yes');
        trackUsage(tourState.kind === 'admin' ? 'admin tour completed' : 'tour completed');
    }
    tourState = null;
    if (typeof whatsNewSchedule === 'function') whatsNewSchedule();   // a pending new-feature notice can show now
    document.removeEventListener('keydown', tourKeys);
    window.removeEventListener('resize', tourFitScreen);
    document.removeEventListener('touchmove', tourBlockScroll);
    document.removeEventListener('wheel', tourBlockScroll);
    if (window.visualViewport) { window.visualViewport.removeEventListener('resize', tourFitScreen); window.visualViewport.removeEventListener('scroll', tourFitScreen); }
    document.body.classList.remove('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'true');
}

// ---- First sign-in: offer the tour once and remember the answer (on this device, per person) ----
const TOUR_ANSWERED_KEY_PREFIX = 'tourAnswered:';

function tourAnswerKey() {
    return TOUR_ANSWERED_KEY_PREFIX + (currentUsername || '');
}

function tourAlreadyAnswered() {
    try { return !!localStorage.getItem(tourAnswerKey()); } catch (error) { return true; }   // no storage: do not nag
}

function rememberTourAnswer(answer) {
    try { localStorage.setItem(tourAnswerKey(), answer); } catch (error) { /* ignore */ }
}

function maybeOfferTour() {
    if (window.__noTourPrompts) return;   // test hook
    if (!currentUsername || isGuest || isPdfExportMode || tourState || tourAlreadyAnswered()) return;
    const modal = document.getElementById('tourPromptModal');
    if (!modal) return;
    tourPreload('app');
    document.getElementById('tourPromptText').textContent = `Welcome to the ${selectedYear} Six Nations Guesser, would you like to take a quick tour of the app before you start logging your predictions?`;
    modal.classList.remove('hidden');
    const yes = document.getElementById('tourPromptYes');
    if (yes) yes.focus();
}

function answerTourPrompt(takeTour) {
    // "No thanks" is remembered at once. "Take the tour" is only remembered when the tour is finished, so someone
    // who leaves it half way is asked again next time.
    if (!takeTour) rememberTourAnswer('no');
    const modal = document.getElementById('tourPromptModal');
    if (modal) modal.classList.add('hidden');
    trackUsage(takeTour ? 'tour accepted' : 'tour declined');
    if (takeTour) startTour();
}

// ---- The first time an admin opens the admin panel: offer the admin tour (same rules as the competitor tour) ----
const ADMIN_TOUR_ANSWERED_KEY_PREFIX = 'adminTourAnswered:';

function adminTourAnswerKey() {
    return ADMIN_TOUR_ANSWERED_KEY_PREFIX + (currentUsername || '');
}

function rememberAdminTourAnswer(answer) {
    try { localStorage.setItem(adminTourAnswerKey(), answer); } catch (error) { /* ignore */ }
}

function maybeOfferAdminTour() {
    if (window.__noTourPrompts) return;   // test hook
    if (!currentUsername || isGuest || tourState || tourSuppressOffer || !isCurrentUserAdmin()) return;
    try { if (localStorage.getItem(adminTourAnswerKey())) return; } catch (error) { return; }   // no storage: do not nag
    const modal = document.getElementById('adminTourPromptModal');
    if (!modal) return;
    tourPreload('admin');
    modal.classList.remove('hidden');
    const yes = document.getElementById('adminTourPromptYes');
    if (yes) yes.focus();
}

function answerAdminTourPrompt(takeTour) {
    // "No thanks" is remembered at once; "Take the tour" only once it is finished
    if (!takeTour) rememberAdminTourAnswer('no');
    const modal = document.getElementById('adminTourPromptModal');
    if (modal) modal.classList.add('hidden');
    trackUsage(takeTour ? 'admin tour accepted' : 'admin tour declined');
    if (takeTour) startTour('admin');
}
