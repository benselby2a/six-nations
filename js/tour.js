// Guided tour of the main features, started from the App Help pop-up (admin features are not covered)
// Classic script (shared global scope); load order is set in index.html.

let tourState = null;   // { index, steps, timer }

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


// ---- Example data: the tour never shows real results or people ----
let tourDemoActive = false;
let tourSaved = null;

function tourDemoData() {
    const year = selectedYear;
    const m = (id, round, date, time, t1, t2, s1, s2, tr1, tr2, joker) => ({ id, year, round, date, time, team1: t1, team2: t2, actualScore1: s1, actualScore2: s2, actualTries1: tr1, actualTries2: tr2, jokerEligible: joker });
    const demoMatches = [
        m(9001, 1, 'Thu, Feb 5', '20:10', 'France', 'Ireland', 36, 14, 5, 2, false),
        m(9002, 1, 'Sat, Feb 7', '14:10', 'Italy', 'Scotland', 18, 15, 2, 1, false),
        m(9003, 1, 'Sat, Feb 7', '16:40', 'England', 'Wales', 24, 19, 3, 2, true),
        m(9004, 2, 'Sat, Feb 14', '14:10', 'Ireland', 'Italy', 30, 12, 4, 1, false),
        m(9005, 2, 'Sat, Feb 14', '16:40', 'Scotland', 'England', null, null, null, null, true),
        m(9006, 2, 'Sun, Feb 15', '15:10', 'Wales', 'France', null, null, null, null, false)
    ];
    const preds = (list) => { const o = {}; list.forEach((p, i) => { if (p) o[9001 + i] = { team1: p[0], team2: p[1] }; }); return o; };
    const person = (id, nickname, teams, tries, list) => ({ id, nickname, totalTries: tries, supportedTeams: teams, predictions: preds(list) });
    const demoUsers = {
        demoalex: person(9101, 'Alex', ['France'], 24, [[30, 12], [20, 16], [22, 17], [28, 10], [18, 21], [14, 29]]),
        demobryn: person(9102, 'Bryn', ['Wales'], 31, [[25, 20], [15, 18], [20, 24], [32, 14], [19, 22], [16, 24]]),
        democara: person(9103, 'Cara', ['Scotland'], 27, [[34, 14], [12, 21], [26, 18], [24, 12], [21, 17], [10, 33]]),
        demodev: person(9104, 'Dev', ['Italy', 'England'], 29, [[22, 18], [18, 15], [18, 21], [27, 13], [20, 20], [12, 30]]),
        demoerin: person(9105, 'Erin', ['Ireland'], 22, [[28, 24], [24, 10], [23, 19], [20, 15], [16, 25], [9, 28]])
    };
    // The signed-in person appears as "You" with a half-finished card, so the predictions screen has something to show
    if (currentUsername && !isGuest) {
        demoUsers[currentUsername] = person(9100, 'You', [], 26, [[31, 13], [17, 14], [24, 19], [29, 11], null, null]);
    }
    const jokers = { demoalex: [9003], demobryn: [9005], democara: [9003], demodev: [9003], demoerin: [9005] };
    if (demoUsers[currentUsername]) jokers[currentUsername] = [9003];
    const at = (mins) => new Date(Date.now() - mins * 60000).toISOString();
    const chat = {
        available: true,
        comments: [
            { id: 1, match_id: 9001, user_id: 9102, target_user_id: null, body: 'What a start for France. Nobody saw that coming!', created_at: at(180) },
            { id: 2, match_id: 9001, user_id: 9104, target_user_id: null, body: 'Joker well spent. Thank you France.', created_at: at(95) },
            { id: 3, match_id: 9001, user_id: 9103, target_user_id: 9102, body: 'Bold pick, Bryn. Ireland by 5?', created_at: at(60) },
            { id: 4, match_id: 9002, user_id: 9105, target_user_id: null, body: 'Italy edge it. Table is wide open now.', created_at: at(1500) }
        ],
        reactions: [
            { id: 1, match_id: 9001, user_id: 9102, target_user_id: null, emoji: '🔥' }, { id: 2, match_id: 9001, user_id: 9103, target_user_id: null, emoji: '🔥' },
            { id: 3, match_id: 9001, user_id: 9104, target_user_id: null, emoji: '😱' }, { id: 4, match_id: 9002, user_id: 9101, target_user_id: null, emoji: '😱' },
            { id: 5, match_id: 9002, user_id: 9103, target_user_id: null, emoji: '😭' }, { id: 6, match_id: 9001, user_id: 9101, target_user_id: 9102, emoji: '😂' },
            { id: 7, match_id: 9003, user_id: 9105, target_user_id: 9104, emoji: '👏' }
        ]
    };
    // An invited person who has not signed in yet, and example sign-in accounts for the Competitors screen
    demoUsers.demoinvite = { id: 9106, nickname: null, totalTries: null, supportedTeams: [], predictions: {} };
    const emails = { demoalex: 'alex@example.com', demobryn: 'bryn@example.com', democara: 'cara@example.com', demodev: 'dev@example.com', demoerin: 'erin@example.com', demoinvite: 'newplayer@example.com' };
    const emails2 = { demodev: 'dev.home@example.com' };
    const accounts = [
        { auth_user_id: 'demo-a1', email: 'alex@example.com', linked_username: 'demoalex' },
        { auth_user_id: 'demo-a2', email: 'bryn@example.com', linked_username: 'demobryn' },
        { auth_user_id: 'demo-a3', email: 'cara@example.com', linked_username: 'democara' },
        { auth_user_id: 'demo-a4', email: 'dev@example.com', linked_username: 'demodev' },
        { auth_user_id: 'demo-a5', email: 'dev.home@example.com', linked_username: 'demodev' },
        { auth_user_id: 'demo-a6', email: 'erin@example.com', linked_username: 'demoerin' }
    ];
    const usage = [
        { created_at: at(5), actor: 'Alex', action: 'saves prediction', payload: '{"match":9005,"score":"18-21"}' },
        { created_at: at(40), actor: 'Bryn', action: 'logs in', payload: '' },
        { created_at: at(95), actor: 'Cara', action: 'fixture comment', payload: '{"match":9001}' },
        { created_at: at(300), actor: 'Dev', action: 'saves prediction', payload: '{"match":9006,"score":"12-30"}' }
    ];
    return { demoMatches, demoUsers, jokers, chat, emails, emails2, accounts, usage };
}

