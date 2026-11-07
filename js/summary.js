// Summary screen
// Classic script (shared global scope); load order is set in index.html.

        // Show comprehensive summary with matches as columns
        function showSummary() {
            const container = document.getElementById('summaryContainer');
            const allUsers = getParticipantUsernames();
            
            if (matches.length === 0 || allUsers.length === 0) {
                const emptyMessage = matches.length === 0
                    ? `No fixtures have been added for ${selectedYear} yet.`
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

            let html = scrollHintMarkup;
            html += '<div class="summary-container">';
            html += '<table class="summary-table">';
            
            // Header row: Rank | Competitor | Score | Match 1 | Match 2 | ... | Predicted Tries
            html += '<thead><tr>';
            html += '<th class="rank-col">#</th>';
            html += '<th class="competitor-col">Competitor</th>';
            html += '<th class="pts-col">Score</th>';
            filteredMatches.forEach((match, colIndex) => {
                const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                const hasTries = match.actualTries1 !== null && match.actualTries2 !== null;
                const totalMatchTries = hasTries ? match.actualTries1 + match.actualTries2 : null;
                const jokerBadge = match.jokerEligible ? '<div class="joker-eligible-badge">🃏 Joker Eligible</div>' : '<div class="joker-eligible-badge" style="visibility: hidden;">🃏 Joker Eligible</div>';
                html += `<th class="match-header-cell ${match.jokerEligible ? 'joker-eligible-header' : ''}" data-match-col="${colIndex}" data-chat-match="${match.id}">
                    <div class="match-header-cell-inner">
                        <div class="match-header-top">
                            ${jokerBadge}
                            <div class="match-teams">${getFlag(match.team1)} ${getTeamAbbr(match.team1)}<br>vs<br>${getFlag(match.team2)} ${getTeamAbbr(match.team2)}</div>
                            <div class="match-date">${match.date} - ${match.time}</div>
                        </div>
                        <div class="match-header-bottom">
                            ${hasResult ? `<div class="match-result">${match.actualScore1} - ${match.actualScore2}</div>` : '<div class="no-result">-</div>'}
                            ${hasTries ? `<div class="match-tries">(${totalMatchTries} tries)</div>` : ''}
                            ${chatChipMarkup(match.id)}
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
                html += `<td class="competitor-name">${getUserFlags(user.username)}${user.nickname}</td>`;
                html += `<td class="pts-col">${user.totalPoints}</td>`;

                // Column for each match
                filteredMatches.forEach(match => {
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

                    if (hasResult) {
                        html += `<td class="${jokerCellClass}"${chatCellAttrs(user.username, match.id)}>
                            <div class="tooltip-container">
                                <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                <span class="points-earned ${pointsClass}">${pointsEarned} pts</span>
                                <div class="tooltip">${tooltipContent}</div>
                            </div>
                                ${chatCellBadge(user.username, match.id)}
                        </td>`;
                    } else {
                        if (isJoker) {
                            html += `<td class="${jokerCellClass}"${chatCellAttrs(user.username, match.id)}>
                                <div class="tooltip-container">
                                    <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                    <span class="points-earned points-placeholder">&nbsp;</span>
                                    <div class="tooltip">${tooltipContent}</div>
                                </div>
                                ${chatCellBadge(user.username, match.id)}
                            </td>`;
                        } else {
                            html += `<td class="${jokerCellClass}"${chatCellAttrs(user.username, match.id)}>
                                <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                <span class="points-earned points-placeholder">&nbsp;</span>
                                ${chatCellBadge(user.username, match.id)}
                            </td>`;
                        }
                    }
                });
                
                // Predicted tries column with calculated projection (only when not filtering by round)
                if (currentFilter !== 'round') {
                    const userTries = users[user.username].totalTries;
                    let predictedTriesDisplay = '-';
                    let projectedTries = null;
                    
                    if (userTries !== null && userTries !== undefined) {
                        // Calculate average tries per game from user's predictions and project to 15 games
                        const userPredictions = users[user.username].predictions;
                        const numPredictions = Object.keys(userPredictions).length;
                        
                        if (numPredictions > 0 && completedMatches > 0) {
                            // Calculate average actual tries per completed match
                            const avgTriesPerMatch = totalActualTries / completedMatches;
                            // Project to full tournament
                            projectedTries = Math.round(avgTriesPerMatch * totalMatches);
                            predictedTriesDisplay = `<div class="tooltip-container">${userTries}<div class="tooltip"><span class="tooltip-line">User prediction: ${userTries}</span><span class="tooltip-line">Avg tries/match: ${avgTriesPerMatch.toFixed(1)}</span><span class="tooltip-line">Projected total: ${projectedTries}</span></div></div>`;
                        } else {
                            predictedTriesDisplay = userTries;
                        }
                    }
                    
                    html += `<td class="tries-col">${predictedTriesDisplay}</td>`;
                }
                
                html += '</tr>';
            });
            
            html += '</tbody>';
            html += '</table>';
            html += '</div>';

            container.innerHTML = html;
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

        function checkTableOverflow() {
            const container = document.querySelector('.summary-container');
            const scrollHint = document.getElementById('scrollHint');
            if (!container || !scrollHint) return;

            // Show hint if table is wider than container
            if (container.scrollWidth > container.clientWidth) {
                scrollHint.classList.remove('hidden');
            } else {
                scrollHint.classList.add('hidden');
            }

            // Enable touch tooltips for mobile
            initTouchTooltips();
        }
