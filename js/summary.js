// Summary screen
// Classic script (shared global scope); load order is set in index.html.

        // Show comprehensive summary with matches as columns
        // What the summary shows depends on all of this; if none of it changed since the last render, a refresh need not redraw it
        let lastSummarySignature = null;
        function summarySignature() {
            try {
                return JSON.stringify([selectedYear, matches, users, appSettings, userJokerSelections, fixtureChat, activeScoringRules, currentFilter, selectedRound, currentUsername, isGuest, summaryViewMode]);
            } catch (e) { return null; }
        }
        function showSummary() {
            renderSummaryNow();
            lastSummarySignature = summarySignature();
        }
        // Redraw only when something changed (no flicker, no lost scroll position on a refresh that found nothing new)
        function showSummaryIfChanged() {
            const sig = summarySignature();
            if (sig !== null && sig === lastSummarySignature && document.querySelector('#summaryContainer .summary-table, #summaryContainer .signed-up-panel')) return false;
            showSummary();
            return true;
        }

        function renderSummaryNow() {
            const container = document.getElementById('summaryContainer');
            const allUsers = getParticipantUsernames();

            // Until predictions lock (or a result is in) nobody's guesses are shown, so the summary is just who has signed up
            if (!predictionsRevealed()) {
                const names = getActiveUsernames().map(u => ({ username: u, name: getDisplayName(u) }))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                const list = names.length
                    ? `<ul class="signed-up-list">${names.map(n => `<li>${escapeHtml(n.name)}${n.username === currentUsername ? ' <span class="signed-up-you">(you)</span>' : ''}</li>`).join('')}</ul>`
                    : '<p class="signed-up-empty">Nobody has signed up for this year yet.</p>';
                container.innerHTML = `<div class="signed-up-panel"><h3>Signed up for ${selectedYear}${names.length ? ` (${names.length})` : ''}</h3><p class="signed-up-note">🔒 Predictions will be revealed after all guesses are in.</p>${list}</div>`;
                renderPrizeMoneyPanel([]);
                renderWormChart([]);
                updateLeaderboard();
                return;
            }

            if (matches.length === 0 || allUsers.length === 0) {
                const emptyMessage = matches.length === 0
                    ? `Predictions will be revealed after all guesses are in.`
                    : `No competitors have made predictions for ${selectedYear} yet.`;
                container.innerHTML = `<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">${emptyMessage}</p>`;
                renderPrizeMoneyPanel([]);
                renderWormChart([]);
                updateLeaderboard();
                return;
            }

            const filteredMatches = getFilteredMatches();
            
            if (filteredMatches.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No matches match the current filter.</p>';
                const sortedUsersForPrizeOnly = allUsers
                    .map(username => ({
                        username: username,
                        nickname: toTitleCase(users[username].nickname || username),
                        totalPoints: calculatePoints(username)
                    }))
                    .sort((a, b) => b.totalPoints - a.totalPoints);
                renderPrizeMoneyPanel(sortedUsersForPrizeOnly);
                renderWormChart(sortedUsersForPrizeOnly);
                updateLeaderboard();
                return;
            }

            // PDF view: the same table, drawn like the PDF export
            if (summaryViewMode === 'pdf') {
                const sortedForPdf = pdfvSortedUsers();
                container.innerHTML = buildPdfStyleViewHtml(filteredMatches, sortedForPdf);
                fitPdfView();
                renderPrizeMoneyPanel(sortedForPdf);
                renderWormChart(sortedForPdf);
                updateLeaderboard();
                return;
            }

            // Calculate total actual tries so far
            const totalActualTries = getTotalActualTries();
            const completedMatches = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatches = matches.length;

            const isNarrowScreen = window.innerWidth <= 768;
            let scrollHintText;
            if (currentFilter === 'default') {
                scrollHintText = isNarrowScreen
                    ? 'Scroll left and right to see all matches. On phone, rotate to landscape for the best view.'
                    : 'Scroll left and right to see all matches';
            } else {
                scrollHintText = isNarrowScreen
                    ? 'Scroll right to see full table. On phone, rotate to landscape for the best view.'
                    : 'Scroll right to see full table';
            }
            const scrollHintArrow = currentFilter === 'default' ? '↔' : '→';
            const scrollHintMarkup = `<div class="scroll-hint hidden" id="scrollHint"><span>${scrollHintText}</span><span class="scroll-hint-arrow">${scrollHintArrow}</span></div>`;

            let html = predictionsRevealed() ? '' : '<div class="predictions-hidden-note" role="status">🔒 Other players\' predictions are hidden until predictions are locked, so nobody is influenced by them. You can still see your own.</div>';
            html += scrollHintMarkup;
            html += '<div class="summary-table-wrap"><div class="summary-sticky-zone"><div class="summary-sticky-head"><div class="summary-sticky-inner"></div></div></div>';
            html += '<div class="summary-container">';
            html += '<table class="summary-table">';
            
            // Header row: Rank | Competitor | Score | Match 1 | Match 2 | ... | Predicted Tries
            html += '<thead><tr>';
            html += '<th class="rank-col">#</th>';
            html += '<th class="competitor-col"><span class="th-angled">Competitor</span></th>';
            html += '<th class="pts-col"><span class="th-angled">Score</span></th>';
            filteredMatches.forEach((match, colIndex) => {
                const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                const hasTries = match.actualTries1 !== null && match.actualTries2 !== null;
                const totalMatchTries = hasTries ? match.actualTries1 + match.actualTries2 : null;
                html += `<th class="match-header-cell ${match.jokerEligible ? 'joker-eligible-header' : ''}" data-match-col="${colIndex}" data-chat-match="${match.id}"${chatHeaderAttrs(match)}>
                    <div class="match-header-cell-inner">
                        <div class="match-header-top">
                            <div class="match-teams"><span>${getFlag(match.team1)} ${getTeamAbbr(match.team1)}</span><span>${getFlag(match.team2)} ${getTeamAbbr(match.team2)}</span></div>
                            <div class="match-date">${match.date} - ${match.time}</div>
                        </div>
                        <div class="match-header-bottom">
                            <div class="match-result-row">${hasResult ? `<div class="match-result">${match.actualScore1} - ${match.actualScore2}</div>` : '<div class="no-result">-</div>'}${match.jokerEligible ? '<span class="joker-inline" aria-hidden="true">🃏</span>' : ''}</div>
                            <div class="match-tries${hasTries ? '' : ' match-tries-empty'}">${hasTries ? `(${totalMatchTries} tries)` : '&nbsp;'}</div>
                            <div class="match-extras">${match.jokerEligible ? '<span class="joker-indicator joker-eligible-icon" title="Joker eligible" role="img" aria-label="Joker eligible">🃏</span>' : ''}${chatChipMarkup(match.id)}</div>
                        </div>
                    </div>
                </th>`;
            });
            // Only show Tries column when not filtering by round
            if (currentFilter !== 'round') {
                html += '<th class="tries-col">Predicted Tries</th>';
            }
            html += '</tr></thead>';
            
            html += '<tbody>';
            
            // Sort competitors by total points
            const sortedUsers = allUsers
                .map(username => ({
                    username: username,
                    nickname: toTitleCase(users[username].nickname || username),
                    totalPoints: calculatePoints(username)
                }))
                .sort((a, b) => b.totalPoints - a.totalPoints);
            
            // Row for each competitor
            sortedUsers.forEach((user, index) => {
                // Calculate rank (handle ties)
                let rank = index + 1;
                if (index > 0 && sortedUsers[index - 1].totalPoints === user.totalPoints) {
                    // Same points as previous user, find the first user with this score
                    for (let i = index - 1; i >= 0; i--) {
                        if (sortedUsers[i].totalPoints === user.totalPoints) {
                            rank = i + 1;
                        } else {
                            break;
                        }
                    }
                }
                
                // Check if this is the current logged in user
                const isCurrentUser = user.username === currentUsername;
                const rowClass = isCurrentUser ? 'current-user-row' : '';
                
                html += `<tr class="${rowClass}" data-player="${escapeHtml(user.username)}">`;
                html += `<td class="rank-col">${rank}</td>`;
                html += `<td class="competitor-name"><div class="comp-name"><span class="comp-nick">${user.nickname}</span>${getUserFlags(user.username)}</div></td>`;
                html += `<td class="pts-col">${user.totalPoints}</td>`;

                // Column for each match
                filteredMatches.forEach(match => {
                    if (!canSeePredictionsOf(user.username)) {
                        // Hidden until predictions are locked: same slots as a normal cell, so rows still line up
                        html += '<td class="prediction-cell hidden-prediction" title="Hidden until predictions are locked"><div class="cell-score"><span aria-label="Hidden until predictions are locked">🔒</span></div><span class="points-earned points-placeholder">&nbsp;</span><div class="cell-extras"></div></td>';
                        return;
                    }
                    const pred = users[user.username].predictions[match.id];
                    const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                    
                    if (!pred) {
                        html += '<td>-</td>';
                        return;
                    }
                    
                    let pointsEarned = 0;
                    let pointsClass = 'points-0';
                    let tooltipContent = '';
                    const isJoker = isUserJokerForMatch(user.username, match.id);
                    const breakdown = hasResult
                        ? getMatchPointsBreakdown(pred, match, isJoker)
                        : null;

                    if (hasResult && breakdown) {
                        pointsEarned = breakdown.points;
                        if (breakdown.perfectScore) {
                            pointsClass = 'points-perfect';
                        } else if (breakdown.correctResult) {
                            pointsClass = pointsEarned > 3 ? 'points-4' : 'points-3';
                        }

                        tooltipContent += `<span class="tooltip-line">Predicted: ${pred.team1} - ${pred.team2}</span>`;
                        tooltipContent += `<span class="tooltip-line">Actual: ${match.actualScore1} - ${match.actualScore2}</span>`;
                        if (breakdown.summary) {
                            breakdown.summary.split(' + ').forEach(part => {
                                const className = part.startsWith('Joker Bonus')
                                    ? 'joker-bonus'
                                    : breakdown.correctResult
                                        ? 'bonus'
                                        : 'incorrect';
                                tooltipContent += `<span class="tooltip-line ${className}">${part}</span>`;
                            });
                        } else {
                            tooltipContent += '<span class="tooltip-line incorrect">Wrong result (0)</span>';
                        }
                        tooltipContent += `<span class="tooltip-line" style="margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 0.5rem;">Total: ${pointsEarned} pts</span>`;
                    }

                    const jokerIndicator = isJoker ? '<span class="joker-indicator">🃏</span>' : '';
                    const jokerScoreClass = isJoker ? 'joker-score' : '';
                    const jokerCellClass = isJoker ? 'prediction-cell joker-cell' : 'prediction-cell';
                    const score1 = pred.team1;
                    const score2 = pred.team2;
                    let score1Class = 'pred-score';
                    let score2Class = 'pred-score';
                    if (score1 > score2) {
                        score1Class += ' pred-score-win';
                        score2Class += ' pred-score-lose';
                    } else if (score2 > score1) {
                        score1Class += ' pred-score-lose';
                        score2Class += ' pred-score-win';
                    } else {
                        score1Class += ' pred-score-tie';
                        score2Class += ' pred-score-tie';
                    }

                    if (isJoker) {
                        tooltipContent += `<span class="tooltip-line joker-bonus">🃏 Joker selection: points are doubled</span>`;
                    }
                    tooltipContent += chatTooltipHtml(user.username, match.id);
                    const tipClass = tooltipContent.replace(/<[^>]*>/g, '').trim() ? 'tooltip' : 'tooltip tooltip-empty';

                    // Every cell has the same slots, so rows line up: the score, the points pill, then one line holding the Joker and the top emoji
                    const scoreLine = `<div class="cell-score"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span>${isJoker ? '<span class="joker-inline" aria-hidden="true">🃏</span>' : ''}</div>`;
                    const pointsLine = hasResult
                        ? `<span class="points-earned ${pointsClass}">${pointsEarned} pts</span>`
                        : '<span class="points-earned points-placeholder">&nbsp;</span>';
                    const extrasLine = `<div class="cell-extras">${jokerIndicator}${chatCellBadge(user.username, match.id)}</div>`;
                    // With the reactions pop-up available, tapping or clicking a prediction shows the detail there, so no hover tooltip
                    const showTooltip = !fixtureChat.available && (hasResult || isJoker);
                    html += `<td class="${jokerCellClass}"${chatCellAttrs(user.username, match.id)}>
                        ${showTooltip
                            ? `<div class="tooltip-container">${scoreLine}${pointsLine}<div class="${tipClass}">${tooltipContent}</div></div>`
                            : `${scoreLine}${pointsLine}`}
                        ${extrasLine}
                    </td>`;
                });
                
                // Predicted tries column (only when not filtering by round): just the number, no tooltip
                if (currentFilter !== 'round') {
                    const userTries = users[user.username].totalTries;
                    html += `<td class="tries-col">${!canSeePredictionsOf(user.username) ? '🔒' : (userTries !== null && userTries !== undefined ? userTries : '-')}</td>`;
                }
                
                html += '</tr>';
            });
            
            html += '</tbody>';
            html += '</table>';
            html += '</div></div>';

            container.innerHTML = html;
            buildSummaryStickyHead();
            renderPrizeMoneyPanel(sortedUsers);
            renderWormChart(sortedUsers);
            updateLeaderboard();
            checkTableOverflow();

            // In default view, auto-scroll to show the relevant matches
            if (currentFilter === 'default') {
                scrollToDefaultMatches();
            }
        }

        // Scroll the summary table so the default matches (last 2 completed + next 3 upcoming) are visible
        function scrollToDefaultMatches() {
            const container = document.querySelector('.summary-container');
            if (!container) return;

            const targetIndex = getDefaultScrollTargetIndex();
            const targetCell = container.querySelector(`th[data-match-col="${targetIndex}"]`);
            if (!targetCell) return;

            // Scroll so the target cell is at the left edge (after the sticky columns)
            // Use offsetLeft relative to the table, minus the sticky columns width
            const stickyWidth = targetCell.closest('table').querySelector('.pts-col').offsetLeft +
                                targetCell.closest('table').querySelector('.pts-col').offsetWidth;
            const scrollTarget = targetCell.offsetLeft - stickyWidth;
            container.scrollLeft = Math.max(0, scrollTarget);
        }

        // A table that is only a pixel or two wider than its box (a round of three games on a phone) must not scroll at all:
        // on iPhone that sliver let the box bounce from side to side. Locked, it simply stays put.
        function syncSummaryScrollLock() {
            const box = document.querySelector('.summary-container');
            if (!box) return;
            box.classList.remove('no-scroll');
            box.classList.toggle('no-scroll', box.scrollWidth - box.clientWidth <= 3);
        }

        // The "scroll left and right" hint goes away for good once the user has scrolled the table sideways themselves
        const SCROLL_HINT_DISMISSED_KEY = 'summaryScrollHintDismissed';
        function scrollHintDismissed() {
            try { return localStorage.getItem(SCROLL_HINT_DISMISSED_KEY) === '1'; } catch (error) { return false; }
        }
        function dismissScrollHint() {
            try { localStorage.setItem(SCROLL_HINT_DISMISSED_KEY, '1'); } catch (error) { /* not remembered */ }
            const hint = document.getElementById('scrollHint');
            if (hint) hint.remove();
        }
        // A scroll counts only if the user just touched, dragged or wheeled the table (the app also scrolls it by itself when it draws)
        function watchScrollHint(box) {
            if (!box || box.dataset.hintWatch || scrollHintDismissed()) return;
            box.dataset.hintWatch = '1';
            let lastInput = 0;
            const note = () => { lastInput = Date.now(); };
            ['touchstart', 'touchmove', 'wheel', 'mousedown', 'keydown'].forEach(type => box.addEventListener(type, note, { passive: true }));
            let startLeft = box.scrollLeft;
            box.addEventListener('scroll', () => {
                if (Math.abs(box.scrollLeft - startLeft) < 4) return;
                if (Date.now() - lastInput < 1500) dismissScrollHint();
                else startLeft = box.scrollLeft;   // moved by the app, not the user
            }, { passive: true });
        }

        function checkTableOverflow() {
            const container = document.querySelector('.summary-container');
            const scrollHint = document.getElementById('scrollHint');
            if (!container || !scrollHint) return;

            // Show hint if table is wider than container (and the user has not already learned to scroll it)
            if (scrollHintDismissed()) {
                scrollHint.remove();
            } else if (container.scrollWidth > container.clientWidth) {
                scrollHint.classList.remove('hidden');
                watchScrollHint(container);
            } else {
                scrollHint.classList.add('hidden');
            }
            syncSummaryScrollLock();

            // Enable touch tooltips for mobile
            initTouchTooltips();
        }
