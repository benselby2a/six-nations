// Match Summary chat: comments and emoji reactions on a fixture (column header) or on one competitor's prediction (cell)
// Classic script (shared global scope); load order is set in index.html.

let fixtureChat = { available: false, comments: [], reactions: [] };   // filled by loadYearData; unavailable until fixture_chat_migration.sql is run
let fixtureChatSelection = null;   // { matchId, username (or null for match chat), tab: 'pred' | 'match' }
let fixtureChatBusy = false;
const FIXTURE_CHAT_EMOJIS = ['🔥', '😂', '😱', '👏', '😭', '🏉'];
const FIXTURE_CHAT_MAX = 140;

function chatUsernameById(id) {
    return Object.keys(users).find(u => users[u].id === id) || null;
}

function chatDisplayName(username) {
    return username ? toTitleCase((users[username] && users[username].nickname) || username) : '';
}

// One thread: comments (oldest first) and reactions grouped by emoji for a match (username null) or one prediction
function chatThread(matchId, username) {
    const targetId = username ? (users[username] && users[username].id) : null;
    const same = (row) => row.match_id === matchId && (row.target_user_id || null) === (targetId || null);
    const comments = fixtureChat.comments.filter(same).map(c => ({ id: c.id, username: chatUsernameById(c.user_id), body: c.body, createdAt: c.created_at }));
    const reactions = {};
    fixtureChat.reactions.filter(same).forEach(r => {
        const name = chatUsernameById(r.user_id);
        if (!name) return;
        (reactions[r.emoji] = reactions[r.emoji] || []).push({ username: name, id: r.id });
    });
    return { comments, reactions };
}

function chatTopEmoji(reactions) {
    return Object.entries(reactions).filter(([, who]) => who.length).sort((a, b) => b[1].length - a[1].length).slice(0, 2).map(([e]) => e).join('');
}

function chatChipInner(matchId) {
    const thread = chatThread(matchId, null);
    const top = chatTopEmoji(thread.reactions);
    return `${top ? `<span aria-hidden="true">${top}</span>` : ''}💬 ${thread.comments.length}`;
}

function chatChipHasActivity(matchId) {
    const thread = chatThread(matchId, null);
    return thread.comments.length > 0 || Object.keys(thread.reactions).length > 0;
}

// Markup used by the Match Summary table
function chatChipMarkup(matchId) {
    if (!fixtureChat.available) return '';
    const match = matches.find(m => m.id === matchId);
    const label = match ? `Chat about ${match.team1} v ${match.team2}` : 'Chat about this match';
    return `<button type="button" class="chat-chip ${chatChipHasActivity(matchId) ? 'has-activity' : ''}" data-chat-chip="${matchId}" aria-label="${escapeHtml(label)}" onclick="openFixtureChat(${matchId}, null, this)">${chatChipInner(matchId)}</button>`;
}

function chatCellAttrs(username, matchId) {
    if (!fixtureChat.available) return '';
    return ` data-chat-match="${matchId}" data-chat-user="${escapeHtml(username)}" tabindex="0" role="button" aria-label="${escapeHtml(chatDisplayName(username))}'s prediction: open chat"`;
}

function chatCellBadge(username, matchId) {
    if (!fixtureChat.available) return '';
    const count = chatThread(matchId, username).comments.length;
    return count ? `<span class="chat-badge" data-chat-badge aria-hidden="true">💬${count}</span>` : '';
}

// Update chips and badges in place (no table re-render, so the scroll position is kept)
function refreshChatIndicators() {
    document.querySelectorAll('[data-chat-chip]').forEach(chip => {
        const id = Number(chip.dataset.chatChip);
        chip.innerHTML = chatChipInner(id);
        chip.classList.toggle('has-activity', chatChipHasActivity(id));
    });
    document.querySelectorAll('td[data-chat-user]').forEach(cell => {
        const old = cell.querySelector('[data-chat-badge]');
        if (old) old.remove();
        const count = chatThread(Number(cell.dataset.chatMatch), cell.dataset.chatUser).comments.length;
        if (count) cell.insertAdjacentHTML('beforeend', `<span class="chat-badge" data-chat-badge aria-hidden="true">💬${count}</span>`);
    });
}

function chatTimeAgo(iso) {
    const then = iso ? new Date(iso).getTime() : Date.now();
    if (Number.isNaN(then)) return '';
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
}

function chatCanPost() {
    return !!currentUsername && !isGuest && !!(users[currentUsername] && users[currentUsername].id);
}

