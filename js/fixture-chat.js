// Match Summary pop-up: tap a match header for the match's facts, or a prediction for how it was scored (and a point on the Points
// Progression chart for that player's game). (Emoji reactions were removed; the file keeps its old name.)
// Classic script (shared global scope); load order is set in js/load-order.txt.

let fixtureChatSelection = null;   // { matchId, username (or null for the match itself), tab: 'pred' | 'match' }

function chatDisplayName(username) {
    return username ? toTitleCase((users[username] && users[username].nickname) || username) : '';
}

// A match header can be tapped or clicked anywhere to open that match's details
function chatHeaderAttrs(match) {
    return ` tabindex="0" role="button" aria-label="${escapeHtml(`Details for ${match.team1} v ${match.team2}`)}"`;
}

function chatCellAttrs(username, matchId) {
    return ` data-chat-match="${matchId}" data-chat-user="${escapeHtml(username)}" tabindex="0" role="button" aria-label="${escapeHtml(chatDisplayName(username))}'s prediction: see how it was scored"`;
}

function highlightChatSelection() {
    document.querySelectorAll('.chat-selected, .chat-picked').forEach(el => el.classList.remove('chat-selected', 'chat-picked'));
    if (!fixtureChatSelection) return;
    if (fixtureChatSelection.kind === 'worm') return;
    const { matchId, username } = fixtureChatSelection;
    document.querySelectorAll(`[data-chat-match="${matchId}"]`).forEach(el => el.classList.add('chat-selected'));
    if (username) {
        document.querySelectorAll(`td[data-chat-match="${matchId}"]`).forEach(el => { if (el.dataset.chatUser === username) el.classList.add('chat-picked'); });
    }
}

function openFixtureChat(matchId, username, opener) {
    fixtureChatSelection = { matchId, username: username || null, tab: username ? 'pred' : 'match', opener: opener || null };
    document.body.classList.add('fixture-chat-open');
    document.getElementById('fixtureChatSheet').setAttribute('aria-hidden', 'false');
    renderFixtureChat();
    highlightChatSelection();
    const close = document.getElementById('fixtureChatClose');
    if (close) close.focus();
}

function closeFixtureChat() {
    if (!fixtureChatSelection) return;
    const opener = fixtureChatSelection.opener;
    fixtureChatSelection = null;
    document.body.classList.remove('fixture-chat-open');
    document.getElementById('fixtureChatSheet').setAttribute('aria-hidden', 'true');
    highlightChatSelection();
    if (opener && document.body.contains(opener)) opener.focus();
}

// A point on the Points Progression chart: the same pop-up, with that player's game
function openWormPointDetail(point) {
    if (!point) return;
    fixtureChatSelection = { kind: 'worm', matchId: null, username: null, tab: 'worm', opener: null, data: { ...point.dataset } };
    document.body.classList.add('fixture-chat-open');
    document.getElementById('fixtureChatSheet').setAttribute('aria-hidden', 'false');
    renderFixtureChat();
    const close = document.getElementById('fixtureChatClose');
    if (close) close.focus();
}

function renderWormPointDetail(sel) {
    const d = sel.data || {};
    document.getElementById('fixtureChatTitle').textContent = d.playerName || '';
    document.getElementById('fixtureChatSub').textContent = d.match || '';
    document.getElementById('fixtureChatTabs').innerHTML = '';
    let lines = `<dt>Result</dt><dd>${escapeHtml(d.result || '')}</dd>`;
    lines += `<dt>Prediction</dt><dd>${escapeHtml(d.prediction || '')}</dd>`;
    lines += `<dt>This game</dt><dd><strong>${escapeHtml(d.pointsGame || '0')} pts</strong></dd>`;
    lines += `<dt>Total</dt><dd><strong>${escapeHtml(d.total || '0')} pts</strong></dd>`;
    document.getElementById('fixtureChatBody').innerHTML = `<div class="fc-pred-card"><dl class="fc-pred-lines">${lines}</dl></div>`;
}

