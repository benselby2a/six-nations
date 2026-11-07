// Tabs, refresh, Home Screen tip, start-up wiring
// Classic script (shared global scope); load order is set in index.html.

        // Tab switching
        function showTab(tabName) {
            // Hide all tabs
            document.getElementById('predictionsTab').classList.add('hidden');
            document.getElementById('summaryTab').classList.add('hidden');
            document.getElementById('competitorsTab').classList.add('hidden');
            document.getElementById('scoreCorrectionsTab').classList.add('hidden');
            document.getElementById('resultsTab').classList.add('hidden');
            document.getElementById('rulesTab').classList.add('hidden');
            document.getElementById('prizeFundTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');
            document.getElementById('usageReportTab').classList.add('hidden');
            document.getElementById('yearsTab').classList.add('hidden');

            // Update tab buttons
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

            // Show selected tab
            if (tabName === 'predictions') {
                document.getElementById('predictionsTab').classList.remove('hidden');
                document.getElementById('adminHomeTab').classList.add('hidden');
                event.target.classList.add('active');
                renderMatches(); // Re-render to check lock status
                loadPredictions(); // Pre-populate with saved predictions
            } else if (tabName === 'summary') {
                document.getElementById('summaryTab').classList.remove('hidden');
                document.getElementById('adminHomeTab').classList.add('hidden');
                event.target.classList.add('active');
                refreshSummaryData();
            } else if (tabName === 'competitors') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('competitorsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderCompetitorManagement();
            } else if (tabName === 'scoreCorrections') {
                if (!isCurrentUserAdmin()) return;
                // Always default back to placeholder selection when opening this tab.
                adminPredictionUsername = null;
                document.getElementById('scoreCorrectionsTab').classList.remove('hidden');
                event.target.classList.add('active');
                updateLockToggleUI();
                renderAdminScoreCorrections();
            } else if (tabName === 'results') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('resultsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderAdminMatches();
            } else if (tabName === 'rules') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('rulesTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderRulesTab();
            } else if (tabName === 'prizeFund') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('prizeFundTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderPrizeFundTab();
            } else if (tabName === 'years') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('yearsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderYearsTab();
            } else if (tabName === 'recovery') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('recoveryTab').classList.remove('hidden');
                event.target.classList.add('active');
                initRecoveryTab();
            } else if (tabName === 'usageReport') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('usageReportTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderUsageReport();
            } else if (tabName === 'adminHome') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('adminHomeTab').classList.remove('hidden');
                event.target.classList.add('active');
            }

            // Opening an admin section folds the admin menu away to save room; the heading reopens it
            const adminSections = ['competitors', 'scoreCorrections', 'results', 'rules', 'prizeFund', 'years', 'recovery', 'usageReport'];
            if (adminSections.includes(tabName)) setAdminPanelCollapsed(true);
            else if (tabName === 'adminHome') setAdminPanelCollapsed(false);

            // Refresh only makes sense on the Match Summary
            const refreshBtn = document.getElementById('summaryRefreshBtn');
            if (refreshBtn) refreshBtn.classList.toggle('hidden', document.getElementById('summaryTab').classList.contains('hidden'));

            renderReadinessChecklist();
        }

        // Small version line at the bottom: date and short id of the latest commit on main (GitHub's public API,
        // remembered for 10 minutes; stays blank if it cannot be reached)
        async function showAppVersion() {
            const el = document.getElementById('appVersion');
            if (!el) return;
            const KEY = 'appVersionInfo';
            const render = (info) => {
                const date = new Date(info.date);
                if (Number.isNaN(date.getTime())) return;
                el.textContent = `Version ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${String(info.sha).slice(0, 7)}`;
            };
            try {
                const cached = JSON.parse(localStorage.getItem(KEY) || 'null');
                if (cached && cached.sha) render(cached);
                if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) return;
            } catch (e) { /* storage unavailable */ }
            try {
                const response = await fetch('https://api.github.com/repos/benselby2a/six-nations/commits/main', { headers: { Accept: 'application/vnd.github+json' } });
                if (!response.ok) return;
                const commit = await response.json();
                const info = { sha: commit.sha, date: commit.commit && (commit.commit.committer || commit.commit.author).date, fetchedAt: Date.now() };
                render(info);
                try { localStorage.setItem(KEY, JSON.stringify(info)); } catch (e) { /* ignore */ }
            } catch (e) { /* offline: leave blank */ }
        }

        function setAdminPanelCollapsed(collapsed) {
            const panel = document.getElementById('adminPanel');
            const heading = document.getElementById('adminPanelHeading');
            if (!panel) return;
            panel.classList.toggle('collapsed', collapsed);
            if (heading) heading.setAttribute('aria-expanded', String(!collapsed));
        }

        function toggleAdminPanel() {
            const panel = document.getElementById('adminPanel');
            if (panel) setAdminPanelCollapsed(!panel.classList.contains('collapsed'));
        }

        async function refreshSummaryData() {
            try {
                // Show a subtle loading state on the summary container
                const container = document.getElementById('matchSummary');
                if (container) {
                    container.style.opacity = '0.6';
                }

                // Fetch fresh data from Supabase
                const loadedMatches = await Storage.getMatches();
                if (loadedMatches) allMatches = loadedMatches;
                await loadYearData();

                // Restore opacity and show summary
                if (container) {
                    container.style.opacity = '1';
                }
                showSummary();

            } catch (error) {
                console.error('Error refreshing summary data:', error);
                // Still show summary with existing data if refresh fails
                showSummary();
            }
        }

        // Initialize on load - load data from Supabase first
        const appReady = initializeData().then(() => {
            init();

            // Apply previously selected theme from cookie immediately on load
            let savedStorageTheme = '';
            try {
                savedStorageTheme = (localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase();
            } catch (error) {
                savedStorageTheme = '';
            }
            const savedTheme = (getCookie(THEME_COOKIE_NAME) || '').trim().toLowerCase();
            changeTheme(savedStorageTheme || savedTheme || 'classic');

            // Direct PDF URL support: index.html?export=pdf
            const params = new URLSearchParams(window.location.search);
            if ((params.get('export') || '').toLowerCase() === 'pdf') {
                isPdfExportMode = true;
                exportToPDF({ openInBrowser: true });
            }
        });

        fillLoginEmailOptions();

        // ---- Home Screen install tip (iPhone Safari only) ----
        const INSTALL_TIP_DISMISSED_KEY = 'rugbyPredictorInstallTipDismissed';

        function isStandaloneApp() {
            return window.navigator.standalone === true
                || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        }

        function shouldShowInstallTip() {
            const ua = navigator.userAgent || '';
            const isIosDevice = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
            if (!isIosDevice || !isSafari || isStandaloneApp()) return false;
            try {
                if (localStorage.getItem(INSTALL_TIP_DISMISSED_KEY) === '1') return false;
            } catch (error) {
                // Storage unavailable: show the tip.
            }
            return true;
        }

        function showInstallTipIfNeeded() {
            const tip = document.getElementById('installTip');
            if (tip) tip.classList.toggle('hidden', !shouldShowInstallTip());
        }

        function dismissInstallTip() {
            try {
                localStorage.setItem(INSTALL_TIP_DISMISSED_KEY, '1');
            } catch (error) {
                // Ignore storage errors; the tip just comes back next time.
            }
            const tip = document.getElementById('installTip');
            if (tip) tip.classList.add('hidden');
        }

        showInstallTipIfNeeded();
        showAppVersion();
        document.addEventListener('visibilitychange', refreshWhenReturning);
        window.addEventListener('pageshow', (event) => { if (event.persisted) refreshWhenReturning(); });

        // Restores a saved session on load (INITIAL_SESSION) and handles sign-ins.
        // Deferred with setTimeout so the callback never awaits Supabase calls inside the auth lock.
        supabaseClient.auth.onAuthStateChange((event, session) => {
            setTimeout(() => handleAuthChange(event, session), 0);
        });
