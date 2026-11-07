// Predictions UI, checklists, admin prediction editing, loading
// Classic script (shared global scope); load order is set in index.html.

        function getOutstandingPredictionStatus(username) {
            const userData = users[username];
            const completedPredictions = userData && userData.predictions ? Object.keys(userData.predictions).length : 0;
            const outstandingCount = matches.length - completedPredictions;
            const hasTries = !!(userData && userData.totalTries !== null && userData.totalTries !== undefined);
            return { outstandingCount, hasTries };
        }

        function buildOutstandingBannerText(outstandingCount, hasTries) {
            if (outstandingCount > 0 && !hasTries) {
                return `<span class="outstanding-banner-count">${outstandingCount}</span> match prediction${outstandingCount !== 1 ? 's' : ''} and <span class="outstanding-banner-count">total tries</span> still to enter`;
            }
            if (outstandingCount > 0) {
                return `<span class="outstanding-banner-count">${outstandingCount}</span> match prediction${outstandingCount !== 1 ? 's' : ''} still to enter`;
            }
            return `<span class="outstanding-banner-count">Total tries</span> prediction still to enter`;
        }

        function getEligibleJokerMatchIds() {
            return matches
                .filter(match => !!match.jokerEligible)
                .map(match => match.id);
        }

        function getRequiredJokerCount() {
            const rules = getEffectiveScoringRules();
            const maxAllowed = Math.max(0, Number(rules.maxJokersPerUser) || 0);
            return Math.min(maxAllowed, getEligibleJokerMatchIds().length);
        }

        function getPredictionChecklistStatus(username) {
            const userData = users[username] || {};
            const userPredictions = userData.predictions || {};
            const enteredPredictions = Object.keys(userPredictions).length;
            const pendingPredictions = Math.max(0, matches.length - enteredPredictions);
            const triesEntered = userData.totalTries !== null && userData.totalTries !== undefined;
            const jokerSelectedCount = getUserSelectedJokerMatchIds(username).length;
            const jokerRequiredCount = getRequiredJokerCount();
            const jokerComplete = jokerRequiredCount === 0
                ? jokerSelectedCount === 0
                : jokerSelectedCount === jokerRequiredCount;
            const jokerOverLimit = jokerSelectedCount > jokerRequiredCount;

            return {
                enteredPredictions,
                totalPredictions: matches.length,
                pendingPredictions,
                triesEntered,
                jokerSelectedCount,
                jokerRequiredCount,
                jokerOverLimit,
                jokerComplete,
                allComplete: pendingPredictions === 0 && triesEntered && jokerComplete
            };
        }

        function renderPredictionChecklist(username) {
            const status = getPredictionChecklistStatus(username);
            const scoresOk = status.pendingPredictions === 0;
            const triesOk = status.triesEntered;
            const jokerOk = status.jokerComplete;
            const overallClass = status.allComplete ? 'complete' : 'incomplete';

            return `
                <div class="prediction-checklist ${overallClass}">
                    <div class="prediction-checklist-title">Prediction Checklist</div>
                    <div class="prediction-checklist-items">
                        <div class="prediction-checklist-item ${scoresOk ? 'ok' : 'missing'}">
                            <span class="prediction-checklist-icon">${scoresOk ? '✓' : '•'}</span>
                            <span>Scores: ${status.enteredPredictions}/${status.totalPredictions}${scoresOk ? ' complete' : ` (${status.pendingPredictions} pending)`}</span>
                        </div>
                        <div class="prediction-checklist-item ${jokerOk ? 'ok' : 'missing'}">
                            <span class="prediction-checklist-icon">${jokerOk ? '✓' : '•'}</span>
                            <span>Jokers: ${status.jokerRequiredCount === 0 ? 'not required' : `${status.jokerSelectedCount}/${status.jokerRequiredCount} selected${status.jokerOverLimit ? ' (over limit)' : ''}`}</span>
                        </div>
                        <div class="prediction-checklist-item ${triesOk ? 'ok' : 'missing'}">
                            <span class="prediction-checklist-icon">${triesOk ? '✓' : '•'}</span>
                            <span>Tournament tries: ${triesOk ? 'entered' : 'not entered'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        function getDisplayName(username) {
            if (!users[username]) return username;
            return toTitleCase(users[username].nickname || username);
        }

        function populateAdminPredictionUserSelect() {
            const select = document.getElementById('adminPredictionUserSelect');
            if (!select) return;

            const allUsers = Object.keys(users).filter(u => users[u].nickname).sort((a, b) => {
                return getDisplayName(a).localeCompare(getDisplayName(b));
            });

            if (allUsers.length === 0) {
                select.innerHTML = '<option value="">No competitors</option>';
                adminPredictionUsername = null;
                return;
            }

            if (!adminPredictionUsername || !users[adminPredictionUsername]) {
                adminPredictionUsername = null;
            }

            const placeholderOption = `<option value="" ${adminPredictionUsername ? '' : 'selected'}>Please select a competitor</option>`;
            const userOptions = allUsers.map(username => {
                const selected = username === adminPredictionUsername ? 'selected' : '';
                return `<option value="${username}" ${selected}>${getDisplayName(username)}</option>`;
            }).join('');

            select.innerHTML = `${placeholderOption}${userOptions}`;
        }

        function onAdminPredictionUserChange() {
            const select = document.getElementById('adminPredictionUserSelect');
            adminPredictionUsername = select ? select.value : null;
            renderAdminScoreCorrections();
        }

        function getCompactFixtureLabel(match) {
            return `<span class="prediction-fixture-label"><span class="prediction-fixture-team">${getFlag(match.team1)} ${getTeamAbbr(match.team1)}</span><span class="prediction-fixture-v">v</span><span class="prediction-fixture-team">${getTeamAbbr(match.team2)} ${getFlag(match.team2)}</span></span>`;
        }

        function openEditPredictionModal(mode, matchId) {
            const match = matches.find(m => m.id === matchId);
            const modal = document.getElementById('editPredictionModal');
            if (!match || !modal) return;

            const username = mode === 'admin' ? adminPredictionUsername : currentUsername;
            if (!username || !users[username]) return;

            const prediction = users[username].predictions ? users[username].predictions[matchId] : null;
            editingPredictionContext = { mode, matchId, username };

            const title = document.getElementById('edit-prediction-title');
            const subtitle = document.getElementById('edit-prediction-subtitle');
            const team1Label = document.getElementById('edit-prediction-team1-label');
            const team2Label = document.getElementById('edit-prediction-team2-label');
            const team1Input = document.getElementById('edit-prediction-score1');
            const team2Input = document.getElementById('edit-prediction-score2');
            const jokerGroup = document.getElementById('edit-prediction-joker-group');
            const jokerInput = document.getElementById('edit-prediction-joker');
            const jokerHint = document.getElementById('edit-prediction-joker-hint');
            const lockedNote = document.getElementById('edit-prediction-locked-note');
            const saveBtn = document.getElementById('edit-prediction-save-btn');

            if (!team1Input || !team2Input) return;

            if (title) {
                title.textContent = mode === 'admin' ? `Edit ${getDisplayName(username)} Prediction` : 'Edit Prediction';
            }
            if (subtitle) {
                subtitle.innerHTML = `<strong>${match.date} ${match.time ? `- ${match.time}` : ''}</strong><br>${getFlag(match.team1)} ${match.team1} vs ${match.team2} ${getFlag(match.team2)}`;
            }
            if (team1Label) team1Label.textContent = `${match.team1} score`;
            if (team2Label) team2Label.textContent = `${match.team2} score`;

            team1Input.value = prediction ? prediction.team1 : '';
            team2Input.value = prediction ? prediction.team2 : '';

            const selectedJokers = getUserSelectedJokerMatchIds(username);
            const requiredJokers = getRequiredJokerCount();
            const isCurrentJoker = selectedJokers.includes(match.id);
            const remainingSlots = Math.max(0, requiredJokers - selectedJokers.length);
            const cannotSelectMore = requiredJokers > 0 && !isCurrentJoker && remainingSlots === 0;
            const otherSelectedJokers = selectedJokers.filter(id => id !== match.id)
                .map(id => matches.find(m => m.id === id))
                .filter(Boolean);
            const jokerFixtureSummary = otherSelectedJokers.length > 0
                ? otherSelectedJokers.map(selectedMatch => `${selectedMatch.team1} vs ${selectedMatch.team2}`).join(', ')
                : '';

            if (jokerInput) {
                jokerInput.checked = !!isCurrentJoker;
                jokerInput.disabled = !match.jokerEligible || requiredJokers === 0 || cannotSelectMore;
            }
            if (jokerGroup) {
                jokerGroup.style.display = match.jokerEligible ? 'flex' : 'none';
            }
            if (jokerHint) {
                if (!match.jokerEligible) {
                    jokerHint.textContent = 'This fixture is not joker-eligible.';
                } else if (requiredJokers === 0) {
                    jokerHint.textContent = 'Jokers are disabled in current rules.';
                } else if (cannotSelectMore && jokerFixtureSummary) {
                    jokerHint.textContent = `You have already used your ${requiredJokers === 1 ? 'joker' : 'maximum joker selections'} on ${jokerFixtureSummary}. Deselect that first if you want to move it here.`;
                } else {
                    jokerHint.textContent = `Select up to ${requiredJokers} joker${requiredJokers !== 1 ? 's' : ''}. Currently selected: ${selectedJokers.length}/${requiredJokers}.`;
                }
                jokerHint.style.display = match.jokerEligible ? '' : 'none';
            }

            const isReadOnlyLocked = mode === 'self' && appSettings.predictionsLocked;
            team1Input.disabled = isReadOnlyLocked;
            team2Input.disabled = isReadOnlyLocked;
            if (jokerInput) {
                jokerInput.disabled = isReadOnlyLocked || !match.jokerEligible || requiredJokers === 0 || cannotSelectMore;
            }
            if (lockedNote) {
                lockedNote.classList.toggle('hidden', !isReadOnlyLocked);
            }
            if (saveBtn) {
                saveBtn.disabled = isReadOnlyLocked;
                saveBtn.style.opacity = isReadOnlyLocked ? '0.6' : '1';
                saveBtn.style.cursor = isReadOnlyLocked ? 'not-allowed' : '';
            }

            modal.classList.remove('hidden');
            team1Input.focus();
        }

        function closeEditPredictionModal() {
            editingPredictionContext = null;
            const modal = document.getElementById('editPredictionModal');
            if (modal) modal.classList.add('hidden');
        }

        async function savePredictionEdits() {
            if (!editingPredictionContext) return;
            const { mode, matchId, username } = editingPredictionContext;
            if (!username || !users[username]) return;
            if (mode === 'self' && appSettings.predictionsLocked) {
                alert('Predictions are currently locked.');
                closeEditPredictionModal();
                return;
            }

            const team1Input = document.getElementById('edit-prediction-score1');
            const team2Input = document.getElementById('edit-prediction-score2');
            const jokerInput = document.getElementById('edit-prediction-joker');
            if (!team1Input || !team2Input) return;

            const score1Raw = (team1Input.value || '').trim();
            const score2Raw = (team2Input.value || '').trim();

            let updatedPrediction = null;
            if (score1Raw === '' && score2Raw === '') {
                updatedPrediction = null;
            } else if (score1Raw === '' || score2Raw === '') {
                alert('Enter both scores, or leave both blank to clear this prediction.');
                return;
            } else {
                const score1 = Number(score1Raw);
                const score2 = Number(score2Raw);
                if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
                    alert('Scores must be whole numbers of 0 or more.');
                    return;
                }
                updatedPrediction = { team1: score1, team2: score2 };
            }

            const match = matches.find(m => m.id === matchId);
            if (!users[username].predictions) users[username].predictions = {};
            if (updatedPrediction) {
                users[username].predictions[matchId] = updatedPrediction;
            } else {
                delete users[username].predictions[matchId];
            }

            const requiredJokers = getRequiredJokerCount();
            const selectedBefore = getUserSelectedJokerMatchIds(username);
            let selectedAfter = [...selectedBefore];
            const hasCurrent = selectedAfter.includes(matchId);
            const wantsCurrent = !!(match && match.jokerEligible && jokerInput && jokerInput.checked && updatedPrediction);

            if (hasCurrent && (!wantsCurrent || !match || !match.jokerEligible || !updatedPrediction)) {
                selectedAfter = selectedAfter.filter(id => id !== matchId);
            } else if (!hasCurrent && wantsCurrent) {
                if (requiredJokers > 0 && selectedAfter.length >= requiredJokers) {
                    alert(`You can only select ${requiredJokers} joker${requiredJokers !== 1 ? 's' : ''}. Deselect another joker first.`);
                    return;
                }
                selectedAfter.push(matchId);
            }
            selectedAfter = [...new Set(selectedAfter)]
                .sort((a, b) => a - b)
                .slice(0, requiredJokers === 0 ? 0 : requiredJokers);

            const jokerUpdated = selectedAfter.length !== selectedBefore.length
                || selectedAfter.some((id, index) => id !== selectedBefore[index]);

            await Storage.savePredictions(username, users[username].predictions, users[username].totalTries);
            if (jokerUpdated) {
                setUserSelectedJokerMatchIds(username, selectedAfter);
                await Storage.saveUserJokerSelections(username, selectedAfter);
            }
            closeEditPredictionModal();

            if (mode === 'admin') {
                renderAdminScoreCorrections();
            } else {
                renderMatches();
                loadPredictions();
                updateOutstandingBanner();
            }
        }

        function renderAdminScoreCorrections() {
            renderReadinessChecklist();
            const container = document.getElementById('adminUserMatchesContainer');
            const triesSection = document.getElementById('adminTriesSection');
            if (!container) return;

            populateAdminPredictionUserSelect();

            const username = adminPredictionUsername;
            if (!username || !users[username]) {
                container.innerHTML = '<p class="profile-hint">Select a competitor above to edit their predictions. Who is still outstanding is shown in the readiness checklist on Admin Functions.</p>';
                const triesInput = document.getElementById('adminTotalTries');
                if (triesInput) triesInput.value = '';
                if (triesSection) triesSection.classList.add('hidden');
                return;
            }

            if (triesSection) triesSection.classList.remove('hidden');

            let currentRound = 0;
            let html = `<div class="unlock-banner">Editing predictions for <strong>${getDisplayName(username)}</strong>. Click Edit then Save to apply changes.</div>`;
            html += renderPredictionChecklist(username);

            const matchesByRound = new Map();
            matches.forEach(match => {
                const round = match.round || 0;
                if (!matchesByRound.has(round)) matchesByRound.set(round, []);
                matchesByRound.get(round).push(match);
            });

            matchesByRound.forEach((roundMatches, round) => {
                currentRound = round;
                html += `<h2 style="font-family: 'Bebas Neue', cursive; font-size: 1.8rem; color: var(--bright-gold); margin: 1.25rem 0 0.6rem 0; letter-spacing: 0.1em;">Round ${currentRound}</h2>`;
                html += `
                    <div class="results-table-container prediction-table-container">
                        <table class="results-table prediction-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Fixture</th>
                                    <th>Scores</th>
                                    <th>Points</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                roundMatches.forEach(match => {
                    const isJoker = isUserJokerForMatch(username, match.id);
                    const isMatchCompleted = match.actualScore1 !== null && match.actualScore2 !== null;
                    const userPrediction = users[username] && users[username].predictions
                        ? users[username].predictions[match.id]
                        : null;
                    const pointsBreakdown = isMatchCompleted
                        ? getMatchPointsBreakdown(userPrediction, match, isJoker)
                        : { points: 0, summary: '' };
                    const pointsPill = isMatchCompleted
                        ? `<span class="capture-status captured" title="${pointsBreakdown.summary || 'No points awarded'}">Pts: ${pointsBreakdown.points}</span>`
                        : '';
                    const jokerSuffix = isJoker ? ` <span class="joker-indicator">JOKER</span>` : '';

                    html += `
                        <tr class="${isJoker ? 'joker-selected' : ''}" id="admin-match-card-${match.id}">
                            <td>${match.date}</td>
                            <td>${getCompactFixtureLabel(match)}</td>
                            <td class="prediction-scores-cell">Predicted: ${userPrediction ? `${userPrediction.team1}-${userPrediction.team2}` : '--'}, Actual: ${isMatchCompleted ? `${match.actualScore1}-${match.actualScore2}` : '--'}${jokerSuffix}</td>
                            <td>${pointsPill}</td>
                            <td class="prediction-actions-cell">
                                <button class="btn-small btn-success" onclick="openEditPredictionModal('admin', ${match.id})">Edit</button>
                            </td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });

            container.innerHTML = html;
            loadAdminPredictions();
        }

        function loadAdminPredictions() {
            const username = adminPredictionUsername;
            const userData = username ? users[username] : null;
            if (!userData) return;

            const triesInput = document.getElementById('adminTotalTries');
            if (triesInput) {
                triesInput.value = userData.totalTries === null || userData.totalTries === undefined
                    ? ''
                    : userData.totalTries;
            }
        }

        async function autoSaveAdminPredictions() {
            const username = adminPredictionUsername;
            if (!username || !users[username]) return;

            const triesInput = document.getElementById('adminTotalTries');
            const totalTries = triesInput ? triesInput.value : '';
            const newTries = totalTries === '' ? null : parseInt(totalTries, 10);

            users[username].totalTries = newTries;
            await Storage.savePredictions(username, users[username].predictions || {}, newTries);
        }

        async function saveAdminTournamentTries() {
            await autoSaveAdminPredictions();
            alert('Tournament tries saved.');
        }

        // Render matches
        function renderMatches() {
            const container = document.getElementById('matchesContainer');
            let currentRound = 0;
            let html = '';
            
            // Show lock status banner at top
            if (appSettings.predictionsLocked) {
                html += '<div class="lock-banner">🔒 Predictions are LOCKED. You cannot make changes.</div>';
            } else {
                html += '<div class="unlock-banner">🔓 Predictions are OPEN. Click Edit then Save to submit each scoreline.</div>';
            }

            // Always show checklist so missing scores/joker/tries are explicit.
            html += renderPredictionChecklist(currentUsername);

            const matchesByRound = new Map();
            matches.forEach(match => {
                const round = match.round || 0;
                if (!matchesByRound.has(round)) matchesByRound.set(round, []);
                matchesByRound.get(round).push(match);
            });

            matchesByRound.forEach((roundMatches, round) => {
                currentRound = round;
                html += `<h2 style="font-family: 'Bebas Neue', cursive; font-size: 1.8rem; color: var(--bright-gold); margin: 1.25rem 0 0.6rem 0; letter-spacing: 0.1em;">Round ${currentRound}</h2>`;
                html += `
                    <div class="results-table-container prediction-table-container">
                        <table class="results-table prediction-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Fixture</th>
                                    <th>Scores</th>
                                    <th>Points</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                roundMatches.forEach(match => {

                const isJoker = isUserJokerForMatch(currentUsername, match.id);
                const isMatchCompleted = match.actualScore1 !== null && match.actualScore2 !== null;
                const userPrediction = users[currentUsername] && users[currentUsername].predictions
                    ? users[currentUsername].predictions[match.id]
                    : null;
                const pointsBreakdown = isMatchCompleted
                    ? getMatchPointsBreakdown(userPrediction, match, isJoker)
                    : { points: 0, summary: '' };
                const pointsPill = isMatchCompleted
                    ? `<span class="capture-status captured" title="${pointsBreakdown.summary || 'No points awarded'}">Pts: ${pointsBreakdown.points}</span>`
                    : '';
                const jokerSuffix = isJoker ? ` <span class="joker-indicator">JOKER</span>` : '';

                html += `
                    <tr class="${isJoker ? 'joker-selected' : ''}" id="match-card-${match.id}">
                        <td>${match.date}</td>
                        <td>${getCompactFixtureLabel(match)}</td>
                        <td class="prediction-scores-cell">Predicted: ${userPrediction ? `${userPrediction.team1}-${userPrediction.team2}` : '--'}, Actual: ${isMatchCompleted ? `${match.actualScore1}-${match.actualScore2}` : '--'}${jokerSuffix}</td>
                        <td>${pointsPill}</td>
                        <td class="prediction-actions-cell">
                            <button class="btn-small btn-success" onclick="openEditPredictionModal('self', ${match.id})">Edit</button>
                        </td>
                    </tr>
                `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });

            container.innerHTML = html;
            
            // Also disable/enable tries input
            const triesInput = document.getElementById('totalTries');
            const triesSaveBtn = document.getElementById('saveTriesBtn');
            
            if (triesInput) {
                triesInput.disabled = appSettings.predictionsLocked;
                triesInput.style.opacity = appSettings.predictionsLocked ? '0.6' : '1';
                triesInput.style.cursor = appSettings.predictionsLocked ? 'not-allowed' : '';
            }
            if (triesSaveBtn) {
                triesSaveBtn.disabled = appSettings.predictionsLocked;
                triesSaveBtn.style.opacity = appSettings.predictionsLocked ? '0.6' : '1';
                triesSaveBtn.style.cursor = appSettings.predictionsLocked ? 'not-allowed' : '';
            }
            
        }

        // Save tries prediction on blur
        async function autoSavePredictions() {
            if (appSettings.predictionsLocked) return;

            const totalTriesInput = document.getElementById('totalTries');
            const totalTries = totalTriesInput ? totalTriesInput.value : '';
            const newTries = totalTries === '' ? null : parseInt(totalTries, 10);

            users[currentUsername].totalTries = newTries;
            await Storage.savePredictions(currentUsername, users[currentUsername].predictions || {}, newTries);
            
            // Update the outstanding banner in real time
            updateOutstandingBanner();
            renderMatches();
        }

        async function saveTournamentTries() {
            if (appSettings.predictionsLocked) return;
            await autoSavePredictions();
            alert('Tournament tries saved.');
        }
        
        // Update the outstanding predictions banner
        function updateOutstandingBanner() {
            const banner = document.getElementById('outstandingBanner');
            if (!banner) return;
            
            const { outstandingCount, hasTries } = getOutstandingPredictionStatus(currentUsername);
            const checklist = getPredictionChecklistStatus(currentUsername);
            
            if (appSettings.predictionsLocked || (outstandingCount === 0 && hasTries && checklist.jokerComplete)) {
                banner.style.display = 'none';
                return;
            }
            
            banner.style.display = 'flex';
            const parts = [];
            if (outstandingCount > 0 || !hasTries) {
                parts.push(buildOutstandingBannerText(outstandingCount, hasTries));
            }
            if (!checklist.jokerComplete) {
                parts.push(`<span class="outstanding-banner-count">Jokers</span> ${checklist.jokerSelectedCount}/${checklist.jokerRequiredCount} selected`);
            }
            banner.querySelector('.outstanding-banner-text').innerHTML = parts.join(' | ');
        }

        // Save predictions
        // Load predictions
        function loadPredictions() {
            const userData = users[currentUsername];
            const triesInput = document.getElementById('totalTries');
            if (!triesInput || !userData) return;

            if (userData.totalTries === null || userData.totalTries === undefined) {
                triesInput.value = '';
            } else {
                triesInput.value = userData.totalTries;
            }
        }
