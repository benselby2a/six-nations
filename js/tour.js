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

function tourTabButton(name) {
    const btn = document.querySelector(`.tabs .tab[onclick*="'${name}'"]`);
    return btn && btn.offsetParent !== null ? btn : null;
}

function tourBuildSteps() {
    const steps = [];
    steps.push({
        title: 'Review the rules',
        html: () => `<p>Here is how points are won in ${selectedYear}.</p>${tourRulesHtml()}`
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
    if (fixtureChat.available) {
        steps.push({
            title: 'Comment on matches and results',
            tab: 'summary',
            target: '[data-chat-chip]',
            html: () => '<p>Tap the 💬 chip under a match to comment on it or react with an emoji.</p><p>Tap any prediction in the table to comment on that guess. Emoji and comment counts show right on the table, and everyone can see who reacted.</p>'
        });
    }
    steps.push({
        title: 'Stats and insights',
        tab: 'summary',
        target: () => { const el = document.getElementById('triesStatsContainer'); return el ? el.parentElement : null; },
        html: () => '<p>Under the table you will find Tournament Stats (tries so far and the projected total), the prize money as things stand, and a chart of how everyone\'s points have moved match by match.</p>'
    });
    return steps;
}

function startTour() {
    closeGlobalHelpModal();
    const steps = tourBuildSteps();
    tourState = { index: 0, steps, timer: null };
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
        const btn = tourTabButton(step.tab);
        const panelId = step.tab === 'summary' ? 'summaryTab' : 'predictionsTab';
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
    const target = tourTarget(step);
    if (target) {
        const tall = target.getBoundingClientRect().height > window.innerHeight * 0.55;
        target.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'auto' });
    }
    positionTour();
    document.getElementById('tourNext').focus();
}

function tourTarget(step) {
    if (!step.target) return null;
    return typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
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
            spot.style.display = 'none';
            layer.classList.add('tour-nospot');
        } else {
            spot.style.top = `${spotTop}px`;
            spot.style.height = `${spotBottom - spotTop}px`;
        }
    }
}

function nextTourStep() {
    if (!tourState) return;
    if (tourState.index >= tourState.steps.length - 1) { endTour(); return; }
    showTourStep(tourState.index + 1);
}

function prevTourStep() {
    if (!tourState || tourState.index === 0) return;
    showTourStep(tourState.index - 1);
}

function endTour() {
    if (!tourState) return;
    clearInterval(tourState.timer);
    tourState = null;
    window.removeEventListener('resize', positionTour);
    window.removeEventListener('scroll', positionTour, true);
    document.removeEventListener('keydown', tourKeys);
    document.body.classList.remove('tour-open');
    document.getElementById('tourLayer').setAttribute('aria-hidden', 'true');
    // Finish on the Match Summary, the usual home screen
    const summaryBtn = tourTabButton('summary');
    const summaryPanel = document.getElementById('summaryTab');
    if (summaryBtn && summaryPanel && summaryPanel.classList.contains('hidden')) summaryBtn.click();
    window.scrollTo({ top: 0, behavior: 'auto' });
}