function enterTourDemo() {
    tourSaved = {
        users, matches: matches.slice(), allMatches, appSettings, activeScoringRules, userJokerSelections, fixtureChat,
        from: supabaseClient.from, rpc: supabaseClient.rpc,
        authAccounts, authAccountsLoaded, competitorEmails, competitorEmails2, adminUsernames,
        getSeasonCounts: Storage.getSeasonCounts, getUsageEvents: Storage.getUsageEvents
    };
    const demo = tourDemoData();
    tourDemoActive = true;
    users = demo.demoUsers;
    matches.splice(0, matches.length, ...demo.demoMatches);
    allMatches = demo.demoMatches.slice();
    appSettings = { ...appSettings, predictionsLocked: false, activeOverrides: {} };
    // The scoring rules (and prize split) stay the real ones: only people, matches, predictions and chat are examples
    userJokerSelections = demo.jokers;
    fixtureChat = demo.chat;
    // Admin screens: example sign-in accounts, emails, admins, year counts and usage events (no real addresses)
    authAccounts = demo.accounts;
    authAccountsLoaded = true;
    competitorEmails = demo.emails;
    competitorEmails2 = demo.emails2;
    adminUsernames = [currentUsername, 'demoalex'].filter(Boolean);
    Storage.getSeasonCounts = async () => ({ predictions: 30, tries: 5, competitors: 5, results: 4 });
    Storage.getUsageEvents = async () => demo.usage;
    // Nothing the tour touches may reach the database
    const quiet = () => {
        const builder = { then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject) };
        ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle'].forEach(name => { builder[name] = () => builder; });
        return builder;
    };
    supabaseClient.from = quiet;
    supabaseClient.rpc = async () => ({ data: null, error: null });
    tourRerenderCurrentScreen();
}

