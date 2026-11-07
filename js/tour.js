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

function tourBuildSteps(rulesHtml, chatLive) {
    const steps = [];
    steps.push({ id: null, title: 'Review the rules', raw: () => `<p>Here is how points are won in ${selectedYear}.</p>${rulesHtml}` });
    steps.push(tourStep('predictions', 'Add your predictions', [
        'Tap <strong>My Predictions</strong> at the top of the screen.',
        'Tap <strong>Edit</strong> next to a match to enter your prediction.'
    ], isGuest
        ? '<p>Sign in to enter your own predictions.</p>'
        : '<p>The checklist at the top shows what is still missing. Under the matches you can also guess the total tries and press Save Tournament Tries. Predictions lock when the tournament starts, so get them in early.</p>'));
    steps.push(tourStep('predict-edit', 'Enter a score', [
        'Enter the score you expect for each team.',
        'On a Joker eligible match, tick <strong>Use Joker</strong> to double the points for that match.',
        'Tap <strong>Save</strong>.'
    ], '<p>Leave both scores blank to clear a prediction.</p>'));
    steps.push(tourStep('score', 'See the current score', [
        'Tap <strong>Match Summary</strong> at the top of the screen. It is the screen you land on after signing in.',
        'Everyone\'s rank and total score are on the left, with each prediction and the points it earned for every match.'
    ], '<p>Hover or tap a prediction to see how it was scored. Use Refresh to pull the latest results.</p>'));
    steps.push(tourStep('pdf', 'The traditional view', [
        'On the Match Summary, tap <strong>Export PDF Summary</strong>.'
    ], '<p>If you want the traditional view, open the PDF Summary. It lays the table out on a page you can read at a glance, save or print.</p>'));
    if (chatLive) {
        steps.push(tourStep('chips', 'Comment on matches and results', [
            'Tap the <strong>💬 chip</strong> under a match to comment on the match or react with an emoji.',
            'Or tap any <strong>prediction</strong> to comment on that guess.'
        ], '<p>Emoji and comment counts show right on the table.</p>'));
        steps.push(tourStep('sheet', 'Join the conversation', [
            'Pick an emoji to react. Tap it again to take it back.',
            'Type a comment (up to 140 characters) and tap <strong>Post</strong>.',
            'Switch between the prediction and the match chat here.'
        ], '<p>You can see who reacted with each emoji. You can delete your own comments.</p>'));
    }
    steps.push(tourStep('stats', 'Stats and insights', [
        'Scroll down on the Match Summary, under the table.',
        'Tournament Stats show tries so far and the projected total.',
        'Prize Money shows what each place wins as things stand.'
    ], '<p>Below that, a chart shows how everyone\'s points have moved match by match.</p>'));
    if (tourCanAddToHomeScreen()) {
        steps.push({ id: null, title: 'Add it to your Home Screen', raw: () => '<p>For one-tap access, add the Six Nations Guesser to your iPhone Home Screen.</p><p>Tap the <strong>Share</strong> button <svg class="tour-share-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> in your browser, then choose <strong>Add to Home Screen</strong>. Open it from there and sign in with a code.</p>' });
    }
    return steps;
}

function tourBuildAdminSteps() {
    return [
        tourStep('admin-menu', 'Your admin menu', [
            'Tap <strong>Admin Functions</strong> at the top of the screen.',
            'Each button opens a section. The menu tucks itself away to leave room: tap Admin Functions again to bring it back.'
        ], '<p>A readiness checklist appears under the buttons while a new year still has things to set up.</p>'),
        tourStep('admin-fixtures', 'Fixtures and Scores', [
            'Admin Functions, then <strong>Fixtures and Scores</strong>.',
            'Tap a row to edit a fixture, set it Joker eligible, or enter the result and tries.'
        ], '<p>Add New Fixture adds one match and Bulk Import pastes in a whole round. <strong>Add Next Score</strong> at the top of the page is the quick way to enter a result.</p>'),
        tourStep('admin-lock', 'Predictions and the lock', [
            'Admin Functions, then <strong>Predictions</strong>.',
            'Switch on <strong>Lock Predictions</strong> when the tournament starts. Each year has its own lock.',
            'Pick a competitor to review or correct their predictions, Jokers and tries guess.'
        ]),
        tourStep('admin-competitors', 'Competitors', [
            'Admin Functions, then <strong>Competitors</strong>.',
            'To add someone, enter their email in <strong>+ Add a competitor</strong>. They sign in with an emailed code and fill in their own name and teams.',
            'Each card lets you change a name, email (two per person are allowed), teams, whether they are playing this year, and admin access.'
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

function startTour(kind) {
    if (kind !== 'admin') kind = 'app';
    if (kind === 'admin' && !isCurrentUserAdmin()) return;
    closeGlobalHelpModal();
    closeAdminHelpModal();
    const steps = kind === 'admin' ? tourBuildAdminSteps() : tourBuildSteps(tourRulesHtml(), fixtureChat.available);
    tourState = { index: 0, steps, kind };
    document.body.classList.add('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'false');
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
    return `<div class="tour-figure"><div class="tour-figure-inner"><img src="${image.src}?v=${image.v}" alt="" width="${image.w}" height="${image.h}">${marks}</div></div>`;
}

function showTourStep(index) {
    if (!tourState) return;
    const step = tourState.steps[index];
    tourState.index = index;
    const total = tourState.steps.length;
    document.getElementById('tourCount').textContent = `${index + 1} of ${total}`;
    document.getElementById('tourTitle').textContent = step.title;
    const text = step.raw
        ? step.raw()
        : `<ol class="tour-items">${step.items.map(i => `<li>${i}</li>`).join('')}</ol>${step.extra}`;
    document.getElementById('tourBody').innerHTML = (step.id ? tourFigureHtml(step.id) : '') + text;
    document.getElementById('tourBody').scrollTop = 0;
    document.getElementById('tourBack').disabled = index === 0;
    document.getElementById('tourNext').textContent = index === total - 1 ? 'Done' : 'Next';
    document.getElementById('tourDots').innerHTML = tourState.steps.map((_, i) => `<span class="tour-dot ${i === index ? 'on' : ''}"></span>`).join('');
    document.getElementById('tourNext').focus();
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
    if (completed === true) {
        if (tourState.kind === 'admin') rememberAdminTourAnswer('yes'); else rememberTourAnswer('yes');
        trackUsage(tourState.kind === 'admin' ? 'admin tour completed' : 'tour completed');
    }
    tourState = null;
    document.removeEventListener('keydown', tourKeys);
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

// ---- The first time an admin opens the admin panel: offer the admin tour (same rules as the competitor tour) ----
const ADMIN_TOUR_ANSWERED_KEY_PREFIX = 'adminTourAnswered:';

function adminTourAnswerKey() {
    return ADMIN_TOUR_ANSWERED_KEY_PREFIX + (currentUsername || '');
}

function rememberAdminTourAnswer(answer) {
    try { localStorage.setItem(adminTourAnswerKey(), answer); } catch (error) { /* ignore */ }
}

function maybeOfferAdminTour() {
    if (!currentUsername || isGuest || tourState || tourSuppressOffer || !isCurrentUserAdmin()) return;
    try { if (localStorage.getItem(adminTourAnswerKey())) return; } catch (error) { return; }   // no storage: do not nag
    const modal = document.getElementById('adminTourPromptModal');
    if (!modal) return;
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
