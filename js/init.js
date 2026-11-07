// Data initialisation, init(), predictions lock toggle
// Classic script (shared global scope); load order is set in index.html.

        // Initialize data from supabaseClient
        async function initializeData() {
            try {
                // Show loading indicator
                showLoadingScreen();
                
                // Years and fixtures first: everything else is scoped to the selected year
                const [loadedSeasons, loadedMatches, loadedAdmins] = await Promise.all([
                    Storage.getSeasons(),
                    Storage.getMatches(),
                    Storage.getAdminUsernames()
                ]);

                allMatches = loadedMatches || [];
                adminUsernames = loadedAdmins;
                availableYears = buildAvailableYears(loadedSeasons);
                selectedYear = pickInitialYear();

                await loadYearData();
                
                isLoading = false;
                hideLoadingScreen();
                
            } catch (error) {
                console.error('Error initializing data:', error);
                isLoading = false;
                hideLoadingScreen();
                alert('Error connecting to database. Please check your connection and refresh.');
            }
        }

        function showLoadingScreen() {
            const loader = document.getElementById('loadingScreen');
            if (loader) loader.classList.remove('hidden');
        }

        function hideLoadingScreen() {
            const loader = document.getElementById('loadingScreen');
            if (loader) loader.classList.add('hidden');
        }

        function updateChallengeSubtitleYear() {
            const subtitle = document.getElementById('challengeSubtitle');
            if (!subtitle) return;
            subtitle.textContent = selectedYear ? `Prediction Challenge ${selectedYear}` : 'Prediction Challenge';
        }

        // Check if current user is admin
        function isCurrentUserAdmin() {
            if (!currentUsername || !users[currentUsername]) return false;
            return adminUsernames.includes(currentUsername);
        }

        function updateAdminTabsSubheading() {
            const subheading = document.getElementById('adminTabsSubheading');
            if (!subheading) return;
            const admins = [...new Set((adminUsernames || [])
                .map(username => (username || '').trim().toLowerCase())
                .filter(Boolean))]
                .map(username => {
                    const user = users[username];
                    return toTitleCase((user && user.nickname) ? user.nickname : username);
                })
                .sort((a, b) => a.localeCompare(b));
            const suffix = admins.length > 0 ? ` (${admins.join(', ')})` : '';
            subheading.textContent = `These sections are only visible to admins${suffix}`;
        }

        // Initialize app
        function init() {
            renderYearSelect();
            renderMatches();
            renderAdminMatches();
        }

        // Toggle predictions lock
        async function togglePredictionsLock() {
            appSettings.predictionsLocked = !appSettings.predictionsLocked;
            await Storage.saveSettings(appSettings);
            updateLockToggleUI();
            renderMatches(); // Re-render to show/hide inputs
        }

        // Update lock toggle UI
        function updateLockToggleUI() {
            const yearLabel = document.getElementById('lockToggleYear');
            if (yearLabel) yearLabel.textContent = selectedYear ? ` (${selectedYear})` : '';
            const toggle = document.getElementById('lockToggle');
            if (toggle) {
                if (appSettings.predictionsLocked) {
                    toggle.classList.add('active');
                } else {
                    toggle.classList.remove('active');
                }
            }
        }

        async function refreshMatchSummaryAfterScoreSave() {
            const summaryTab = document.getElementById('summaryTab');
            const isSummaryVisible = !!summaryTab && !summaryTab.classList.contains('hidden');
            if (isSummaryVisible) {
                await refreshSummaryData();
            } else {
                showSummary();
            }
        }