function leaveTourDemo() {
    if (!tourDemoActive || !tourSaved) return;
    closeFixtureChat();
    supabaseClient.from = tourSaved.from;
    supabaseClient.rpc = tourSaved.rpc;
    users = tourSaved.users;
    matches.splice(0, matches.length, ...tourSaved.matches);
    allMatches = tourSaved.allMatches;
    appSettings = tourSaved.appSettings;
    activeScoringRules = tourSaved.activeScoringRules;
    userJokerSelections = tourSaved.userJokerSelections;
    fixtureChat = tourSaved.fixtureChat;
    authAccounts = tourSaved.authAccounts;
    authAccountsLoaded = tourSaved.authAccountsLoaded;
    competitorEmails = tourSaved.competitorEmails;
    competitorEmails2 = tourSaved.competitorEmails2;
    adminUsernames = tourSaved.adminUsernames;
    Storage.getSeasonCounts = tourSaved.getSeasonCounts;
    Storage.getUsageEvents = tourSaved.getUsageEvents;
    tourSaved = null;
    tourDemoActive = false;
}

function tourRerenderCurrentScreen() {
    const summary = document.getElementById('summaryTab');
    const predictions = document.getElementById('predictionsTab');
    if (summary && !summary.classList.contains('hidden')) showSummary();
    if (predictions && !predictions.classList.contains('hidden')) { renderMatches(); loadPredictions(); }
}

// The summary table scrolls sideways under its sticky rank, name and score columns. Pick a chat chip that is
// really on screen (not hidden under those columns) so the highlight lands on a speech bubble.
function tourStickyEdge(container) {
    const sticky = container.querySelector('th.pts-col');
    return sticky ? sticky.getBoundingClientRect().right : container.getBoundingClientRect().left;
}

function tourVisibleChip() {
    const chips = [...document.querySelectorAll('[data-chat-chip]')];
    const container = document.querySelector('.summary-container');
    if (!container || chips.length === 0) return chips[0] || null;
    const edge = tourStickyEdge(container);
    const right = container.getBoundingClientRect().right;
    return chips.find(chip => { const r = chip.getBoundingClientRect(); return r.left >= edge + 2 && r.right <= right + 1; }) || chips[0];
}

// Scroll the table sideways so a chip sits just clear of the sticky columns
function tourRevealChip() {
    const container = document.querySelector('.summary-container');
    const chips = [...document.querySelectorAll('[data-chat-chip]')];
    if (!container || chips.length === 0) return;
    const edge = tourStickyEdge(container);
    const chip = chips[0].getBoundingClientRect().left < edge ? chips[0] : null;
    if (chip) container.scrollLeft += chip.getBoundingClientRect().left - (edge + 8);
}

// iPhone or iPad, not already opened from the Home Screen
function tourCanAddToHomeScreen() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !isStandaloneApp();
}

const TOUR_PANELS = {
    summary: 'summaryTab', predictions: 'predictionsTab', adminHome: 'adminHomeTab', results: 'resultsTab', scoreCorrections: 'scoreCorrectionsTab',
    competitors: 'competitorsTab', rules: 'rulesTab', prizeFund: 'prizeFundTab', years: 'yearsTab', recovery: 'recoveryTab', usageReport: 'usageReportTab'
};

function tourTabButton(name) {
    const btn = document.querySelector(`.tabs .tab[onclick*="'${name}'"]`);
    return btn && btn.offsetParent !== null ? btn : null;
}