function renderFixtureChat() {
    const sel = fixtureChatSelection;
    if (!sel) return;
    if (sel.kind === 'worm') { renderWormPointDetail(sel); return; }
    const match = matches.find(m => m.id === sel.matchId);
    if (!match) { closeFixtureChat(); return; }
    const isPred = sel.tab === 'pred' && sel.username;

    document.getElementById('fixtureChatTitle').textContent = isPred ? `${chatDisplayName(sel.username)}'s prediction` : `${match.team1} v ${match.team2}`;
    document.getElementById('fixtureChatSub').textContent = isPred
        ? `${match.team1} v ${match.team2} · ${match.date}`
        : `${match.date} · ${match.time}` + (match.actualScore1 !== null && match.actualScore2 !== null ? ` · Final ${match.actualScore1}-${match.actualScore2}` : ' · Not played yet');

    document.getElementById('fixtureChatTabs').innerHTML = '';

    let predCard = '';
    if (isPred) {
        const pred = users[sel.username] && users[sel.username].predictions[match.id];
        if (pred) {
            const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
            const joker = isUserJokerForMatch(sel.username, match.id);
            const breakdown = hasResult ? getMatchPointsBreakdown(pred, match, joker) : null;
            let lines = `<div class="fc-pred-score">${getFlag(match.team1)} ${pred.team1} - ${pred.team2} ${getFlag(match.team2)}</div><dl class="fc-pred-lines">`;
            lines += `<dt>Result</dt><dd>${hasResult ? `${match.actualScore1} - ${match.actualScore2}` : 'Not played yet'}</dd>`;
            if (breakdown) {
                lines += `<dt>Points</dt><dd>${breakdown.summary ? escapeHtml(breakdown.summary) : 'Wrong result (0)'}</dd>`;
                lines += `<dt>Total</dt><dd><strong>${breakdown.points} pts</strong></dd>`;
            }
            if (joker) lines += `<dt>Joker</dt><dd>🃏 Points are doubled</dd>`;
            predCard = `<div class="fc-pred-card">${lines}</dl></div>`;
        }
    }

    // Tapping a match header (not a prediction): the match's facts above the reactions
    let matchCard = '';
    if (!isPred) {
        const played = match.actualScore1 !== null && match.actualScore2 !== null;
        const triesIn = match.actualTries1 !== null && match.actualTries2 !== null;
        let lines = `<dt>Result</dt><dd>${played ? `${getFlag(match.team1)} ${match.actualScore1} - ${match.actualScore2} ${getFlag(match.team2)}` : 'Not played yet'}</dd>`;
        lines += `<dt>Total tries</dt><dd>${triesIn ? `<strong>${match.actualTries1 + match.actualTries2}</strong> (${getTeamAbbr(match.team1)} ${match.actualTries1}, ${getTeamAbbr(match.team2)} ${match.actualTries2})` : 'Not entered yet'}</dd>`;
        lines += `<dt>Joker</dt><dd>${match.jokerEligible ? '🃏 Joker eligible: points are doubled for anyone who plays their Joker here' : 'Not a Joker match'}</dd>`;
        matchCard = `<div class="fc-pred-card"><dl class="fc-pred-lines">${lines}</dl></div>`;
    }

    document.getElementById('fixtureChatBody').innerHTML = `${predCard}${matchCard}`;
}

// Tapping a prediction or a match header opens the pop-up
(function bindFixtureChatEvents() {
    const container = document.getElementById('summaryContainer');
    if (container) {
        container.addEventListener('click', (event) => {
            const cell = event.target.closest('td[data-chat-user]');
            if (cell) { openFixtureChat(Number(cell.dataset.chatMatch), cell.dataset.chatUser, cell); return; }
            const head = event.target.closest('th[data-chat-match]');
            if (head) openFixtureChat(Number(head.dataset.chatMatch), null, head);
        });
        container.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const cell = event.target.closest('td[data-chat-user]');
            if (cell && event.target === cell) { event.preventDefault(); openFixtureChat(Number(cell.dataset.chatMatch), cell.dataset.chatUser, cell); return; }
            const head = event.target.closest('th[data-chat-match]');
            if (head && event.target === head) { event.preventDefault(); openFixtureChat(Number(head.dataset.chatMatch), null, head); }
        });
    }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && fixtureChatSelection) closeFixtureChat(); });
})();
