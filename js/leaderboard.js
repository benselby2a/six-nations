// Round filter, prize projection and prize panel
// Classic script (shared global scope); load order is set in index.html.

        // Current filter state
        let currentFilter = 'default';
        let selectedRound = 1;

        // Initialize the round selector dropdown
        function initRoundSelector() {
            const select = document.getElementById('roundSelect');
            if (!select) return;
            
            // Get unique rounds from matches
            const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
            
            // Determine the default round based on current date/tournament progress
            selectedRound = getDefaultRound();
            
            // Get the first match date for each round
            const roundDates = {};
            rounds.forEach(r => {
                const roundMatches = matches.filter(m => m.round === r);
                if (roundMatches.length > 0) {
                    // Get the first match date in this round
                    roundDates[r] = roundMatches[0].date || 'TBD';
                }
            });
            
            // Populate dropdown with round and date
            select.innerHTML = rounds.map(r => {
                const dateStr = roundDates[r] || 'TBD';
                return `<option value="${r}" ${r === selectedRound ? 'selected' : ''}>Round ${r} (${dateStr})</option>`;
            }).join('');
        }

        // Get the default round to show (similar logic to old "This Weekend")
        // Logic: Show the round that contains the most recent incomplete match,
        // or if all matches are complete, show the most recent completed round.
        // If no matches have been played, show the first round.
        function getDefaultRound() {
            const now = new Date();
            
            // Find rounds with their completion status
            const roundStatus = {};
            matches.forEach(m => {
                if (!roundStatus[m.round]) {
                    roundStatus[m.round] = { total: 0, completed: 0, hasIncomplete: false };
                }
                roundStatus[m.round].total++;
                if (m.actualScore1 !== null && m.actualScore2 !== null) {
                    roundStatus[m.round].completed++;
                } else {
                    roundStatus[m.round].hasIncomplete = true;
                }
            });
            
            const rounds = Object.keys(roundStatus).map(Number).sort((a, b) => a - b);
            
            // Find the first round that has incomplete matches (current/upcoming round)
            for (const round of rounds) {
                if (roundStatus[round].hasIncomplete) {
                    return round;
                }
            }
            
            // All matches complete - return the last round
            return rounds.length > 0 ? rounds[rounds.length - 1] : 1;
        }

        // Handle round select dropdown change
        function onRoundSelectChange() {
            const select = document.getElementById('roundSelect');
            selectedRound = parseInt(select.value);
            showSummary();
        }

        // Filter matches based on selected filter
        function filterMatches(filterType) {
            currentFilter = filterType;

            // Update toggle button states
            document.querySelectorAll('.filter-toggle-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Show/hide round selector
            const roundSelect = document.getElementById('roundSelect');
            const roundSelectLabel = document.getElementById('roundSelectLabel');
            if (filterType === 'round') {
                selectedRound = getDefaultRound();
                roundSelect.value = selectedRound;
                roundSelect.classList.remove('hidden');
                if (roundSelectLabel) roundSelectLabel.classList.remove('hidden');
            } else {
                roundSelect.classList.add('hidden');
                if (roundSelectLabel) roundSelectLabel.classList.add('hidden');
            }

            showSummary();
        }

        // Get filtered matches based on current filter
        function getFilteredMatches() {
            if (currentFilter === 'round') {
                return matches.filter(m => m.round === selectedRound);
            }

            return matches; // 'default' shows all matches
        }

        // Get the index of the first match to scroll to in default view
        // Shows last 2 completed + next 3 upcoming (or fewer if not enough remain)
        function getDefaultScrollTargetIndex() {
            const completed = matches.filter(m => m.actualScore1 !== null && m.actualScore2 !== null);
            const lastCompleted = completed.slice(-2);

            // The scroll target is the first of the "default" matches
            if (lastCompleted.length > 0) {
                return matches.indexOf(lastCompleted[0]);
            }
            // No completed matches yet - scroll to the start
            return 0;
        }

        function roundMoney(value) {
            return Math.round((Number(value) || 0) * 100) / 100;
        }

        function formatCurrencyAmount(amount) {
            try {
                return new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: 'GBP',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(roundMoney(amount));
            } catch (error) {
                return `GBP ${roundMoney(amount).toFixed(2)}`;
            }
        }

        function isTournamentTriesFinalized() {
            return matches.length > 0 && matches.every(match => match.actualTries1 !== null && match.actualTries2 !== null);
        }

        function getProjectedTournamentTriesTotal() {
            const completedWithTries = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null);
            if (completedWithTries.length === 0) return null;
            const totalActualTries = getTotalActualTries();
            return Math.round((totalActualTries / completedWithTries.length) * matches.length);
        }

        function buildRankingGroups(sortedUsers) {
            const groups = [];
            let index = 0;
            while (index < sortedUsers.length) {
                const start = index;
                const points = sortedUsers[index].totalPoints;
                while (index < sortedUsers.length && sortedUsers[index].totalPoints === points) {
                    index += 1;
                }
                groups.push({
                    startRank: start + 1,
                    endRank: start + (index - start),
                    users: sortedUsers.slice(start, index)
                });
            }
            return groups;
        }

        function formatPrizeNoteNames(usernames) {
            return Array.from(new Set((usernames || []).filter(Boolean)))
                .map(username => getDisplayName(username))
                .join(', ');
        }

        function calculatePrizeProjection(sortedUsers, rules) {
            const prizeEligibleUsers = sortedUsers.filter(user => !isAiPlayer(user.username));
            const entrantCount = prizeEligibleUsers.length;
            const entryFeeAmount = Math.max(0, Number(rules.entryFeeAmount) || 0);
            const payoutFirstPct = Math.max(0, Number(rules.payoutFirstPct) || 0);
            const payoutSecondPct = Math.max(0, Number(rules.payoutSecondPct) || 0);
            const payoutThirdPct = Math.max(0, Number(rules.payoutThirdPct) || 0);
            const payoutClosestTriesPct = Math.max(0, Number(rules.payoutClosestTriesPct) || 0);
            const totalPool = roundMoney(entryFeeAmount * entrantCount);

            const pots = {
                1: roundMoney(totalPool * payoutFirstPct / 100),
                2: roundMoney(totalPool * payoutSecondPct / 100),
                3: roundMoney(totalPool * payoutThirdPct / 100),
                closestTries: roundMoney(totalPool * payoutClosestTriesPct / 100)
            };

            const groups = buildRankingGroups(prizeEligibleUsers);
            const leaderboardPayouts = {};
            groups.forEach(group => {
                const overlappingRanks = [1, 2, 3].filter(rank => rank >= group.startRank && rank <= group.endRank);
                if (overlappingRanks.length === 0) return;
                const combinedPot = overlappingRanks.reduce((sum, rank) => sum + (pots[rank] || 0), 0);
                if (combinedPot <= 0 || group.users.length === 0) return;
                const share = roundMoney(combinedPot / group.users.length);
                group.users.forEach(user => {
                    leaderboardPayouts[user.username] = roundMoney((leaderboardPayouts[user.username] || 0) + share);
                });
            });

            const triesTarget = isTournamentTriesFinalized() ? getTotalActualTries() : getProjectedTournamentTriesTotal();
            let closestTriesWinners = [];
            let triesCandidatesSorted = [];
            const excludedAiPrizeUsers = new Set();

            buildRankingGroups(sortedUsers).forEach(group => {
                const overlapsPrizeRanks = [1, 2, 3].some(rank => {
                    const prizePot = pots[rank] || 0;
                    return prizePot > 0 && rank >= group.startRank && rank <= group.endRank;
                });
                if (!overlapsPrizeRanks) return;
                group.users
                    .filter(user => isAiPlayer(user.username))
                    .forEach(user => excludedAiPrizeUsers.add(user.username));
            });

            if (triesTarget !== null) {
                const candidates = [];
                sortedUsers.forEach((user, index) => {
                    const predicted = users[user.username] ? users[user.username].totalTries : null;
                    if (predicted === null || predicted === undefined || !Number.isFinite(Number(predicted))) return;
                    if (isAiPlayer(user.username)) {
                        candidates.push({
                            username: user.username,
                            predicted: Number(predicted),
                            diff: Math.abs(Number(predicted) - triesTarget),
                            leaderboardOrder: index,
                            excludedFromPrize: true
                        });
                        return;
                    }
                    candidates.push({
                        username: user.username,
                        predicted: Number(predicted),
                        diff: Math.abs(Number(predicted) - triesTarget),
                        leaderboardOrder: index
                    });
                });

                triesCandidatesSorted = candidates.sort((a, b) => {
                    if (a.diff !== b.diff) return a.diff - b.diff;
                    if (a.leaderboardOrder !== b.leaderboardOrder) return a.leaderboardOrder - b.leaderboardOrder;
                    return a.username.localeCompare(b.username);
                });

                const aiClosestCandidate = triesCandidatesSorted.find(entry => entry.excludedFromPrize);
                const prizeEligibleCandidates = triesCandidatesSorted.filter(entry => !entry.excludedFromPrize);
                const bestDiff = prizeEligibleCandidates.length > 0 ? prizeEligibleCandidates[0].diff : Number.POSITIVE_INFINITY;
                closestTriesWinners = prizeEligibleCandidates.filter(entry => entry.diff === bestDiff);

                if ((pots.closestTries || 0) > 0 && aiClosestCandidate && aiClosestCandidate.diff <= bestDiff) {
                    excludedAiPrizeUsers.add(aiClosestCandidate.username);
                }
                triesCandidatesSorted = prizeEligibleCandidates;
            }

            const closestTriesShare = closestTriesWinners.length > 0
                ? roundMoney(pots.closestTries / closestTriesWinners.length)
                : 0;

            const nonWinningCandidates = triesCandidatesSorted.filter(entry => !closestTriesWinners.some(w => w.username === entry.username));
            const provisionalSecondClosest = nonWinningCandidates[0] || null;
            const provisionalThirdClosest = nonWinningCandidates[1] || null;

            return {
                entrantCount,
                totalPool,
                pots,
                groups,
                leaderboardPayouts,
                triesTarget,
                triesFinalized: isTournamentTriesFinalized(),
                closestTriesWinners,
                closestTriesShare,
                provisionalSecondClosest,
                provisionalThirdClosest,
                aiPrizeFootnote: excludedAiPrizeUsers.size > 0
                    ? `${formatPrizeNoteNames(Array.from(excludedAiPrizeUsers))} ${excludedAiPrizeUsers.size === 1 ? 'is' : 'are'} excluded from prize payouts, so the prize winners shown above skip AI entrants.`
                    : ''
            };
        }

        function getRankGroupForRank(groups, rank) {
            return groups.find(group => rank >= group.startRank && rank <= group.endRank) || null;
        }

        function formatOrdinalRank(rank) {
            const mod100 = rank % 100;
            if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
            switch (rank % 10) {
                case 1: return `${rank}st`;
                case 2: return `${rank}nd`;
                case 3: return `${rank}rd`;
                default: return `${rank}th`;
            }
        }

        function formatPrizeRankLabel(group, fallbackLabel, fallbackPct, rules) {
            if (!group) return `${fallbackLabel} (${fallbackPct}%)`;
            if (group.startRank === group.endRank) return `${formatOrdinalRank(group.startRank)} Place (${fallbackPct}%)`;

            const occupiedRanks = [];
            for (let rank = group.startRank; rank <= group.endRank; rank += 1) {
                if (rank >= 1 && rank <= 3) occupiedRanks.push(rank);
            }
            const combinedPct = occupiedRanks.reduce((sum, rank) => {
                if (rank === 1) return sum + (Number(rules?.payoutFirstPct) || 0);
                if (rank === 2) return sum + (Number(rules?.payoutSecondPct) || 0);
                if (rank === 3) return sum + (Number(rules?.payoutThirdPct) || 0);
                return sum;
            }, 0);
            return `${formatOrdinalRank(group.startRank)}-${formatOrdinalRank(group.endRank)} Place (${combinedPct}%)`;
        }

        function formatNamesForUsers(userList) {
            return (userList || []).map(u => toTitleCase(u.nickname || u.username)).join(', ');
        }

        function renderPrizeMoneyPanel(sortedUsers) {
            const container = document.getElementById('prizeMoneyContainer');
            if (!container) return;

            const rules = getEffectiveScoringRules();
            const projection = calculatePrizeProjection(sortedUsers, rules);
            const rank1Group = getRankGroupForRank(projection.groups, 1);
            const rank2Group = getRankGroupForRank(projection.groups, 2);
            const rank3Group = getRankGroupForRank(projection.groups, 3);
            const displayedPrizeGroups = new Set();

            const rankLine = (fallbackLabel, fallbackPct, group) => {
                if (group) {
                    const groupKey = `${group.startRank}-${group.endRank}`;
                    if (displayedPrizeGroups.has(groupKey)) {
                        return `
                            <div class="prize-rank-cell">
                                <div class="prize-row-head">${fallbackLabel} (${fallbackPct}%)</div>
                                <div class="prize-row-body">Included in tied ${formatOrdinalRank(group.startRank)}-${formatOrdinalRank(group.endRank)} payout</div>
                                <div class="prize-row-amount">${formatCurrencyAmount(0)}</div>
                            </div>
                        `;
                    }
                    displayedPrizeGroups.add(groupKey);
                }
                const names = group ? formatNamesForUsers(group.users) : 'TBD';
                const share = group && group.users.length > 0
                    ? projection.leaderboardPayouts[group.users[0].username] || 0
                    : 0;
                const amountSuffix = group && group.users.length > 1 ? ' each' : '';
                return `
                    <div class="prize-rank-cell">
                        <div class="prize-row-head">${formatPrizeRankLabel(group, fallbackLabel, fallbackPct, rules)}</div>
                        <div class="prize-row-body">${names}</div>
                        <div class="prize-row-amount">${formatCurrencyAmount(share)}${amountSuffix}</div>
                    </div>
                `;
            };

            const closestNames = projection.closestTriesWinners.length > 0
                ? projection.closestTriesWinners.map(w => `${toTitleCase(users[w.username].nickname || w.username)} (${w.predicted} tries)`).join(', ')
                : 'TBD';

            const triesStatus = projection.triesFinalized
                ? `Final total tries: ${projection.triesTarget ?? '-'}`
                : `Provisional tries target: ${projection.triesTarget ?? '-'} (based on current completed matches)`;
            const footnotes = [triesStatus, projection.aiPrizeFootnote].filter(Boolean);
            const closestSuffix = projection.closestTriesWinners.length > 1 ? ' each' : '';
            const secondClosestText = projection.provisionalSecondClosest
                ? `${toTitleCase(users[projection.provisionalSecondClosest.username].nickname || projection.provisionalSecondClosest.username)} (${projection.provisionalSecondClosest.predicted} tries, off by ${projection.provisionalSecondClosest.diff})`
                : 'TBD';
            const thirdClosestText = projection.provisionalThirdClosest
                ? `${toTitleCase(users[projection.provisionalThirdClosest.username].nickname || projection.provisionalThirdClosest.username)} (${projection.provisionalThirdClosest.predicted} tries, off by ${projection.provisionalThirdClosest.diff})`
                : 'TBD';
            const prizeStatusLabel = matches.some(match => match.actualScore1 === null || match.actualScore2 === null)
                ? 'As things stand'
                : 'Official results';

            container.innerHTML = `
                <div class="tries-stats-title">Prize Money ${prizeStatusLabel}</div>
                <div class="prize-summary-grid">
                    <div class="prize-stat">
                        <div class="prize-stat-value">${projection.entrantCount}</div>
                        <div class="prize-stat-label">Eligible Entrants</div>
                    </div>
                    <div class="prize-stat">
                        <div class="prize-stat-value">${formatCurrencyAmount(rules.entryFeeAmount)}</div>
                        <div class="prize-stat-label">Entry Fee</div>
                    </div>
                    <div class="prize-stat">
                        <div class="prize-stat-value">${formatCurrencyAmount(projection.totalPool)}</div>
                        <div class="prize-stat-label">Total Prize Fund</div>
                    </div>
                </div>
                <div class="prize-allocations">
                    <div class="prize-rank-grid">
                        ${rankLine('1st Place', rules.payoutFirstPct, rank1Group)}
                        ${rankLine('2nd Place', rules.payoutSecondPct, rank2Group)}
                        ${rankLine('3rd Place', rules.payoutThirdPct, rank3Group)}
                    </div>
                    <div class="prize-rank-cell closest-tries-card">
                        <div class="prize-row-head">Closest Tries (${rules.payoutClosestTriesPct}%)</div>
                        <div class="prize-row-body">${closestNames}</div>
                        <div class="prize-row-amount">${formatCurrencyAmount(projection.closestTriesShare)}${closestSuffix}</div>
                    </div>
                </div>
                <div class="prize-subheading" style="margin-top: 0.65rem;">Provisional Closest Tries Chasers</div>
                <div class="prize-chasers">
                    <div><strong>2nd closest:</strong> ${secondClosestText}</div>
                    <div><strong>3rd closest:</strong> ${thirdClosestText}</div>
                </div>
                <div class="prize-footnote">${footnotes.join('<br>')}</div>
            `;
        }
