// Login (emailed code), sign-in handling, showApp
// Classic script (shared global scope); load order is set in index.html.

        // ============================================
        // AUTH (Supabase Auth email codes)
        // ============================================
        // A signed-in Supabase account maps to a competitor through users.auth_user_id
        // (looked up via the my_competitor RPC). Supabase persists the session in
        // localStorage and refreshes it automatically, so returning visitors stay signed in.
        let currentAuthEmail = '';
        let authHandledUserId = null;
        let isPdfExportMode = false;
        let loginCodeCooldownTimer = null;
        let pendingLoginEmail = '';
        const RECENT_LOGIN_EMAILS_KEY = 'rugbyPredictorRecentEmails';
        const LEGACY_LAST_LOGIN_EMAIL_KEY = 'rugbyPredictorLastEmail';

        // Emails used to sign in on this device (most recent first). They are offered as suggestions
        // above the keyboard; the box itself stays empty so iOS can also suggest the contact card email
        // (iOS shows no suggestions in a field that already has text).
        function getRecentLoginEmails() {
            try {
                const stored = JSON.parse(localStorage.getItem(RECENT_LOGIN_EMAILS_KEY) || 'null');
                if (Array.isArray(stored)) return stored.filter(email => typeof email === 'string').slice(0, 3);
                const legacy = localStorage.getItem(LEGACY_LAST_LOGIN_EMAIL_KEY);
                return legacy ? [legacy] : [];
            } catch (error) {
                return [];
            }
        }

        function rememberLoginEmail(email) {
            try {
                const recent = [email, ...getRecentLoginEmails().filter(existing => existing !== email)].slice(0, 3);
                localStorage.setItem(RECENT_LOGIN_EMAILS_KEY, JSON.stringify(recent));
            } catch (error) {
                // Ignore storage errors; it just will not be suggested next time.
            }
            fillLoginEmailOptions();
        }

        function fillLoginEmailOptions() {
            const list = document.getElementById('loginEmailOptions');
            if (!list) return;
            list.innerHTML = getRecentLoginEmails().map(email => `<option value="${escapeHtml(email)}"></option>`).join('');
        }

        function showLoginScreen() {
            document.getElementById('loginView').classList.remove('hidden');
            document.getElementById('setupView').classList.add('hidden');
            document.getElementById('appView').classList.add('hidden');
        }

        function showSetupFeedback(message, type) {
            const feedbackEl = document.getElementById('setupFeedback');
            feedbackEl.textContent = message;
            feedbackEl.classList.remove('hidden', 'success', 'error', 'info');
            feedbackEl.classList.add(type);
        }

        // Shown when an email is not registered for the game: tells them who to ask
        async function showUnrecognisedEmailModal(email) {
            const modal = document.getElementById('unrecognisedEmailModal');
            const body = document.getElementById('unrecognisedEmailBody');
            if (!modal || !body) return;

            const { data } = await supabaseClient.rpc('login_admin_names');
            const names = (Array.isArray(data) ? data : [])
                .map(name => toTitleCase(String(name || '').trim()))
                .filter(Boolean);
            const adminsHtml = names.length > 0
                ? `<ul class="unrecognised-admins">${names.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
                : '<p class="profile-hint">Ask whoever runs the game.</p>';

            body.innerHTML = `
                <p><strong>${escapeHtml(email)}</strong> isn't registered for this game.</p>
                <p>Please check you've typed the email you registered with, or contact an admin to get access:</p>
                ${adminsHtml}`;
            modal.classList.remove('hidden');
            const closeButton = document.getElementById('unrecognisedEmailClose');
            if (closeButton) closeButton.focus();
        }

        function closeUnrecognisedEmailModal() {
            const modal = document.getElementById('unrecognisedEmailModal');
            if (modal) modal.classList.add('hidden');
            const emailInput = document.getElementById('loginEmail');
            if (emailInput && !document.getElementById('loginView').classList.contains('hidden')) emailInput.focus();
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeUnrecognisedEmailModal();
        });

        // Login as guest (view only)
        function loginAsGuest() {
            isGuest = true;
            currentUsername = null;
            setRememberedUsername('guest');
            trackUsage('guest logs in', formatUsagePayload({ mode: 'guest' }), 'guest');
            showAppAsGuest();
        }

        // Email a login code (also creates the account on first use)
        async function sendLoginCode() {
            const emailInput = document.getElementById('loginEmail');
            const button = document.getElementById('sendLoginCodeBtn');
            const email = emailInput.value.trim().toLowerCase();

            const feedbackEl = document.getElementById('loginFeedback');
            feedbackEl.className = 'login-feedback hidden';

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showLoginFeedback('Please enter a valid email address.', 'error');
                return;
            }

            button.disabled = true;

            // Only emails an admin has registered can sign in: check before sending anything
            const { data: registered, error: checkError } = await supabaseClient.rpc('check_login_email', { p_email: email });
            if (checkError) {
                showLoginFeedback('Could not check your email. Please try again.', 'error');
                button.disabled = false;
                return;
            }
            if (registered !== true) {
                button.disabled = false;
                await showUnrecognisedEmailModal(email);
                return;
            }

            const { error } = await supabaseClient.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true }
            });

            if (error) {
                showLoginFeedback(error.message || 'Could not send the code. Please try again.', 'error');
                button.disabled = false;
                return;
            }

            pendingLoginEmail = email;
            rememberLoginEmail(email);
            // Step two: only the code box, Sign in and Back are shown
            document.getElementById('loginCodeNote').textContent = `We've emailed a code to ${email}. Enter it below. It can take a minute to arrive.`;
            document.getElementById('loginView').classList.add('awaiting-code');
            document.getElementById('loginCodeEntry').classList.remove('hidden');
            document.getElementById('loginCode').focus();
            startLoginCodeCooldown(button, 30);
        }

        // Back from the code step to the email step (the typed email is kept)
        function backToLoginEmail() {
            document.getElementById('loginView').classList.remove('awaiting-code');
            document.getElementById('loginCodeEntry').classList.add('hidden');
            document.getElementById('loginCode').value = '';
            document.getElementById('loginFeedback').className = 'login-feedback hidden';
            pendingLoginEmail = '';
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }

        // Typing a different email makes any code we were waiting for irrelevant
        function onLoginEmailInput() {
            const typed = document.getElementById('loginEmail').value.trim().toLowerCase();
            if (pendingLoginEmail && typed !== pendingLoginEmail) {
                pendingLoginEmail = '';
                document.getElementById('loginCodeEntry').classList.add('hidden');
                document.getElementById('loginCode').value = '';

                // The resend cooldown belonged to the previous address
                clearInterval(loginCodeCooldownTimer);
                const sendButton = document.getElementById('sendLoginCodeBtn');
                sendButton.disabled = false;
                sendButton.textContent = 'Email a login code';
            }
        }

        // Sign in with the code from the email. Success arrives through onAuthStateChange.
        async function verifyLoginCode() {
            const email = pendingLoginEmail || document.getElementById('loginEmail').value.trim().toLowerCase();
            const codeInput = document.getElementById('loginCode');
            const button = document.getElementById('verifyCodeBtn');
            const code = codeInput.value.replace(/\s+/g, '');

            document.getElementById('loginFeedback').className = 'login-feedback hidden';

            if (!email) {
                showLoginFeedback('Enter your email and request a code first.', 'error');
                return;
            }
            if (!/^\d{6,10}$/.test(code)) {
                showLoginFeedback('Enter the numeric code from the email.', 'error');
                return;
            }

            button.disabled = true;
            const { error } = await supabaseClient.auth.verifyOtp({ email, token: code, type: 'email' });
            button.disabled = false;

            if (error) {
                showLoginFeedback("That code didn't work. Check it and try again, or request a new one.", 'error');
                return;
            }

            codeInput.value = '';
            showLoginFeedback('Signing you in...', 'success');
        }

        // Pasting a code (or the whole line it came in) into the box signs in straight away
        function handleCodePaste(event) {
            const text = (event.clipboardData && event.clipboardData.getData('text')) || '';
            const match = text.match(/\b\d{6,10}\b/);
            if (!match) return;  // let the browser paste normally
            event.preventDefault();
            document.getElementById('loginCode').value = match[0];
            verifyLoginCode();
        }

        function handleCodeKeyPress(event) {
            if (event.key === 'Enter') {
                verifyLoginCode();
            }
        }

        function startLoginCodeCooldown(button, seconds) {
            clearInterval(loginCodeCooldownTimer);
            let remaining = seconds;
            const label = 'Email a login code';
            button.disabled = true;
            button.textContent = `Resend in ${remaining}s`;
            loginCodeCooldownTimer = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearInterval(loginCodeCooldownTimer);
                    button.disabled = false;
                    button.textContent = label;
                    return;
                }
                button.textContent = `Resend in ${remaining}s`;
            }, 1000);
        }

        // Auth state changes (initial session restore, sign-in, sign-out)
        async function handleAuthChange(event, session) {
            await appReady;
            if (isPdfExportMode) return;

            if (event === 'SIGNED_OUT') {
                authHandledUserId = null;
                currentAuthEmail = '';
                if (currentUsername) {
                    currentUsername = null;
                    showLoginScreen();
                }
                return;
            }

            if (!session) {
                if (event === 'INITIAL_SESSION') {
                    if (getRememberedUsername() === 'guest') {
                        isGuest = true;
                        currentUsername = null;
                        trackUsage('guest logs in', formatUsagePayload({ source: 'cookie_auto_login' }), 'guest');
                        showAppAsGuest();
                    } else {
                        // Remembered usernames from the pre-auth login system are no longer used.
                        clearRememberedUsername();
                    }
                }
                return;
            }

            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (authHandledUserId === session.user.id) return;
                authHandledUserId = session.user.id;
                await resolveSignedInUser(session, event === 'INITIAL_SESSION' ? 'session_restore' : 'email_code');
            }
        }

        // Map the signed-in account to its competitor, or ask the person to set one up
        async function resolveSignedInUser(session, source) {
            currentAuthEmail = (session.user && session.user.email) || '';

            const { data, error } = await supabaseClient.rpc('my_competitor');
            if (error) {
                console.error('Error loading competitor for account:', error);
                authHandledUserId = null;
                showLoginScreen();
                showLoginFeedback('Signed in, but could not load your profile. Please refresh and try again.', 'error');
                return;
            }

            const row = Array.isArray(data) ? data[0] : data;
            if (!row) {
                // Signed in, but this email is not registered for the game: back out with the same message
                const unrecognisedEmail = currentAuthEmail;
                await logout();
                await showUnrecognisedEmailModal(unrecognisedEmail);
                return;
            }

            // An invited person: the row exists but has no display name yet, so they fill in their details first
            if (!row.nickname) {
                await showProfileSetup();
                return;
            }

            const username = (row.username || '').trim().toLowerCase();
            if (!users[username]) {
                users = await Storage.getUsers();
            }
            if (!users[username]) {
                showLoginScreen();
                showLoginFeedback('Your competitor profile could not be loaded. Please refresh and try again.', 'error');
                return;
            }

            currentUsername = username;
            isGuest = false;
            clearRememberedUsername();
            adminUsernames = await Storage.getAdminUsernames();
            trackUsage('user logs in', formatUsagePayload({ username, source }), username);
            showApp();
        }

        // First sign-in by an invited person: they choose how they appear on the leaderboard
        async function showProfileSetup() {
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('appView').classList.add('hidden');
            document.getElementById('setupView').classList.remove('hidden');
            document.getElementById('setupFeedback').className = 'login-feedback hidden';
            document.getElementById('setupIntro').textContent =
                `Signed in as ${currentAuthEmail}. Choose how you'll appear on the leaderboard.`;
            renderTeamFlagsPicker('setupTeamsPicker', []);

            const nicknameInput = document.getElementById('setupNickname');
            if (!nicknameInput.value.trim()) {
                nicknameInput.value = suggestDisplayNameFromEmail(currentAuthEmail);
            }
        }

        // Default display name: the first name guessed from the email prefix (ben.selby@... -> Ben)
        function suggestDisplayNameFromEmail(email) {
            const prefix = String(email || '').split('@')[0].toLowerCase();
            const firstName = prefix.split(/[^a-z]+/).find(Boolean) || '';
            return toTitleCase(firstName);
        }

        async function createMyProfile() {
            const nickname = document.getElementById('setupNickname').value.trim();
            const supportedTeams = getSelectedTeams('setupTeamsPicker');

            if (!nickname) {
                showSetupFeedback('Please enter a display name.', 'error');
                return;
            }
            if (hasUnsafeDisplayChars(nickname)) {
                showSetupFeedback('Display name cannot contain < > or " characters.', 'error');
                return;
            }
            const nicknameTaken = Object.keys(users).some(u =>
                users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (nicknameTaken) {
                showSetupFeedback('This display name is already taken. Please choose another.', 'error');
                return;
            }

            const secondEmail = (document.getElementById('setupSecondEmail').value || '').trim().toLowerCase();
            if (secondEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondEmail)) {
                showSetupFeedback('That second email does not look right. Fix it or leave it empty.', 'error');
                return;
            }

            const { error } = await supabaseClient.rpc('complete_my_profile', {
                p_nickname: nickname,
                p_supported_teams: supportedTeams.length > 0 ? supportedTeams.join(',') : null
            });
            if (error) {
                showSetupFeedback(error.message || 'Could not create your profile. Please try again.', 'error');
                return;
            }

            let secondEmailError = null;
            if (secondEmail) {
                const { error: secondError } = await supabaseClient.rpc('add_my_second_email', { p_email: secondEmail });
                secondEmailError = secondError;
            }

            // The competitor exists now: load it and carry on into the app
            const { data } = await supabaseClient.auth.getSession();
            const session = data && data.session;
            if (!session) {
                showLoginScreen();
                return;
            }
            users = await Storage.getUsers();
            authHandledUserId = session.user.id;
            await resolveSignedInUser(session, 'first_sign_in');
            if (secondEmailError) {
                alert('You are in, but the second email was not saved: ' + (secondEmailError.message || 'unknown error') + '\nAn admin can add it for you.');
            }
        }

        // Handle Enter key on the login email input
        function handleLoginKeyPress(event) {
            if (event.key === 'Enter') {
                sendLoginCode();
            }
        }

        // Logout
        async function logout() {
            const wasGuest = isGuest;
            currentUsername = null;
            isGuest = false;
            authHandledUserId = null;
            currentAuthEmail = '';
            adminUsernames = [];
            authAccounts = [];
            authAccountsLoaded = false;
            authAccountsRequested = false;
            clearRememberedUsername();
            showLoginScreen();

            // Reset logout button text
            const logoutBtn = document.getElementById('logoutBtn');
            logoutBtn.textContent = 'Logout';

            document.getElementById('loginEmail').value = '';
            document.getElementById('loginFeedback').className = 'login-feedback hidden';
            document.getElementById('setupNickname').value = '';
            pendingLoginEmail = '';
            document.getElementById('loginCode').value = '';
            document.getElementById('loginCodeEntry').classList.add('hidden');
            document.getElementById('loginView').classList.remove('awaiting-code');

            // A fresh login form: drop any resend countdown left over from the last sign-in
            clearInterval(loginCodeCooldownTimer);
            const sendButton = document.getElementById('sendLoginCodeBtn');
            sendButton.disabled = false;
            sendButton.textContent = 'Email a login code';

            if (!wasGuest) {
                await supabaseClient.auth.signOut();
            }
        }

        // Show login feedback
        function showLoginFeedback(message, type) {
            const feedbackEl = document.getElementById('loginFeedback');
            feedbackEl.textContent = message;
            feedbackEl.classList.remove('hidden', 'success', 'error', 'info');
            feedbackEl.classList.add(type);
        }

        // Show app
        function showApp() {
            isGuest = false;
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('setupView').classList.add('hidden');
            document.getElementById('appView').classList.remove('hidden');

            const user = users[currentUsername];
            let displayName = toTitleCase(user.nickname || currentUsername);

            // Add admin badge if user is admin
            if (isCurrentUserAdmin()) {
                displayName += '<span class="admin-badge">Admin</span>';
                // Show admin tabs
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                // Hide admin tabs
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            }

            document.getElementById('currentUser').innerHTML = displayName;

            // Show all tabs for logged-in users
            document.querySelector('.tabs:not(.admin-tabs)').classList.remove('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            updateAdminTabsSubheading();
            updateNextMatchScoreButtonState();
            renderReadinessChecklist();

            // Load user's saved theme
            loadUserTheme();

            // Update lock toggle UI
            updateLockToggleUI();

            // Initialize round selector dropdown
            initRoundSelector();
            updateAdminTabsSubheading();

            // Always land on Match Summary after login.
            document.getElementById('predictionsTab').classList.add('hidden');
            document.getElementById('summaryTab').classList.remove('hidden');
            document.getElementById('competitorsTab').classList.add('hidden');
            document.getElementById('scoreCorrectionsTab').classList.add('hidden');
            document.getElementById('resultsTab').classList.add('hidden');
            document.getElementById('rulesTab').classList.add('hidden');
            document.getElementById('prizeFundTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');
            document.getElementById('usageReportTab').classList.add('hidden');
            document.getElementById('yearsTab').classList.add('hidden');
            document.getElementById('adminHomeTab').classList.add('hidden');
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            const summaryTabBtn = Array.from(document.querySelectorAll('.tab')).find(
                tab => tab.textContent.trim() === 'Match Summary'
            );
            if (summaryTabBtn) summaryTabBtn.classList.add('active');

            renderMatches(); // Render the prediction inputs first
            loadPredictions(); // Then populate with saved predictions
            showSummary(); // Load summary by default (includes leaderboard)
        }

        // Show app as guest (view only mode)
        function showAppAsGuest() {
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('appView').classList.remove('hidden');

            document.getElementById('currentUser').innerHTML = 'Guest <span class="guest-badge">View Only</span>';

            // Hide tabs - guests can only see summary
            document.querySelector('.tabs:not(.admin-tabs)').classList.add('hidden');
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));

            // Change logout button to "Sign In"
            const logoutBtn = document.getElementById('logoutBtn');
            logoutBtn.textContent = 'Sign In';
            logoutBtn.classList.remove('hidden');

            // Initialize round selector dropdown
            initRoundSelector();

            // Hide all tabs except summary
            document.getElementById('predictionsTab').classList.add('hidden');
            document.getElementById('summaryTab').classList.remove('hidden');
            document.getElementById('competitorsTab').classList.add('hidden');
            document.getElementById('scoreCorrectionsTab').classList.add('hidden');
            document.getElementById('resultsTab').classList.add('hidden');
            document.getElementById('rulesTab').classList.add('hidden');
            document.getElementById('prizeFundTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');
            document.getElementById('usageReportTab').classList.add('hidden');
            document.getElementById('yearsTab').classList.add('hidden');
            document.getElementById('adminHomeTab').classList.add('hidden');

            // Show summary
            showSummary();
        }