function tourBuildSteps(rulesHtml, chatLive) {
    const steps = [];
    steps.push({
        title: 'Review the rules',
        html: () => `<p>Here is how points are won in ${selectedYear}.</p>${rulesHtml}`
    });
    const hasPredictions = !!tourTabButton('predictions');
    steps.push({
        title: 'Add your predictions',
        tab: hasPredictions ? 'predictions' : null,
        target: hasPredictions ? '#matchesContainer .match-card, #matchesContainer' : null,
        html: () => hasPredictions
            ? '<p>Enter a score for each team in every match. Your predictions save as you type.</p><p>On Joker eligible matches you can tick a Joker to double the points. Add your guess for the total tries under the matches and press Save Tournament Tries.</p><p>Predictions lock when the tournament starts, so get them in early.</p>'
            : '<p>Sign in to enter your own predictions: a score for each team in every match, your Joker, and a guess at the total tries.</p>'
    });
    steps.push({
        title: 'See the current score',
        tab: 'summary',
        target: '.summary-container',
        html: () => '<p>The Match Summary shows everyone\'s rank and total score, plus each person\'s prediction and the points it earned for every match.</p><p>Hover or tap a prediction to see how it was scored. Use Refresh to pull the latest results.</p>'
    });
    steps.push({
        title: 'The traditional view',
        tab: 'summary',
        target: '.summary-filters .export-btn',
        html: () => '<p>If you want the traditional view, open the <strong>PDF Summary</strong>. It lays the table out on a page you can read at a glance, save or print.</p>'
    });
    if (chatLive) {
        steps.push({
            title: 'Comment on matches and results',
            tab: 'summary',
            prepare: tourRevealChip,
            target: tourVisibleChip,
            html: () => '<p>Tap the 💬 chip under a match to comment on it or react with an emoji.</p><p>Tap any prediction in the table to comment on that guess. Emoji and comment counts show right on the table, and everyone can see who reacted.</p>'
        });
    }
    steps.push({
        title: 'Stats and insights',
        tab: 'summary',
        target: () => { const el = document.getElementById('triesStatsContainer'); return el ? el.parentElement : null; },
        html: () => '<p>Under the table you will find Tournament Stats (tries so far and the projected total), the prize money as things stand, and a chart of how everyone\'s points have moved match by match.</p>'
    });
    if (tourCanAddToHomeScreen()) {
        steps.push({
            title: 'Add it to your Home Screen',
            html: () => '<p>For one-tap access, add the Six Nations Guesser to your iPhone Home Screen.</p><p>Tap the <strong>Share</strong> button <svg class="tour-share-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> in your browser, then choose <strong>Add to Home Screen</strong>. Open it from there and sign in with a code.</p>'
        });
    }
    return steps;
}

function tourBuildAdminSteps() {
    const adminStep = (title, tab, target, html) => ({ title, tab, target, expandAdminMenu: !!tab, html: () => html });
    return [
        adminStep('Your admin menu', 'adminHome', '#adminPanel',
            '<p>Everything an admin does starts here. Each button opens a section, and the menu tucks itself away to leave room. Tap <strong>Admin Functions</strong> to bring it back.</p><p>A readiness checklist appears under the buttons while a new year still has things to set up.</p>'),
        adminStep('Fixtures and Scores', 'results', '#resultsTab .results-table-container',
            '<p>Add or edit fixtures, set which matches are Joker eligible, and enter results and tries after each match. Tap a row to edit it.</p><p>Under the table, <strong>Add New Fixture</strong> adds one match and <strong>Bulk Import</strong> pastes in a whole round. <strong>Add Next Score</strong> at the top of the page is the quick way to enter a result.</p>'),
        adminStep('Predictions and the lock', 'scoreCorrections', '#scoreCorrectionsTab .lock-toggle',
            '<p>Switch on <strong>Lock Predictions</strong> when the tournament starts, so nobody can change their picks. Each year has its own lock.</p><p>Below it you can pick any competitor to review or correct their predictions, Jokers and tries guess.</p>'),
        adminStep('Competitors', 'competitors', '#new-competitor-card',
            '<p>To add someone, enter their email in <strong>+ Add a competitor</strong>. That is all that is needed: they sign in with an emailed code and fill in their own name and teams.</p><p>Each card below lets you change a name, email (two per person are allowed), teams, whether they are playing this year, and admin access.</p>'),
        adminStep('Guesser Rules', 'rules', '#rulesTab .rules-layout',
            '<p>Set the points for a correct result, an exact score, draws, close scores and Jokers for the year. Check the preview, then save. Competitors see these rules in their tour.</p>'),
        adminStep('Prize Fund', 'prizeFund', '#prizeFundTab .rules-layout',
            '<p>Set the entry fee and how the prize pot is split between 1st, 2nd, 3rd and closest tries. Everyone sees the projected prize money under the Match Summary.</p>'),
        adminStep('Years', 'years', '#yearsTab .years-form',
            '<p>Each year has its own fixtures, predictions, rules and lock. Add a new year here, copying last year\'s rules if you like. A year that still has predictions cannot be removed until they are cleared.</p>'),
        adminStep('Database Recovery', 'recovery', '#recoveryTab .recovery-card',
            '<p>Generates SQL to rebuild the database, including competitors, emails, predictions and match chat. Copy it somewhere safe from time to time.</p>'),
        adminStep('Usage Report', 'usageReport', '#usageReportContainer',
            '<p>The latest 100 sign-ins and changes, with who did what and when. Handy if something looks wrong.</p>')
    ];
}

