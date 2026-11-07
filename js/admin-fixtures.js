// Admin: fixtures, bulk import, results entry
// Classic script (shared global scope); load order is set in index.html.

        // Render admin matches for entering results
        function renderAdminMatches() {
            renderReadinessChecklist();
            const container = document.getElementById('adminMatchesContainer');
            if (!container) return;
            updateNextMatchScoreButtonState();

            if (matches.length === 0) {
                container.innerHTML = `<tr><td colspan="5" style="text-align:center; opacity:0.8;">No fixtures configured yet.</td></tr>`;
                return;
            }

            const toScoreText = (match) => {
                if (match.actualScore1 === null || match.actualScore2 === null) return 'Pending';
                return `${getTeamAbbr(match.team1)} ${match.actualScore1} - ${match.actualScore2} ${getTeamAbbr(match.team2)}`;
            };

            const hasScoreSaved = (match) =>
                match.actualScore1 !== null &&
                match.actualScore2 !== null;

            container.innerHTML = matches.map(match => `
                <tr class="fixture-row-readonly" onclick="openEditFixtureModal(${match.id})">
                    <td>${match.round || '-'}</td>
                    <td>${getFlag(match.team1)} ${getTeamAbbr(match.team1)} vs ${getFlag(match.team2)} ${getTeamAbbr(match.team2)}</td>
                    <td>${match.date || 'TBD'}${match.time ? ` ${match.time}` : ''}</td>
                    <td>
                        <span class="capture-status ${hasScoreSaved(match) ? 'captured' : 'pending'}">
                            ${toScoreText(match)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-small btn-success" onclick="event.stopPropagation(); openEditFixtureModal(${match.id})">Edit</button>
                        <button class="btn-small btn-danger" onclick="event.stopPropagation(); deleteMatch(${match.id})">Remove</button>
                    </td>
                </tr>
            `).join('');
        }

        function openEditFixtureModal(matchId) {
            const match = (pendingNewMatch && pendingNewMatch.id === matchId)
                ? pendingNewMatch
                : matches.find(m => m.id === matchId);
            const modal = document.getElementById('editFixtureModal');
            if (!match || !modal) return;

            editingFixtureId = matchId;
            const teams = ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'];

            const team1Select = document.getElementById('edit-fixture-team1');
            const team2Select = document.getElementById('edit-fixture-team2');
            if (team1Select && team2Select) {
                const teamOptions = teams.map(t => `<option value="${t}">${getFlag(t)} ${t}</option>`).join('');
                team1Select.innerHTML = teamOptions;
                team2Select.innerHTML = teamOptions;
                team1Select.value = match.team1 || 'England';
                team2Select.value = match.team2 || 'France';
            }

            document.getElementById('edit-fixture-round').value = match.round || 1;
            document.getElementById('edit-fixture-date').value = parseDateForInput(match.date || '');
            document.getElementById('edit-fixture-time').value = (match.time && match.time !== 'TBD') ? match.time : '';
            document.getElementById('edit-fixture-score1').value = match.actualScore1 !== null ? match.actualScore1 : '';
            document.getElementById('edit-fixture-score2').value = match.actualScore2 !== null ? match.actualScore2 : '';
            document.getElementById('edit-fixture-tries1').value = match.actualTries1 !== null ? match.actualTries1 : '';
            document.getElementById('edit-fixture-tries2').value = match.actualTries2 !== null ? match.actualTries2 : '';
            document.getElementById('edit-fixture-joker').checked = !!match.jokerEligible;

            modal.classList.remove('hidden');
        }

        function closeEditFixtureModal() {
            editingFixtureId = null;
            pendingNewMatch = null;   // Cancel discards a fixture that was being added
            const modal = document.getElementById('editFixtureModal');
            if (modal) modal.classList.add('hidden');
        }

        function hasMatchScore(match) {
            return !!match &&
                match.actualScore1 !== null &&
                match.actualScore2 !== null;
        }

        function getNextMatchWithoutScore() {
            return matches.find(match => !hasMatchScore(match)) || null;
        }

        function getMatchKickoffDate(match) {
            if (!match || !match.date) return null;

            const isoDate = parseDateForInput(match.date);
            if (!isoDate) return null;

            const timeValue = match.time && /^\d{2}:\d{2}$/.test(match.time) ? match.time : '00:00';
            const kickoff = new Date(`${isoDate}T${timeValue}:00`);
            return Number.isNaN(kickoff.getTime()) ? null : kickoff;
        }

        function isMatchInQuickScoreWindow(match, now = new Date()) {
            const kickoff = getMatchKickoffDate(match);
            if (!kickoff) return false;

            const elapsedMs = now.getTime() - kickoff.getTime();
            return elapsedMs >= 0 && elapsedMs < 2 * 60 * 60 * 1000;
        }

        function getQuickScoreEntryMatch() {
            const now = new Date();
            const recentMatch = matches
                .filter(match => isMatchInQuickScoreWindow(match, now))
                .sort((a, b) => getMatchKickoffDate(b).getTime() - getMatchKickoffDate(a).getTime())[0];

            if (recentMatch) return recentMatch;
            return matches.find(match => !hasMatchScore(match) && isMatchDueTodayOrPast(match)) || null;
        }

        function isMatchDueTodayOrPast(match) {
            if (!match || !match.date) return false;
            const isoDate = parseDateForInput(match.date);
            if (!isoDate) return false;

            const matchDay = new Date(`${isoDate}T00:00:00`);
            if (Number.isNaN(matchDay.getTime())) return false;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return matchDay.getTime() <= today.getTime();
        }

        function updateNextMatchScoreButtonState() {
            const btn = document.getElementById('nextMatchScoreMainBtn');
            if (!btn) return;
            const actionRow = btn.closest('.admin-top-action-row');
            const nextMatch = getQuickScoreEntryMatch();
            const shouldShowQuickAdd = !!nextMatch;

            if (actionRow) {
                if (isCurrentUserAdmin() && shouldShowQuickAdd) {
                    actionRow.classList.remove('hidden');
                } else {
                    actionRow.classList.add('hidden');
                }
            }

            if (!nextMatch || !shouldShowQuickAdd) {
                btn.disabled = true;
                return;
            }

            btn.disabled = false;
            const actionLabel = hasMatchScore(nextMatch) ? 'Game In Play - Update' : 'Add';
            btn.textContent = `${actionLabel} ${getFlag(nextMatch.team1)} ${getTeamAbbr(nextMatch.team1)} v ${getFlag(nextMatch.team2)} ${getTeamAbbr(nextMatch.team2)} Score`;
        }

        function openNextMatchScoreModal() {
            if (!isCurrentUserAdmin()) return;
            const nextMatch = getQuickScoreEntryMatch();
            if (!nextMatch) {
                updateNextMatchScoreButtonState();
                return;
            }

            nextMatchScoreId = nextMatch.id;
            const fixtureText = `${nextMatch.date || 'TBD'} ${nextMatch.time || ''} - ${nextMatch.team1} vs ${nextMatch.team2}`.trim();
            const fixtureEl = document.getElementById('nextMatchScoreFixture');
            if (fixtureEl) fixtureEl.textContent = fixtureText;

            const homeScoreLabel = document.getElementById('nextMatchHomeScoreLabel');
            const awayScoreLabel = document.getElementById('nextMatchAwayScoreLabel');
            const homeTriesLabel = document.getElementById('nextMatchHomeTriesLabel');
            const awayTriesLabel = document.getElementById('nextMatchAwayTriesLabel');
            if (homeScoreLabel) homeScoreLabel.textContent = `${nextMatch.team1} Score`;
            if (awayScoreLabel) awayScoreLabel.textContent = `${nextMatch.team2} Score`;
            if (homeTriesLabel) homeTriesLabel.textContent = `${nextMatch.team1} Tries`;
            if (awayTriesLabel) awayTriesLabel.textContent = `${nextMatch.team2} Tries`;

            document.getElementById('nextMatchHomeScore').value = nextMatch.actualScore1 !== null ? nextMatch.actualScore1 : '';
            document.getElementById('nextMatchAwayScore').value = nextMatch.actualScore2 !== null ? nextMatch.actualScore2 : '';
            document.getElementById('nextMatchHomeTries').value = nextMatch.actualTries1 !== null ? nextMatch.actualTries1 : '';
            document.getElementById('nextMatchAwayTries').value = nextMatch.actualTries2 !== null ? nextMatch.actualTries2 : '';

            const modal = document.getElementById('nextMatchScoreModal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeNextMatchScoreModal() {
            nextMatchScoreId = null;
            const modal = document.getElementById('nextMatchScoreModal');
            if (modal) modal.classList.add('hidden');
        }

        async function saveNextMatchScore() {
            if (!isCurrentUserAdmin()) return;
            if (nextMatchScoreId === null) return;
            const match = matches.find(m => m.id === nextMatchScoreId);
            if (!match) return;

            const homeScoreRaw = document.getElementById('nextMatchHomeScore').value;
            const awayScoreRaw = document.getElementById('nextMatchAwayScore').value;
            const homeTriesRaw = document.getElementById('nextMatchHomeTries').value;
            const awayTriesRaw = document.getElementById('nextMatchAwayTries').value;

            const parseRequiredNonNegativeInt = (rawValue, fieldLabel) => {
                if (rawValue === '') throw new Error(`${fieldLabel} is required.`);
                const parsed = Number(rawValue);
                if (!Number.isInteger(parsed) || parsed < 0) {
                    throw new Error(`${fieldLabel} must be a whole number of 0 or more.`);
                }
                return parsed;
            };

            let homeScore;
            let awayScore;
            let homeTries;
            let awayTries;
            try {
                homeScore = parseRequiredNonNegativeInt(homeScoreRaw, `${match.team1} score`);
                awayScore = parseRequiredNonNegativeInt(awayScoreRaw, `${match.team2} score`);
                homeTries = parseRequiredNonNegativeInt(homeTriesRaw, `${match.team1} tries`);
                awayTries = parseRequiredNonNegativeInt(awayTriesRaw, `${match.team2} tries`);
            } catch (error) {
                alert(error.message);
                return;
            }

            if (homeTries > homeScore || awayTries > awayScore) {
                alert('Tries cannot exceed points scored for a team.');
                return;
            }

            match.actualScore1 = homeScore;
            match.actualScore2 = awayScore;
            match.actualTries1 = homeTries;
            match.actualTries2 = awayTries;

            await Storage.saveMatches(matches, { skipUsageLog: true });
            await Storage.trackUsageEvent(getUsageActor(), 'save quick score update', formatUsagePayload({
                matchId: match.id,
                team1: match.team1,
                team2: match.team2,
                actualScore1: homeScore,
                actualScore2: awayScore,
                actualTries1: homeTries,
                actualTries2: awayTries
            }));
            closeNextMatchScoreModal();
            renderAdminMatches();
            updateLeaderboard();
            await refreshMatchSummaryAfterScoreSave();
        }

        async function saveFixtureEdits() {
            if (editingFixtureId === null) return;
            const isNewFixture = !!pendingNewMatch && pendingNewMatch.id === editingFixtureId;
            const match = isNewFixture ? pendingNewMatch : matches.find(m => m.id === editingFixtureId);
            if (!match) return;

            const roundVal = parseInt(document.getElementById('edit-fixture-round').value, 10);
            const dateVal = document.getElementById('edit-fixture-date').value;
            const timeVal = (document.getElementById('edit-fixture-time').value || '').trim();
            const team1Val = document.getElementById('edit-fixture-team1').value;
            const team2Val = document.getElementById('edit-fixture-team2').value;
            const score1Val = document.getElementById('edit-fixture-score1').value;
            const score2Val = document.getElementById('edit-fixture-score2').value;
            const tries1Val = document.getElementById('edit-fixture-tries1').value;
            const tries2Val = document.getElementById('edit-fixture-tries2').value;
            const jokerVal = document.getElementById('edit-fixture-joker').checked;

            if (!roundVal || roundVal < 1) {
                alert('Round must be at least 1.');
                return;
            }
            if (!team1Val || !team2Val) {
                alert('Home and away teams are required.');
                return;
            }
            if (team1Val === team2Val) {
                alert('Home and away teams cannot be the same.');
                return;
            }
            if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                alert('Date must be in YYYY-MM-DD format.');
                return;
            }
            if (timeVal && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeVal)) {
                alert('Time must be in HH:MM 24-hour format.');
                return;
            }

            const parseOptionalNonNegativeInt = (rawValue, fieldLabel) => {
                if (rawValue === '') return null;
                const parsed = Number(rawValue);
                if (!Number.isInteger(parsed) || parsed < 0) {
                    throw new Error(`${fieldLabel} must be a whole number of 0 or more.`);
                }
                return parsed;
            };

            let parsedScore1;
            let parsedScore2;
            let parsedTries1;
            let parsedTries2;
            try {
                parsedScore1 = parseOptionalNonNegativeInt(score1Val, 'Home score');
                parsedScore2 = parseOptionalNonNegativeInt(score2Val, 'Away score');
                parsedTries1 = parseOptionalNonNegativeInt(tries1Val, 'Home tries');
                parsedTries2 = parseOptionalNonNegativeInt(tries2Val, 'Away tries');
            } catch (validationError) {
                alert(validationError.message);
                return;
            }

            const hasAnyResultValue = [parsedScore1, parsedScore2, parsedTries1, parsedTries2].some(v => v !== null);
            const hasAllResultValues = [parsedScore1, parsedScore2, parsedTries1, parsedTries2].every(v => v !== null);
            if (hasAnyResultValue && !hasAllResultValues) {
                alert('Please enter Home/Away score and Home/Away tries together, or leave all four blank.');
                return;
            }
            if (hasAllResultValues) {
                if (parsedScore1 < parsedTries1 * 5) {
                    alert('Home score looks too low for the number of home tries entered.');
                    return;
                }
                if (parsedScore2 < parsedTries2 * 5) {
                    alert('Away score looks too low for the number of away tries entered.');
                    return;
                }
            }

            match.round = roundVal;
            match.team1 = team1Val;
            match.team2 = team2Val;
            // Preserve existing date/time unless the admin explicitly changes them.
            match.date = dateVal
                ? formatDateForDisplay(dateVal)
                : (match.date || 'TBD');
            match.time = timeVal || match.time || 'TBD';
            match.jokerEligible = jokerVal;

            match.actualScore1 = parsedScore1;
            match.actualScore2 = parsedScore2;
            match.actualTries1 = parsedTries1;
            match.actualTries2 = parsedTries2;

            // Saving a new fixture is what adds its row
            if (isNewFixture) {
                matches.push(match);
                pendingNewMatch = null;
            }

            await Storage.saveMatches(matches, { skipUsageLog: true });
            await Storage.trackUsageEvent(getUsageActor(), 'save fixture edit', formatUsagePayload({
                matchId: match.id,
                round: match.round,
                date: match.date,
                time: match.time,
                team1: match.team1,
                team2: match.team2,
                jokerEligible: match.jokerEligible,
                actualScore1: match.actualScore1,
                actualScore2: match.actualScore2,
                actualTries1: match.actualTries1,
                actualTries2: match.actualTries2
            }));
            closeEditFixtureModal();
            updateChallengeSubtitleYear();
            renderAdminMatches();
            renderMatches();
            await refreshMatchSummaryAfterScoreSave();
        }

        // Parse a display date (e.g., "Sat, Feb 7") to ISO format for date input (e.g., "2026-02-07")
        function parseDateForInput(dateStr) {
            if (!dateStr || dateStr === 'TBD') return '';
            // Already ISO format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

            const monthLookup = {
                jan: 1, january: 1,
                feb: 2, february: 2,
                mar: 3, march: 3,
                apr: 4, april: 4,
                may: 5,
                jun: 6, june: 6,
                jul: 7, july: 7,
                aug: 8, august: 8,
                sep: 9, sept: 9, september: 9,
                oct: 10, october: 10,
                nov: 11, november: 11,
                dec: 12, december: 12
            };

            const toIsoIfValid = (year, month, day) => {
                const y = Number(year);
                const m = Number(month);
                const d = Number(day);
                const candidate = new Date(y, m - 1, d);
                if (
                    Number.isNaN(candidate.getTime()) ||
                    candidate.getFullYear() !== y ||
                    candidate.getMonth() !== m - 1 ||
                    candidate.getDate() !== d
                ) {
                    return '';
                }
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            };

            const normalized = String(dateStr).trim().replace(/\s+/g, ' ');
            const withoutWeekday = normalized.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+/i, '');

            const slashMatch = withoutWeekday.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (slashMatch) {
                return toIsoIfValid(slashMatch[3], slashMatch[2], slashMatch[1]);
            }

            const monthDayMatch = withoutWeekday.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
            if (monthDayMatch) {
                const month = monthLookup[monthDayMatch[1].toLowerCase()];
                const day = monthDayMatch[2];
                const year = monthDayMatch[3] || String(selectedYear || 2026);
                if (month) return toIsoIfValid(year, month, day);
            }

            const dayMonthMatch = withoutWeekday.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
            if (dayMonthMatch) {
                const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                const day = dayMonthMatch[1];
                const year = dayMonthMatch[3] || String(selectedYear || 2026);
                if (month) return toIsoIfValid(year, month, day);
            }

            return '';
        }

        // Format ISO date (e.g., "2026-02-07") to display format (e.g., "Sat, Feb 7")
        function formatDateForDisplay(isoDate) {
            if (!isoDate) return 'TBD';
            
            const date = new Date(isoDate + 'T12:00:00');
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            const dayName = days[date.getDay()];
            const monthName = months[date.getMonth()];
            const dayNum = date.getDate();
            
            return `${dayName}, ${monthName} ${dayNum}`;
        }

        // Add a new match
        async function addNewMatch() {
            // Ids are unique across all years
            const nextId = getNextMatchId();
            // Find the highest round
            const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;
            
            const newMatch = {
                id: nextId,
                round: maxRound,
                date: 'TBD',
                time: '15:00',
                team1: 'England',
                team2: 'France',
                actualScore1: null,
                actualScore2: null,
                actualTries1: null,
                actualTries2: null,
                jokerEligible: false
            };

            // A draft: nothing is added or saved until Save is pressed in the form
            pendingNewMatch = newMatch;
            openEditFixtureModal(newMatch.id);
        }

        // Delete a match
        async function deleteMatch(matchId) {
            const match = matches.find(m => m.id === matchId);
            if (!match) return;
            
            if (!confirm(`Are you sure you want to delete this fixture?\n\n${match.team1} vs ${match.team2}\n${match.date} at ${match.time}\n\nThis cannot be undone.`)) {
                return;
            }
            
            // Remove the match
            const index = matches.findIndex(m => m.id === matchId);
            if (index > -1) {
                matches.splice(index, 1);
                await Storage.saveMatches(matches);
                renderAdminMatches();
                renderMatches();
                updateLeaderboard();
            }
        }

        // Clear all fixtures
        async function clearAllFixtures() {
            if (!confirm('Are you sure you want to remove ALL fixtures? This cannot be undone.')) {
                return;
            }
            if (!confirm(`This will delete all fixtures for ${selectedYear}. Are you really sure?`)) {
                return;
            }
            
            matches.length = 0;
            await Storage.saveMatches(matches);
            renderAdminMatches();
            renderMatches();
            showSummary();
            alert('All fixtures have been removed.');
        }

        // Show bulk import modal
        function showBulkImport() {
            document.getElementById('bulkImportModal').classList.remove('hidden');
            document.getElementById('bulkImportData').value = '';
            document.getElementById('bulkImportData').focus();
        }

        // Close bulk import modal
        function closeBulkImport() {
            document.getElementById('bulkImportModal').classList.add('hidden');
        }

        // Process bulk import data
        async function processBulkImport() {
            const data = document.getElementById('bulkImportData').value.trim();
            
            if (!data) {
                alert('Please enter fixture data to import.');
                return;
            }
            
            const lines = data.split('\n').filter(line => line.trim());
            const newFixtures = [];
            const errors = [];
            
            // Ids are unique across all years
            let nextId = getNextMatchId();
            
            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                
                if (parts.length < 5) {
                    errors.push(`Line ${index + 1}: Not enough fields (need round, date, time, home team, away team)`);
                    return;
                }
                
                const [roundStr, dateStr, timeStr, homeTeam, awayTeam] = parts;
                
                // Parse round
                const round = parseInt(roundStr);
                if (isNaN(round) || round < 1) {
                    errors.push(`Line ${index + 1}: Invalid round number "${roundStr}"`);
                    return;
                }
                
                // Parse date (DD/MM/YYYY)
                const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (!dateMatch) {
                    errors.push(`Line ${index + 1}: Invalid date format "${dateStr}" (use DD/MM/YYYY)`);
                    return;
                }
                
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                const year = parseInt(dateMatch[3]);
                
                // Validate date
                if (month < 1 || month > 12 || day < 1 || day > 31) {
                    errors.push(`Line ${index + 1}: Invalid date "${dateStr}"`);
                    return;
                }
                
                // Parse time (HH:MM)
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
                if (!timeMatch) {
                    errors.push(`Line ${index + 1}: Invalid time format "${timeStr}" (use HH:MM)`);
                    return;
                }
                
                const hours = parseInt(timeMatch[1]);
                const mins = parseInt(timeMatch[2]);
                
                if (hours < 0 || hours > 23 || mins < 0 || mins > 59) {
                    errors.push(`Line ${index + 1}: Invalid time "${timeStr}"`);
                    return;
                }
                
                // Normalize team names
                const team1 = normalizeTeamName(homeTeam);
                const team2 = normalizeTeamName(awayTeam);
                
                if (!team1) {
                    errors.push(`Line ${index + 1}: Unknown home team "${homeTeam}"`);
                    return;
                }
                
                if (!team2) {
                    errors.push(`Line ${index + 1}: Unknown away team "${awayTeam}"`);
                    return;
                }
                
                if (team1 === team2) {
                    errors.push(`Line ${index + 1}: Home and away teams cannot be the same`);
                    return;
                }
                
                // Format date for display
                const date = new Date(year, month - 1, day);
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const displayDate = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
                
                // Format time
                const displayTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                
                newFixtures.push({
                    id: nextId++,
                    round: round,
                    date: displayDate,
                    time: displayTime,
                    team1: team1,
                    team2: team2,
                    actualScore1: null,
                    actualScore2: null,
                    actualTries1: null,
                    actualTries2: null,
                    jokerEligible: false
                });
            });
            
            // Show errors if any
            if (errors.length > 0) {
                alert('Import errors:\n\n' + errors.join('\n'));
                return;
            }
            
            if (newFixtures.length === 0) {
                alert('No valid fixtures found to import.');
                return;
            }
            
            // Confirm and import
            const action = matches.length > 0 
                ? confirm(`Import ${newFixtures.length} fixtures?\n\nClick OK to ADD to existing fixtures, or Cancel then clear fixtures first to replace them.`)
                : true;
            
            if (!action) return;
            
            // Add new fixtures
            newFixtures.forEach(f => matches.push(f));
            
            await Storage.saveMatches(matches);
            closeBulkImport();
            updateChallengeSubtitleYear();
            renderAdminMatches();
            renderMatches();
            showSummary();
            
            alert(`Successfully imported ${newFixtures.length} fixtures.`);
        }

        // Helper to normalize team names from various formats
        function normalizeTeamName(name) {
            const normalized = name.toLowerCase().trim();
            if (normalized.includes('england') || normalized === 'eng') return 'England';
            if (normalized.includes('france') || normalized === 'fra') return 'France';
            if (normalized.includes('ireland') || normalized === 'ire') return 'Ireland';
            if (normalized.includes('italy') || normalized.includes('italia') || normalized === 'ita') return 'Italy';
            if (normalized.includes('scotland') || normalized === 'sco') return 'Scotland';
            if (normalized.includes('wales') || normalized === 'wal') return 'Wales';
            return null;
        }

        // Auto-save match results on blur
        async function autoSaveResults() {
            matches.forEach(match => {
                // Get all editable fields
                const roundEl = document.getElementById(`round-${match.id}`);
                const team1SelectEl = document.getElementById(`team1-select-${match.id}`);
                const team2SelectEl = document.getElementById(`team2-select-${match.id}`);
                const dateEl = document.getElementById(`date-${match.id}`);
                const timeEl = document.getElementById(`time-${match.id}`);
                const team1ScoreEl = document.getElementById(`actual-team1-${match.id}`);
                const team2ScoreEl = document.getElementById(`actual-team2-${match.id}`);
                const team1TriesEl = document.getElementById(`actual-tries1-${match.id}`);
                const team2TriesEl = document.getElementById(`actual-tries2-${match.id}`);
                const jokerEligibleEl = document.getElementById(`joker-eligible-${match.id}`);

                // Update fixture details
                if (roundEl) match.round = parseInt(roundEl.value) || 1;
                if (jokerEligibleEl) match.jokerEligible = jokerEligibleEl.checked;
                if (team1SelectEl) match.team1 = team1SelectEl.value;
                if (team2SelectEl) match.team2 = team2SelectEl.value;
                
                // Convert date input to display format
                if (dateEl) {
                    if (dateEl.value) {
                        match.date = formatDateForDisplay(dateEl.value);
                    } else if (!match.date) {
                        match.date = 'TBD';
                    }
                }
                
                // Store time in HH:MM format
                if (timeEl && timeEl.value) {
                    match.time = timeEl.value;
                } else if (timeEl && !match.time) {
                    match.time = 'TBD';
                }
                
                if (!team1ScoreEl || !team2ScoreEl) return;
                
                const team1Score = team1ScoreEl.value;
                const team2Score = team2ScoreEl.value;
                const team1Tries = team1TriesEl ? team1TriesEl.value : '';
                const team2Tries = team2TriesEl ? team2TriesEl.value : '';
                
                // Only save scores if both scores AND both tries are entered
                if (team1Score !== '' && team2Score !== '' && team1Tries !== '' && team2Tries !== '') {
                    match.actualScore1 = parseInt(team1Score);
                    match.actualScore2 = parseInt(team2Score);
                    match.actualTries1 = parseInt(team1Tries);
                    match.actualTries2 = parseInt(team2Tries);
                } else {
                    // Clear the result if incomplete
                    match.actualScore1 = null;
                    match.actualScore2 = null;
                    match.actualTries1 = null;
                    match.actualTries2 = null;
                }
            });

            // Save to storage
            await Storage.saveMatches(matches);
            updateChallengeSubtitleYear();
            
            // Update saved indicators
            updateResultSavedIndicators();

            // Recalculate all points
            updateLeaderboard();
        }

        // Update the saved tick indicators for match results
        function updateResultSavedIndicators() {
            matches.forEach(match => {
                const indicator = document.getElementById(`result-saved-${match.id}`);
                if (indicator) {
                    const isComplete = match.actualScore1 !== null && 
                                      match.actualScore2 !== null && 
                                      match.actualTries1 !== null && 
                                      match.actualTries2 !== null;
                    if (isComplete) {
                        indicator.textContent = '✓';
                        indicator.classList.add('visible');
                    } else {
                        indicator.textContent = '';
                        indicator.classList.remove('visible');
                    }
                }
            });
        }
