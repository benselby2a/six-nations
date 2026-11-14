// Profile editor, theme, help modals
// Classic script (shared global scope); load order is set in index.html.

        let profileInitialState = null;
        let profileHasInteracted = false;

        function normalizeTeamSelection(teams) {
            return [...(teams || [])].sort((a, b) => a.localeCompare(b));
        }

        function getProfileFormState() {
            return {
                nickname: document.getElementById('profileDisplayName').value.trim(),
                supportedTeams: normalizeTeamSelection(getSelectedTeams('profileTeamsPicker'))
            };
        }

        function updateProfileSaveReminder() {
            const reminder = document.getElementById('profileSaveReminder');
            if (!reminder) return;
            if (!profileInitialState || !profileHasInteracted) {
                reminder.classList.add('hidden');
                reminder.style.display = 'none';
                return;
            }

            const currentState = getProfileFormState();
            const hasChanges =
                currentState.nickname !== profileInitialState.nickname ||
                currentState.supportedTeams.join('|') !== profileInitialState.supportedTeams.join('|');

            reminder.classList.toggle('hidden', !hasChanges);
            reminder.style.display = hasChanges ? 'block' : 'none';
        }

        function markProfileInteraction() {
            profileHasInteracted = true;
            updateProfileSaveReminder();
        }

        // Profile functions
        function openProfile() {
            if (!currentUsername || !users[currentUsername]) return;
            const user = users[currentUsername];

            document.getElementById('profileUsername').value = currentUsername;
            document.getElementById('profileEmail').value = currentAuthEmail || '';
            document.getElementById('profileDisplayName').value = user.nickname || '';

            const feedbackEl = document.getElementById('profileFeedback');
            feedbackEl.classList.add('hidden');
            feedbackEl.className = 'login-feedback hidden';
            const profileReminder = document.getElementById('profileSaveReminder');
            profileReminder.classList.add('hidden');
            profileReminder.style.display = 'none';
            profileHasInteracted = false;

            renderTeamFlagsPicker('profileTeamsPicker', user.supportedTeams || []);
            document.getElementById('profileModal').classList.remove('hidden');

            profileInitialState = getProfileFormState();

            document.getElementById('profileDisplayName').oninput = markProfileInteraction;
        }

        function closeProfile() {
            document.getElementById('profileModal').classList.add('hidden');
            const profileReminder = document.getElementById('profileSaveReminder');
            profileReminder.classList.add('hidden');
            profileReminder.style.display = 'none';
            profileInitialState = null;
            profileHasInteracted = false;
        }

        async function saveProfile() {
            const user = users[currentUsername];
            const nickname = document.getElementById('profileDisplayName').value.trim();
            const feedbackEl = document.getElementById('profileFeedback');

            feedbackEl.classList.add('hidden');
            feedbackEl.className = 'login-feedback hidden';

            if (!nickname) {
                feedbackEl.textContent = 'Display name is required.';
                feedbackEl.classList.remove('hidden');
                feedbackEl.classList.add('error');
                return;
            }

            if (hasUnsafeDisplayChars(nickname)) {
                feedbackEl.textContent = 'Display name cannot contain < > or " characters.';
                feedbackEl.classList.remove('hidden');
                feedbackEl.classList.add('error');
                return;
            }

            // Check if nickname is taken by another user
            const existingUser = Object.keys(users).find(u =>
                u !== currentUsername && users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingUser) {
                feedbackEl.textContent = 'This display name is already taken.';
                feedbackEl.classList.remove('hidden');
                feedbackEl.classList.add('error');
                return;
            }

            // Update display name and teams
            user.nickname = nickname;
            user.supportedTeams = getSelectedTeams('profileTeamsPicker');

            await Storage.saveUser(currentUsername, user);

            // Update the displayed name in the header
            let displayName = toTitleCase(nickname);
            if (isCurrentUserAdmin()) {
                displayName += '<span class="admin-badge">Admin</span>';
            }
            document.getElementById('currentUser').innerHTML = displayName;

            // Refresh the match summary and leaderboard with updated data
            showSummary();

            closeProfile();
        }

        // Colour mode: "auto" follows the device's dark or light setting (the default); "light" and "dark" are the user's own choice.
        let colourMode = 'auto';

        function applyColourMode() {
            const systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            const dark = colourMode === 'dark' || (colourMode === 'auto' && systemDark);
            if (dark) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            updateThemeToggle();
        }

        function changeTheme(mode) {
            colourMode = ['light', 'dark'].includes(mode) ? mode : 'auto';
            applyColourMode();
            // Remember the choice across visits
            setCookie(THEME_COOKIE_NAME, colourMode);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, colourMode);
            } catch (error) {
                // Ignore storage errors.
            }
        }

        // The account menu button cycles Auto, Light, Dark
        function toggleTheme() {
            changeTheme({ auto: 'light', light: 'dark', dark: 'auto' }[colourMode]);
        }

        function updateThemeToggle() {
            const btn = document.getElementById('themeToggleBtn');
            if (!btn) return;
            btn.textContent = `Appearance: ${{ auto: 'Auto', light: 'Light', dark: 'Dark' }[colourMode]}`;
        }

        // Load the saved choice (none: Auto). Someone who picked Dark under the old theme selector keeps Dark.
        function loadUserTheme() {
            let stored = '';
            let legacy = '';
            try {
                stored = (localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase();
                legacy = (localStorage.getItem(LEGACY_THEME_KEY) || '').trim().toLowerCase();
            } catch (error) {
                stored = '';
            }
            if (!stored) stored = (getCookie(THEME_COOKIE_NAME) || '').trim().toLowerCase();
            if (!stored && legacy === 'dark') stored = 'dark';
            colourMode = ['light', 'dark'].includes(stored) ? stored : 'auto';
            applyColourMode();
        }

        // Follow the device while the mode is Auto
        if (window.matchMedia) {
            const systemScheme = window.matchMedia('(prefers-color-scheme: dark)');
            const onSystemSchemeChange = () => { if (colourMode === 'auto') applyColourMode(); };
            if (systemScheme.addEventListener) systemScheme.addEventListener('change', onSystemSchemeChange);
            else if (systemScheme.addListener) systemScheme.addListener(onSystemSchemeChange);
        }

        function toggleGlobalHelp() {
            const modal = document.getElementById('globalHelpModal');
            if (!modal) return;
            tourPreload('app');
            modal.classList.remove('hidden');
        }

        function closeGlobalHelpModal() {
            const modal = document.getElementById('globalHelpModal');
            if (!modal) return;
            modal.classList.add('hidden');
        }

        function toggleAdminHelp() {
            const modal = document.getElementById('adminHelpModal');
            if (!modal) return;
            tourPreload('admin');
            modal.classList.remove('hidden');
        }

        function closeAdminHelpModal() {
            const modal = document.getElementById('adminHelpModal');
            if (!modal) return;
            modal.classList.add('hidden');
        }

        // Calculate total actual tries in tournament
        function getTotalActualTries() {
            let total = 0;
            matches.forEach(match => {
                if (match.actualTries1 !== null) total += match.actualTries1;
                if (match.actualTries2 !== null) total += match.actualTries2;
            });
            return total;
        }