function highlightChatSelection() {
    document.querySelectorAll('.chat-selected, .chat-picked').forEach(el => el.classList.remove('chat-selected', 'chat-picked'));
    if (!fixtureChatSelection) return;
    const { matchId, username } = fixtureChatSelection;
    document.querySelectorAll(`[data-chat-match="${matchId}"]`).forEach(el => el.classList.add('chat-selected'));
    if (username) {
        document.querySelectorAll(`td[data-chat-match="${matchId}"]`).forEach(el => { if (el.dataset.chatUser === username) el.classList.add('chat-picked'); });
    }
}

function openFixtureChat(matchId, username, opener) {
    if (!fixtureChat.available) return;
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

function switchFixtureChatTab(tab) {
    if (!fixtureChatSelection) return;
    fixtureChatSelection.tab = tab;
    renderFixtureChat();
}

function renderFixtureChat() {
    const sel = fixtureChatSelection;
    if (!sel) return;
    const match = matches.find(m => m.id === sel.matchId);
    if (!match) { closeFixtureChat(); return; }
    const isPred = sel.tab === 'pred' && sel.username;
    const thread = chatThread(match.id, isPred ? sel.username : null);
    const canPost = chatCanPost();
    const admin = isCurrentUserAdmin();

    document.getElementById('fixtureChatTitle').textContent = isPred ? `${chatDisplayName(sel.username)}'s prediction` : `${match.team1} v ${match.team2}`;
    document.getElementById('fixtureChatSub').textContent = isPred
        ? `${match.team1} v ${match.team2} · ${match.date}`
        : `${match.date} · ${match.time}` + (match.actualScore1 !== null && match.actualScore2 !== null ? ` · Final ${match.actualScore1}-${match.actualScore2}` : ' · Not played yet');

    const predCount = sel.username ? chatThread(match.id, sel.username).comments.length : 0;
    const matchCount = chatThread(match.id, null).comments.length;
    document.getElementById('fixtureChatTabs').innerHTML = sel.username ? `
        <div class="fc-tabs" role="tablist">
            <button type="button" class="fc-tab" role="tab" aria-selected="${isPred ? 'true' : 'false'}" onclick="switchFixtureChatTab('pred')">${escapeHtml(chatDisplayName(sel.username))}'s prediction${predCount ? ` 💬${predCount}` : ''}</button>
            <button type="button" class="fc-tab" role="tab" aria-selected="${isPred ? 'false' : 'true'}" onclick="switchFixtureChatTab('match')">Match chat${matchCount ? ` 💬${matchCount}` : ''}</button>
        </div>` : '';

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

    const reactButtons = FIXTURE_CHAT_EMOJIS.map(emoji => {
        const who = thread.reactions[emoji] || [];
        const mine = who.some(w => w.username === currentUsername);
        const names = who.map(w => w.username === currentUsername ? 'You' : chatDisplayName(w.username)).join(', ');
        return `<button type="button" class="fc-emoji" ${canPost ? '' : 'disabled'} aria-pressed="${mine}" title="${escapeHtml(names || 'No reactions yet')}" aria-label="${emoji} ${who.length}${names ? ': ' + escapeHtml(names) : ''}" onclick="toggleFixtureReaction('${emoji}')">${emoji}${who.length ? `<small>${who.length}</small>` : ''}</button>`;
    }).join('');

    const whoRows = FIXTURE_CHAT_EMOJIS.filter(e => (thread.reactions[e] || []).length).map(emoji =>
        `<li><span aria-hidden="true">${emoji}</span><span>${thread.reactions[emoji].map(w => w.username === currentUsername ? '<span class="fc-you">You</span>' : escapeHtml(chatDisplayName(w.username))).join(', ')}</span></li>`);

    const commentRows = thread.comments.length ? thread.comments.map(c => {
        const mineOrAdmin = c.username === currentUsername || admin;
        const name = c.username ? chatDisplayName(c.username) : 'Someone';
        return `<li class="fc-comment"><div><div class="fc-comment-name">${escapeHtml(name)}<time>${chatTimeAgo(c.createdAt)}</time></div><p class="fc-comment-text">${escapeHtml(c.body)}</p></div>${mineOrAdmin && canPost ? `<button type="button" class="fc-delete" onclick="deleteFixtureComment(${c.id})">Delete</button>` : ''}</li>`;
    }).join('') : `<li><p class="fc-empty">${isPred ? 'Nothing said about this prediction yet.' : 'No comments yet. Be the first to have a say.'}</p></li>`;

    const compose = canPost ? `
        <form class="fc-compose" onsubmit="postFixtureComment(event)">
            <textarea id="fixtureChatInput" maxlength="${FIXTURE_CHAT_MAX}" placeholder="${isPred ? `Say something about ${escapeHtml(chatDisplayName(sel.username))}'s pick…` : 'Say something about this match…'}" aria-label="Comment" oninput="onFixtureChatInput()"></textarea>
            <div class="fc-compose-row"><span class="fc-counter" id="fixtureChatCounter">0 / ${FIXTURE_CHAT_MAX}</span><button type="submit" id="fixtureChatPost" disabled>Post</button></div>
        </form>` : '<p class="fc-guest-note">Sign in to react or comment. Guests can read the thread.</p>';

    const draft = (document.getElementById('fixtureChatInput') || {}).value || '';
    document.getElementById('fixtureChatBody').innerHTML = `${predCard}
        <div class="fc-reacts" role="group" aria-label="Reactions">${reactButtons}</div>
        ${whoRows.length ? `<div><p class="fc-who-title">Who reacted</p><ul class="fc-who">${whoRows.join('')}</ul></div>` : ''}
        <ul class="fc-thread">${commentRows}</ul>
        ${compose}`;
    const input = document.getElementById('fixtureChatInput');
    if (input && draft) { input.value = draft; onFixtureChatInput(); }
}

function onFixtureChatInput() {
    const input = document.getElementById('fixtureChatInput');
    if (!input) return;
    document.getElementById('fixtureChatCounter').textContent = `${input.value.length} / ${FIXTURE_CHAT_MAX}`;
    document.getElementById('fixtureChatPost').disabled = !input.value.trim();
}

async function reloadFixtureChat() {
    fixtureChat = await Storage.getFixtureChat(matches.map(m => m.id));
    refreshChatIndicators();
    renderFixtureChat();
}

async function postFixtureComment(event) {
    event.preventDefault();
    if (fixtureChatBusy || !fixtureChatSelection || !chatCanPost()) return;
    const input = document.getElementById('fixtureChatInput');
    const body = input.value.trim();
    if (!body) return;
    const sel = fixtureChatSelection;
    const isPred = sel.tab === 'pred' && sel.username;
    fixtureChatBusy = true;
    try {
        const error = await Storage.addFixtureComment({
            match_id: sel.matchId,
            user_id: users[currentUsername].id,
            target_user_id: isPred ? users[sel.username].id : null,
            body: body.slice(0, FIXTURE_CHAT_MAX)
        });
        if (error) {
            alert('Could not post your comment: ' + (error.message || 'unknown error'));
            return;
        }
        input.value = '';
        trackUsage('fixture comment', formatUsagePayload({ match: sel.matchId, about: isPred ? sel.username : null }));
        await reloadFixtureChat();
    } finally {
        fixtureChatBusy = false;
    }
}

async function deleteFixtureComment(id) {
    if (fixtureChatBusy) return;
    if (!confirm('Delete this comment?')) return;
    fixtureChatBusy = true;
    try {
        const error = await Storage.deleteFixtureComment(id);
        if (error) {
            alert('Could not delete the comment: ' + (error.message || 'unknown error'));
            return;
        }
        trackUsage('delete fixture comment', formatUsagePayload({ id }));
        await reloadFixtureChat();
    } finally {
        fixtureChatBusy = false;
    }
}

async function toggleFixtureReaction(emoji) {
    if (fixtureChatBusy || !fixtureChatSelection || !chatCanPost()) return;
    const sel = fixtureChatSelection;
    const isPred = sel.tab === 'pred' && sel.username;
    const thread = chatThread(sel.matchId, isPred ? sel.username : null);
    const mine = (thread.reactions[emoji] || []).find(w => w.username === currentUsername);
    fixtureChatBusy = true;
    try {
        const error = mine
            ? await Storage.deleteFixtureReaction(mine.id)
            : await Storage.addFixtureReaction({ match_id: sel.matchId, user_id: users[currentUsername].id, target_user_id: isPred ? users[sel.username].id : null, emoji });
        if (error) {
            alert('Could not save your reaction: ' + (error.message || 'unknown error'));
            return;
        }
        await reloadFixtureChat();
    } finally {
        fixtureChatBusy = false;
    }
}

// Tapping a prediction opens its chat; the fixture header chip has its own button
(function bindFixtureChatEvents() {
    const container = document.getElementById('summaryContainer');
    if (container) {
        container.addEventListener('click', (event) => {
            const cell = event.target.closest('td[data-chat-user]');
            if (cell) openFixtureChat(Number(cell.dataset.chatMatch), cell.dataset.chatUser, cell);
        });
        container.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const cell = event.target.closest('td[data-chat-user]');
            if (cell && event.target === cell) { event.preventDefault(); openFixtureChat(Number(cell.dataset.chatMatch), cell.dataset.chatUser, cell); }
        });
    }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && fixtureChatSelection) closeFixtureChat(); });
})();