function startTour(kind) {
    if (kind !== 'admin') kind = 'app';
    if (kind === 'admin' && !isCurrentUserAdmin()) return;
    closeGlobalHelpModal();
    closeAdminHelpModal();
    // Work out what the real app offers first, then switch every screen to example data
    const steps = kind === 'admin' ? tourBuildAdminSteps() : tourBuildSteps(tourRulesHtml(), fixtureChat.available);
    enterTourDemo();
    tourState = { index: 0, steps, timer: null, kind };
    document.body.classList.add('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'false');
    tourState.timer = setInterval(positionTour, 300);
    window.addEventListener('resize', positionTour);
    window.addEventListener('scroll', positionTour, true);
    document.addEventListener('keydown', tourKeys);
    showTourStep(0);
}

function tourKeys(event) {
    if (!tourState) return;
    if (event.key === 'Escape') endTour();
    else if (event.key === 'ArrowRight') nextTourStep();
    else if (event.key === 'ArrowLeft') prevTourStep();
}

async function showTourStep(index) {
    if (!tourState) return;
    const step = tourState.steps[index];
    tourState.index = index;
    const total = tourState.steps.length;
    // Go to the screen this step is about by tapping its tab, as a person would
    if (step.tab) {
        if (step.expandAdminMenu) setAdminPanelCollapsed(false);
        const btn = tourTabButton(step.tab);
        const panelId = TOUR_PANELS[step.tab] || 'summaryTab';
        const panel = document.getElementById(panelId);
        if (btn && panel && panel.classList.contains('hidden')) {
            btn.click();
            await new Promise(r => setTimeout(r, 450));
            if (!tourState) return;
        }
    }
    document.getElementById('tourCount').textContent = `${index + 1} of ${total}`;
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourBody').innerHTML = step.html();
    document.getElementById('tourBack').disabled = index === 0;
    document.getElementById('tourNext').textContent = index === total - 1 ? 'Done' : 'Next';
    document.getElementById('tourDots').innerHTML = tourState.steps.map((_, i) => `<span class="tour-dot ${i === index ? 'on' : ''}"></span>`).join('');
    if (step.prepare) step.prepare();
    const target = tourTarget(step);
    if (target) {
        // Bring the target near the top of the screen, leaving the lower part free for the card
        target.style.scrollMarginTop = '90px';
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        target.style.scrollMarginTop = '';
    }
    positionTour();
    document.getElementById('tourNext').focus();
}

function tourTarget(step) {
    if (!step.target) return null;
    return typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
}

// The faded, softly blurred scrim has a clear window over the highlighted area
function tourSetWindow(top, left, width, height) {
    const scrim = document.querySelector('.tour-scrim');
    if (!scrim) return;
    if (height <= 0) { scrim.style.clipPath = 'none'; return; }
    const l = left, r = left + width, tp = top, b = top + height;
    scrim.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}px ${tp}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${tp}px, ${l}px ${tp}px)`;
}

function positionTour() {
    if (!tourState) return;
    const step = tourState.steps[tourState.index];
    const spot = document.getElementById('tourSpot');
    const card = document.getElementById('tourCard');
    const target = tourTarget(step);
    const layer = document.getElementById('tourLayer');
    layer.classList.toggle('tour-nospot', !target);
    if (!target) {
        tourSetWindow(0, 0, 0, 0);
        spot.style.display = 'none';
        card.classList.remove('tour-top');
        card.classList.add('tour-center');
        return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(rect.top - pad, 6);
    const bottom = Math.min(rect.bottom + pad, window.innerHeight - 6);
    const left = Math.max(rect.left - pad, 6);
    const right = Math.min(rect.right + pad, window.innerWidth - 6);
    if (bottom <= top || right <= left) {
        tourSetWindow(0, 0, 0, 0);
        spot.style.display = 'none';
        layer.classList.add('tour-nospot');
    } else {
        spot.style.display = 'block';
        spot.style.top = `${top}px`;
        spot.style.left = `${left}px`;
        spot.style.width = `${right - left}px`;
        spot.style.height = `${bottom - top}px`;
    }
    card.classList.remove('tour-center');
    // Keep the card clear of the highlighted area: lower half of the target means card at the top
    const cardAtTop = (top + bottom) / 2 > window.innerHeight * 0.55;
    card.classList.toggle('tour-top', cardAtTop);
    // A tall target is highlighted only where the card is not covering it
    const cardRect = card.getBoundingClientRect();
    if (spot.style.display === 'block') {
        let spotTop = top, spotBottom = bottom;
        if (cardAtTop) spotTop = Math.max(top, cardRect.bottom + 8);
        else spotBottom = Math.min(bottom, cardRect.top - 8);
        if (spotBottom - spotTop < 30) {
            tourSetWindow(0, 0, 0, 0);
            spot.style.display = 'none';
            layer.classList.add('tour-nospot');
        } else {
            spot.style.top = `${spotTop}px`;
            spot.style.height = `${spotBottom - spotTop}px`;
            tourSetWindow(spotTop, left, right - left, spotBottom - spotTop);
        }
    }
}

function nextTourStep() {
    if (!tourState) return;
    if (tourState.index >= tourState.steps.length - 1) { endTour(true); return; }
    showTourStep(tourState.index + 1);
}

function prevTourStep() {
    if (!tourState || tourState.index === 0) return;
    showTourStep(tourState.index - 1);
}

function endTour(completed) {
    if (!tourState) return;
    if (completed === true && tourState.kind !== 'admin') { rememberTourAnswer('yes'); trackUsage('tour completed'); }
    const kind = tourState.kind;
    clearInterval(tourState.timer);
    tourState = null;
    window.removeEventListener('resize', positionTour);
    window.removeEventListener('scroll', positionTour, true);
    document.removeEventListener('keydown', tourKeys);
    document.body.classList.remove('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'true');
    leaveTourDemo();
    if (kind === 'admin') {
        // Finish on the admin menu, with the buttons showing
        const adminBtn = tourTabButton('adminHome');
        if (adminBtn) adminBtn.click();
        setAdminPanelCollapsed(false);
    } else {
        // Finish on the Match Summary, the usual home screen
        const summaryBtn = tourTabButton('summary');
        const summaryPanel = document.getElementById('summaryTab');
        if (summaryBtn && summaryPanel && summaryPanel.classList.contains('hidden')) summaryBtn.click();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    // Put the real data back on screen
    refreshSummaryData();
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
    if (!currentUsername || isGuest || isPdfExportMode || tourState || tourAlreadyAnswered()) return;
    const modal = document.getElementById('tourPromptModal');
    if (!modal) return;
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
