// Years: loading, switching, admin Years tab, readiness checklist, who is playing
// Classic script (shared global scope); load order is set in index.html.

        // ============================================
        // YEARS
        // ============================================
        // Fixtures, predictions, jokers, tries, scoring rules and the prediction lock all belong to a
        // year. `matches` always holds the selected year's fixtures; users/predictions/jokers/rules
        // are loaded for that year only.
        function buildAvailableYears(seasonYears) {
            const years = new Set((seasonYears || []).map(Number).filter(Number.isInteger));
            allMatches.forEach(m => { if (Number.isInteger(m.year)) years.add(m.year); });
            if (years.size === 0) years.add(2026);
            return [...years].sort((a, b) => a - b);
        }

        function pickInitialYear() {
            let stored = null;
            try {
                stored = parseInt(localStorage.getItem(SELECTED_YEAR_KEY), 10);
            } catch (error) {
                stored = null;
            }
            if (Number.isInteger(stored) && availableYears.includes(stored)) return stored;

            // Default to the latest year that has fixtures, so a newly added empty year is not the landing page
            const yearsWithFixtures = availableYears.filter(year => allMatches.some(m => m.year === year));
            const candidates = yearsWithFixtures.length > 0 ? yearsWithFixtures : availableYears;
            return candidates[candidates.length - 1];
        }

        // Point `matches` at the selected year's fixtures (mutated in place: it is a const array)
        function applySelectedYearMatches() {
            let yearMatches = allMatches.filter(m => m.year === selectedYear);
            if (allMatches.length === 0 && selectedYear === 2026) {
                yearMatches = DEFAULT_FIXTURES.map(m => ({ ...m }));
            }
            matches.length = 0;
            yearMatches.forEach(m => matches.push(m));
        }

        // Next fixture id, unique across all years (ids are a single global sequence)
        function getNextMatchId() {
            const ids = [...allMatches.map(m => m.id), ...matches.map(m => m.id)];
            return (ids.length > 0 ? Math.max(...ids) : 0) + 1;
        }

        // Load everything that depends on the selected year
        // When the data on screen was last fetched (the full-screen app has no reload button)
        let lastDataRefreshAt = Date.now();
        let summaryRefreshInFlight = false;
        const FOREGROUND_REFRESH_AFTER_MS = 5 * 60 * 1000;

        function updateSummaryUpdatedAt() {
            const el = document.getElementById('summaryUpdatedAt');
            if (el) el.textContent = 'Updated ' + new Date(lastDataRefreshAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }

        async function manualRefreshSummary() {
            if (summaryRefreshInFlight) return;
            const button = document.getElementById('summaryRefreshBtn');
            summaryRefreshInFlight = true;
            if (button) { button.disabled = true; button.classList.add('refreshing'); button.setAttribute('aria-label', 'Refreshing'); }
            try {
                await refreshSummaryData();
            } finally {
                summaryRefreshInFlight = false;
                if (button) { button.disabled = false; button.classList.remove('refreshing'); button.setAttribute('aria-label', 'Refresh'); }
            }
        }

        // Coming back to the app after a while: refresh the scores, but only on the summary so that
        // nobody's half-typed predictions are disturbed. Other tabs refresh when you open the summary.
        function refreshWhenReturning() {
            if (document.visibilityState !== 'visible' || isLoading || summaryRefreshInFlight) return;
            if (Date.now() - lastDataRefreshAt < FOREGROUND_REFRESH_AFTER_MS) return;
            const appView = document.getElementById('appView');
            const summaryTab = document.getElementById('summaryTab');
            if (!appView || appView.classList.contains('hidden') || !summaryTab || summaryTab.classList.contains('hidden')) return;
            manualRefreshSummary();
        }

        async function loadYearData() {
            if (tourDemoActive) return;   // the guided tour is showing example data
            applySelectedYearMatches();
            const [loadedUsers, loadedSettings, loadedRules, loadedJokerSelections, loadedChat] = await Promise.all([
                Storage.getUsers(),
                Storage.getSettings(),
                Storage.getActiveScoringRules(),
                Storage.getUserJokerSelections(),
                Storage.getFixtureChat(matches.map(m => m.id))
            ]);
            fixtureChat = loadedChat;
            users = loadedUsers;
            appSettings = loadedSettings;
            activeScoringRules = loadedRules;
            userJokerSelections = loadedJokerSelections;
            updateChallengeSubtitleYear();
            lastDataRefreshAt = Date.now();
            updateSummaryUpdatedAt();
        }

        function renderYearSelect() {
            const select = document.getElementById('yearSelect');
            if (!select) return;
            select.innerHTML = availableYears
                .map(year => `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`)
                .join('');
        }

        async function switchYear(value) {
            const year = parseInt(value, 10);
            if (!availableYears.includes(year) || year === selectedYear) {
                renderYearSelect();
                return;
            }

            showLoadingScreen();
            try {
                selectedYear = year;
                try {
                    localStorage.setItem(SELECTED_YEAR_KEY, String(year));
                } catch (error) {
                    // Ignore storage errors; the choice just won't be remembered.
                }

                // Drop UI state that belongs to the previous year
                rulesFormInitialized = false;
                adminPredictionUsername = null;
                editingFixtureId = null;
                nextMatchScoreId = null;
                editingPredictionContext = null;

                await loadYearData();
            } finally {
                hideLoadingScreen();
            }

            updatePastYearBanners();
            init();
            if (currentUsername && users[currentUsername]) {
                showApp();
            } else {
                showAppAsGuest();
            }
        }

        // ---- Warning for admins changing a year that is over ----
        // (a hook so tests can pretend it is another date)
        function appNow() { return new Date(); }

        // The Six Nations is over by April. Changing a past year, or this year from April on, alters final results.
        function pastYearWarning(year = selectedYear, now = appNow()) {
            const thisYear = now.getFullYear();
            if (year < thisYear) {
                return { level: 'past', text: `You are changing ${year}, a past year. The ${year} Six Nations is over, so changes here alter its final results and leaderboard.` };
            }
            if (year === thisYear && now.getMonth() >= 3) {
                return { level: 'finished', text: `The ${year} Six Nations normally finishes in March. Changes now alter its final results and leaderboard.` };
            }
            return null;
        }

        function updatePastYearBanners() {
            const warning = pastYearWarning();
            document.querySelectorAll('[data-past-year-banner]').forEach(el => {
                if (!warning) {
                    el.className = 'past-year-banner hidden';
                    el.textContent = '';
                    return;
                }
                el.className = `past-year-banner past-year-${warning.level}`;
                el.innerHTML = '<span class="past-year-icon" aria-hidden="true">&#9888;</span><span class="past-year-text"></span>';
                el.querySelector('.past-year-text').textContent = warning.text;
            });
        }

        // ---- Admin: Years tab ----
        function setYearsFeedback(message, type) {
            const feedbackEl = document.getElementById('yearsFeedback');
            if (!feedbackEl) return;
            feedbackEl.textContent = message;
            feedbackEl.className = `login-feedback ${type}`;
        }

        async function renderYearsTab() {
            const container = document.getElementById('yearsListContainer');
            const copySelect = document.getElementById('newYearCopyRules');
            if (!container || !copySelect) return;

            copySelect.innerHTML = availableYears
                .map(year => `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`)
                .join('') + '<option value="">Start with default rules</option>';

            const yearsNewestFirst = [...availableYears].reverse();
            const countsByYear = {};
            await Promise.all(yearsNewestFirst.map(async year => {
                countsByYear[year] = await Storage.getSeasonCounts(year);
            }));

            const rows = yearsNewestFirst.map(year => {
                const yearMatches = allMatches.filter(m => m.year === year);
                const results = yearMatches.filter(m => m.actualScore1 !== null && m.actualScore2 !== null).length;
                const counts = countsByYear[year];
                const hasPredictions = counts.predictions > 0 || counts.tries > 0;
                const hasResults = counts.results > 0;
                const isCurrent = year === selectedYear;
                const predictionsLabel = hasPredictions
                    ? `${counts.predictions} from ${counts.competitors} competitor${counts.competitors !== 1 ? 's' : ''}${counts.tries > 0 ? `, ${counts.tries} tries` : ''}`
                    : 'None';
                return `
                    <tr>
                        <td data-label="Year"><strong>${year}</strong>${isCurrent ? ' <span class="admin-badge">Viewing</span>' : ''}</td>
                        <td data-label="Fixtures">${yearMatches.length}</td>
                        <td data-label="Results entered">${results}</td>
                        <td data-label="Predictions">${predictionsLabel}</td>
                        <td data-label="Actions">
                            <div class="competitor-actions">
                                ${isCurrent ? '' : `<button class="btn-small btn-success" onclick="switchYear(${year})">View</button>`}
                                ${hasResults ? '<span class="profile-hint">Results entered: locked</span>' : ''}
                                ${hasPredictions && !hasResults ? `<button class="btn-small btn-warning" onclick="clearYearPredictions(${year})">Clear predictions</button>` : ''}
                                ${hasPredictions || hasResults ? '' : `<button class="btn-small btn-danger" onclick="removeYear(${year})">Remove</button>`}
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            container.innerHTML = `
                <table class="admin-table admin-table-stack">
                    <thead>
                        <tr><th>Year</th><th>Fixtures</th><th>Results entered</th><th>Predictions</th><th>Actions</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="profile-hint" style="margin-top: 0.75rem;">A year with results entered is locked: it cannot be cleared or removed here. Otherwise a year can only be removed once it has no predictions; use Clear predictions first (fixtures are kept).</p>`;
        }

        async function clearYearPredictions(year) {
            if (!isCurrentUserAdmin()) return;
            const counts = await Storage.getSeasonCounts(year);
            if (counts.results > 0) {
                setYearsFeedback(`${year} has results entered, so its predictions cannot be cleared here.`, 'error');
                return;
            }
            const typed = prompt(
                `Clear all predictions for ${year}?\n\nThis permanently deletes ${counts.predictions} prediction${counts.predictions !== 1 ? 's' : ''} from ` +
                `${counts.competitors} competitor${counts.competitors !== 1 ? 's' : ''}, plus their joker selections and tournament tries for ${year}. ` +
                `Fixtures, results and rules are kept.\n\nThis cannot be undone. Consider exporting a backup from Database Recovery first.\n\nType ${year} to confirm.`
            );
            if (typed === null) return;
            if (typed.trim() !== String(year)) {
                setYearsFeedback('The year you typed did not match, so nothing was cleared.', 'error');
                return;
            }

            const ok = await Storage.clearSeasonPredictions(year);
            if (!ok) {
                setYearsFeedback(`Could not clear predictions for ${year}. Check the console and try again.`, 'error');
                return;
            }

            if (year === selectedYear) {
                await loadYearData();
            }
            await renderYearsTab();
            setYearsFeedback(`Predictions for ${year} cleared.`, 'success');
        }

        async function addYearFromAdmin() {
            if (!isCurrentUserAdmin()) return;
            const year = parseInt(document.getElementById('newYearInput').value, 10);
            const copyFrom = parseInt(document.getElementById('newYearCopyRules').value, 10) || null;

            if (!Number.isInteger(year) || year < 2000 || year > 2100) {
                setYearsFeedback('Please enter a four-digit year, for example 2027.', 'error');
                return;
            }
            if (availableYears.includes(year)) {
                setYearsFeedback(`${year} already exists.`, 'error');
                return;
            }

            const ok = await Storage.addSeason(year, copyFrom);
            if (!ok) {
                setYearsFeedback('Could not add the year. Please try again.', 'error');
                return;
            }

            availableYears = [...availableYears, year].sort((x, y) => x - y);
            document.getElementById('newYearInput').value = '';
            renderYearSelect();
            renderYearsTab();
            setYearsFeedback(`${year} added. Use View to switch to it, then add its fixtures.`, 'success');
        }

        async function removeYear(year) {
            if (!isCurrentUserAdmin()) return;
            if (availableYears.length <= 1) {
                setYearsFeedback('You cannot remove the only year.', 'error');
                return;
            }

            const counts = await Storage.getSeasonCounts(year);
            if (counts.results > 0) {
                setYearsFeedback(`${year} has results entered, so it cannot be removed here.`, 'error');
                return;
            }
            if (counts.predictions > 0 || counts.tries > 0) {
                setYearsFeedback(
                    `${year} still has ${counts.predictions} prediction${counts.predictions !== 1 ? 's' : ''} from ${counts.competitors} competitor${counts.competitors !== 1 ? 's' : ''}. ` +
                    'Clear its predictions before removing the year.',
                    'error'
                );
                return;
            }
            const typed = prompt(
                `Remove ${year}?\n\nThis permanently deletes ${counts.matches} fixture${counts.matches !== 1 ? 's' : ''}, ` +
                `plus that year's scoring and prize rules and prediction lock. Competitors themselves are kept.\n\n` +
                `This cannot be undone. Consider exporting a backup from Database Recovery first.\n\nType ${year} to confirm.`
            );
            if (typed === null) return;
            if (typed.trim() !== String(year)) {
                setYearsFeedback('The year you typed did not match, so nothing was removed.', 'error');
                return;
            }

            const ok = await Storage.removeSeason(year);
            if (!ok) {
                setYearsFeedback(`Could not fully remove ${year}. Check the console and try again.`, 'error');
                return;
            }

            allMatches = allMatches.filter(m => m.year !== year);
            availableYears = availableYears.filter(y => y !== year);

            if (year === selectedYear) {
                const withFixtures = availableYears.filter(y => allMatches.some(m => m.year === y));
                const fallbackYears = withFixtures.length > 0 ? withFixtures : availableYears;
                const fallback = fallbackYears[fallbackYears.length - 1];
                await switchYear(fallback);
                alert(`${year} removed. Now showing ${fallback}.`);
                return;
            }

            renderYearSelect();
            await renderYearsTab();
            setYearsFeedback(`${year} removed.`, 'success');
        }

        // ---- Admin: readiness checklist for the selected year's tournament ----
        const EXPECTED_FIXTURE_COUNT = 15;
        const CHECKLIST_COLLAPSED_KEY = 'rugbyPredictorChecklistCollapsed';

        function isReadinessChecklistCollapsed() {
            try {
                return localStorage.getItem(CHECKLIST_COLLAPSED_KEY) === '1';
            } catch (error) {
                return false;
            }
        }

        function toggleReadinessChecklist() {
            const collapsed = !isReadinessChecklistCollapsed();
            try {
                localStorage.setItem(CHECKLIST_COLLAPSED_KEY, collapsed ? '1' : '0');
            } catch (error) {
                // Ignore storage errors; the choice just won't be remembered.
            }
            renderReadinessChecklist();
        }

        function goToAdminTab(tabName) {
            const button = document.querySelector(`.admin-tabs button[onclick="showTab('${tabName}')"]`);
            if (button) button.click();
        }

        function renderReadinessChecklist() {
            const container = document.getElementById('readinessChecklist');
            if (!container) return;
            if (!isCurrentUserAdmin() || !selectedYear) {
                container.innerHTML = '';
                container.className = 'readiness-checklist hidden';
                return;
            }

            const formatSavedDate = (iso) => {
                const date = new Date(iso);
                return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            };

            // 1. Fixtures
            const fixtureCount = matches.length;
            const fixturesOk = fixtureCount === EXPECTED_FIXTURE_COUNT;
            const fixturesDetail = fixturesOk
                ? `${fixtureCount} of ${EXPECTED_FIXTURE_COUNT} fixtures added`
                : fixtureCount > EXPECTED_FIXTURE_COUNT
                    ? `${fixtureCount} fixtures added, but a tournament has ${EXPECTED_FIXTURE_COUNT}`
                    : `${fixtureCount} of ${EXPECTED_FIXTURE_COUNT} fixtures added`;

            // 2. Predictions: every active competitor must have scores, tries and jokers in
            const activeUsernames = getActiveUsernames();
            const outstanding = activeUsernames
                .map(username => {
                    const status = getPredictionChecklistStatus(username);
                    const missing = [];
                    if (status.pendingPredictions > 0) missing.push(`${status.pendingPredictions} prediction${status.pendingPredictions !== 1 ? 's' : ''}`);
                    if (!status.triesEntered) missing.push('tournament tries');
                    if (!status.jokerComplete) missing.push(`jokers ${status.jokerSelectedCount}/${status.jokerRequiredCount}`);
                    return { username, missing };
                })
                .filter(entry => entry.missing.length > 0)
                .sort((x, y) => getDisplayName(x.username).localeCompare(getDisplayName(y.username)));
            const inactiveCount = Object.keys(users).filter(u => users[u].nickname).length - activeUsernames.length;
            const predictionsOk = activeUsernames.length > 0 && outstanding.length === 0;
            let predictionsDetail;
            if (activeUsernames.length === 0) {
                predictionsDetail = `No competitors are playing in ${selectedYear} yet. Tick Playing on the Competitors screen`;
            } else {
                predictionsDetail = `${activeUsernames.length - outstanding.length} of ${activeUsernames.length} playing competitors have everything in`;
            }
            if (inactiveCount > 0 && activeUsernames.length > 0) {
                predictionsDetail += ` (${inactiveCount} not playing)`;
            }
            const predictionsExtra = outstanding.length === 0 ? '' : `
                <ul class="readiness-outstanding">
                    ${outstanding.map(entry => `<li><strong>${escapeHtml(getDisplayName(entry.username))}</strong>: ${escapeHtml(entry.missing.join(', '))} outstanding</li>`).join('')}
                </ul>`;

            // 3 & 4. Rules and prize fund saved for this year
            const rulesOk = !!appSettings.rulesSavedAt;
            const prizeOk = !!appSettings.prizeSavedAt;
            const savedDetail = (savedAt, ok, what) => ok
                ? `Saved for ${selectedYear}${formatSavedDate(savedAt) ? ` on ${formatSavedDate(savedAt)}` : ''}`
                : `${what} not saved for ${selectedYear} yet. Review and click Save`;

            const items = [
                { ok: fixturesOk, label: 'Fixtures', detail: fixturesDetail, tab: 'results', action: 'Fixtures and Scores' },
                { ok: predictionsOk, label: 'All predictions in', detail: predictionsDetail, extra: predictionsExtra, tab: 'scoreCorrections', action: 'Predictions' },
                { ok: rulesOk, label: 'Guesser rules saved', detail: savedDetail(appSettings.rulesSavedAt, rulesOk, 'Guesser rules'), tab: 'rules', action: 'Guesser Rules' },
                { ok: prizeOk, label: 'Prize fund saved', detail: savedDetail(appSettings.prizeSavedAt, prizeOk, 'Prize fund'), tab: 'prizeFund', action: 'Prize Fund' }
            ];
            const doneCount = items.filter(item => item.ok).length;
            const allDone = doneCount === items.length;

            // Nothing outstanding: nothing to show. It comes back as soon as a step is outstanding again.
            if (allDone) {
                container.innerHTML = '';
                container.className = 'readiness-checklist hidden';
                return;
            }

            const collapsed = isReadinessChecklistCollapsed();
            container.className = `readiness-checklist${collapsed ? ' collapsed' : ''}`;
            container.innerHTML = `
                <div class="readiness-header" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}"
                     onclick="toggleReadinessChecklist()"
                     onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleReadinessChecklist(); }">
                    <div>
                        <div class="readiness-title">Ready for ${selectedYear}?</div>
                        <div class="readiness-summary">${doneCount} of ${items.length} steps done</div>
                    </div>
                    <span class="readiness-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
                </div>
                ${collapsed ? '' : items.map(item => `
                    <div class="readiness-item ${item.ok ? 'ok' : 'todo'}">
                        <span class="readiness-icon">${item.ok ? '✓' : ''}</span>
                        <div class="readiness-text">
                            <div class="readiness-label">${item.label}</div>
                            <div class="readiness-detail">${escapeHtml(item.detail)}</div>
                            ${item.extra || ''}
                        </div>
                        ${item.ok ? '' : `<button class="btn-small" onclick="goToAdminTab('${item.tab}')">${item.action}</button>`}
                    </div>`).join('')}`;
        }

        // Is this competitor playing in the selected year? An explicit setting on the Competitors screen
        // wins; otherwise they count as playing once they have made a prediction that year.
        function isCompetitorActive(username) {
            const overrides = appSettings.activeOverrides || {};
            if (Object.prototype.hasOwnProperty.call(overrides, username)) return !!overrides[username];
            return Object.keys((users[username] && users[username].predictions) || {}).length > 0;
        }

        function getActiveUsernames() {
            return Object.keys(users).filter(isCompetitorActive);
        }

        async function toggleCompetitorActive(username, active) {
            if (!isCurrentUserAdmin() || !users[username]) return;
            const previous = { ...(appSettings.activeOverrides || {}) };
            const next = { ...previous, [username]: !!active };
            appSettings.activeOverrides = next;
            const ok = await Storage.saveActiveOverrides(next);
            if (!ok) {
                appSettings.activeOverrides = previous;
                alert('Could not save that change. Please try again.');
                renderCompetitorManagement();
                return;
            }
            renderReadinessChecklist();
        }

        // Is this competitor outside the prize fund this year (they have not paid)? Set on the Competitors screen.
        function isPrizeExempt(username) {
            return !!(appSettings.prizeExempt && appSettings.prizeExempt[username]);
        }

        async function toggleCompetitorPrizeExempt(username, exempt) {
            if (!isCurrentUserAdmin() || !users[username]) return;
            const previous = { ...(appSettings.prizeExempt || {}) };
            const next = { ...previous };
            if (exempt) next[username] = true; else delete next[username];
            appSettings.prizeExempt = next;
            const ok = await Storage.savePrizeExempt(next);
            if (!ok) {
                appSettings.prizeExempt = previous;
                alert('Could not save that change. Please try again.');
            }
            renderCompetitorManagement();
        }

        // Competitors who have made predictions in the selected year (predictions are loaded per year)
        function getParticipantUsernames() {
            return Object.keys(users).filter(username => Object.keys(users[username].predictions || {}).length > 0);
        }
