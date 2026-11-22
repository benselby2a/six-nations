// Tabs, refresh, Home Screen tip, start-up wiring
// Classic script (shared global scope); load order is set in index.html.

        // Tab switching
        // The last main tab (My Predictions or Match Summary; not Admin Functions) is remembered on this device
        const LAST_TAB_KEY = 'lastTab';
        function restoreLastTab() {
            let last = '';
            try { last = localStorage.getItem(LAST_TAB_KEY) || ''; } catch (error) { last = ''; }
            if (!last || last === 'summary' || last === 'adminHome') return;   // the app never reopens on Admin (an old saved value is ignored)
            const btn = document.querySelector(`#appView .app-bar > .tabs .tab[onclick="showTab('${last}')"]`);
            if (btn && !btn.classList.contains('hidden') && !btn.closest('.hidden')) btn.click();
        }

        // Admin Functions: its section opens BELOW the button panel, often off-screen on a phone. After a click on one of the panel's
        // buttons, scroll the opened section's top up to the top of the screen (instantly if the person prefers reduced motion).
        // Only a real click on the panel's own buttons does this (not the tour, a restore or code calling showTab).
        const ADMIN_SECTION_IDS = { checklist: 'checklistTab', results: 'resultsTab', scoreCorrections: 'scoreCorrectionsTab', competitors: 'competitorsTab', rules: 'rulesTab', prizeFund: 'prizeFundTab', years: 'yearsTab', recovery: 'recoveryTab', usageReport: 'usageReportTab', adminHelp: 'adminHelpTab' };
        function scrollAdminSectionIntoView(tabName, evt) {
            const id = ADMIN_SECTION_IDS[tabName];
            const clicked = evt && evt.isTrusted && evt.type === 'click' && evt.target && evt.target.closest && evt.target.closest('.admin-tabs');
            if (!id || !clicked) return;
            if (typeof appTouchedByUser !== 'undefined') appTouchedByUser = true;   // the person has acted: the late jump-to-top after page load must not undo this scroll
            const el = document.getElementById(id);
            if (!el) return;
            // After the section has been drawn (two frames); once more shortly after, in case its content settled (async data) and moved it
            const go = () => {
                // On iPhone the status-bar area (safe-area-inset-top) is covered by a solid/faded bar, so leave that much room above the section's heading as well
                let safeTop = 0;
                try {
                    const probe = document.createElement('div');
                    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
                    document.body.appendChild(probe);
                    safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
                    probe.remove();
                } catch (error) { safeTop = 0; }
                const gap = safeTop + 24;
                const top = el.getBoundingClientRect().top;
                if (top <= gap + 4) return;   // already clear of the top of the screen
                let reduce = false;
                try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { reduce = false; }
                window.scrollTo({ top: Math.max(0, window.scrollY + top - gap), behavior: reduce ? 'auto' : 'smooth' });
            };
            requestAnimationFrame(() => requestAnimationFrame(go));
            setTimeout(go, 450);
        }

        function showTab(tabName) {
            const clickEvent = (typeof event !== 'undefined') ? event : null;
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
            document.getElementById('checklistTab').classList.add('hidden');
            document.getElementById('adminHelpTab').classList.add('hidden');

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
            } else if (tabName === 'adminHelp') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('adminHelpTab').classList.remove('hidden');
                event.target.classList.add('active');
                tourPreload('admin');
            } else if (tabName === 'checklist') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('checklistTab').classList.remove('hidden');
                event.target.closest('.tab').classList.add('active');
            } else if (tabName === 'adminHome') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('adminHomeTab').classList.remove('hidden');
                event.target.classList.add('active');
            }

            // Inside any admin screen the top bar's Admin Functions tab stays the highlighted one
            if (['adminHome', 'results', 'scoreCorrections', 'competitors', 'rules', 'prizeFund', 'years', 'recovery', 'usageReport', 'adminHelp', 'checklist'].includes(tabName)) {
                const adminTop = document.querySelector('#appView .app-bar > .tabs .admin-top-tab');
                if (adminTop) adminTop.classList.add('active');
            }
            if (['predictions', 'summary'].includes(tabName)) {   // Admin is not remembered: the app reopens on whichever of these two was viewed last
                try { localStorage.setItem(LAST_TAB_KEY, tabName); } catch (error) { /* not remembered */ }
            }
            updatePastYearBanners();
            renderReadinessChecklist();
            scrollAdminSectionIntoView(tabName, clickEvent);
            if (tabName === 'adminHome') { tourPreload('admin'); maybeOfferAdminTour(); }
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

                // Restore opacity and show summary (only redrawn if something changed)
                if (container) {
                    container.style.opacity = '1';
                }
                showSummaryIfChanged();

            } catch (error) {
                console.error('Error refreshing summary data:', error);
                // Still show summary with existing data if refresh fails
                showSummary();
            }
        }

        // Initialize on load - load data from Supabase first
        const appReady = initializeData().then(() => {
            init();

            // Apply the saved light/dark choice straight away
            loadUserTheme();

            // Direct PDF URL support: index.html?export=pdf
            const params = new URLSearchParams(window.location.search);
            if ((params.get('export') || '').toLowerCase() === 'pdf') {
                isPdfExportMode = true;
                exportToPDF({ openInBrowser: true });
            }
        });

        fillLoginEmailOptions();

        // ---- Home Screen install tip (iPhone Safari only) ----
        function isStandaloneApp() {
            return window.navigator.standalone === true
                || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        }

        showAppVersion();
        document.addEventListener('visibilitychange', refreshWhenReturning);
        window.addEventListener('pageshow', (event) => { if (event.persisted) refreshWhenReturning(); });

        // Restores a saved session on load (INITIAL_SESSION) and handles sign-ins.
        // Deferred with setTimeout so the callback never awaits Supabase calls inside the auth lock.
        supabaseClient.auth.onAuthStateChange((event, session) => {
            setTimeout(() => handleAuthChange(event, session), 0);
        });
