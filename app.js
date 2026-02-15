        // 2026 Six Nations fixtures (kick-off times in GMT)
        const matches = [
            // Round 1
            { id: 1, round: 1, date: 'Thu, Feb 5', time: '20:10', team1: 'France', team2: 'Ireland', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 2, round: 1, date: 'Sat, Feb 7', time: '14:10', team1: 'Italy', team2: 'Scotland', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 3, round: 1, date: 'Sat, Feb 7', time: '16:40', team1: 'England', team2: 'Wales', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            // Round 2
            { id: 4, round: 2, date: 'Sat, Feb 14', time: '14:10', team1: 'Ireland', team2: 'Italy', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 5, round: 2, date: 'Sat, Feb 14', time: '16:40', team1: 'Scotland', team2: 'England', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 6, round: 2, date: 'Sun, Feb 15', time: '15:10', team1: 'Wales', team2: 'France', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            // Round 3
            { id: 7, round: 3, date: 'Sat, Feb 21', time: '14:10', team1: 'England', team2: 'Ireland', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 8, round: 3, date: 'Sat, Feb 21', time: '16:40', team1: 'Wales', team2: 'Scotland', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 9, round: 3, date: 'Sun, Feb 22', time: '15:10', team1: 'France', team2: 'Italy', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            // Round 4
            { id: 10, round: 4, date: 'Fri, Mar 6', time: '20:10', team1: 'Ireland', team2: 'Wales', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 11, round: 4, date: 'Sat, Mar 7', time: '14:10', team1: 'Scotland', team2: 'France', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 12, round: 4, date: 'Sat, Mar 7', time: '16:40', team1: 'Italy', team2: 'England', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            // Round 5
            { id: 13, round: 5, date: 'Sat, Mar 14', time: '14:10', team1: 'Ireland', team2: 'Scotland', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 14, round: 5, date: 'Sat, Mar 14', time: '16:40', team1: 'Wales', team2: 'Italy', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false },
            { id: 15, round: 5, date: 'Sat, Mar 14', time: '20:10', team1: 'France', team2: 'England', actualScore1: null, actualScore2: null, actualTries1: null, actualTries2: null, jokerEligible: false }
        ];

        // Country flags mapping
        const countryFlags = {
            'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
            'France': '🇫🇷',
            'Ireland': '🇮🇪',
            'Italy': '🇮🇹',
            'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
            'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
        };

        // Helper function to get flag for a team
        function getFlag(team) {
            return countryFlags[team] || '';
        }

        // 3-letter abbreviations for compact summary headers
        function getTeamAbbr(team) {
            const abbr = {
                England: 'ENG',
                France: 'FRA',
                Ireland: 'IRE',
                Italy: 'ITA',
                Scotland: 'SCO',
                Wales: 'WAL'
            };
            return abbr[team] || team;
        }

        // Render a team flags picker into a container
        function renderTeamFlagsPicker(containerId, selectedTeams) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const teams = Object.keys(countryFlags);
            container.innerHTML = teams.map(team => {
                const isSelected = selectedTeams && selectedTeams.includes(team);
                return `<div class="team-flag-option ${isSelected ? 'selected' : ''}" data-team="${team}" onclick="toggleTeamFlag(this, '${containerId}')">
                    <span class="flag-emoji">${getFlag(team)}</span>
                    <span>${team}</span>
                </div>`;
            }).join('');
        }

        // Toggle a team flag selection (max 2)
        function toggleTeamFlag(el, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const isSelected = el.classList.contains('selected');
            if (isSelected) {
                el.classList.remove('selected');
            } else {
                const selectedCount = container.querySelectorAll('.team-flag-option.selected').length;
                if (selectedCount >= 2) return; // Max 2
                el.classList.add('selected');
            }
            if (containerId === 'profileTeamsPicker') {
                markProfileInteraction();
            }
        }

        // Get selected teams from a picker
        function getSelectedTeams(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return [];
            return Array.from(container.querySelectorAll('.team-flag-option.selected')).map(el => el.dataset.team);
        }

        // Get flag emojis string for display next to a user's name
        function getUserFlags(username) {
            const teams = users[username] && users[username].supportedTeams ? users[username].supportedTeams : [];
            if (teams.length === 0) return '';
            return '<span class="supported-team-flags">' + teams.map(t => getFlag(t)).join('') + '</span> ';
        }

        // Helper function to convert string to Title Case (Camel Case for display)
        function toTitleCase(str) {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        }

        // Simple hash function for password storage (SHA-256)
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        }

        // Check if a password matches a hash
        async function verifyPassword(password, hash) {
            const passwordHash = await hashPassword(password);
            return passwordHash === hash;
        }

        // ============================================
        // SUPABASE CONFIGURATION
        // Replace these with your Supabase project details
        // ============================================
        const SUPABASE_URL = 'https://tzspmhmyhcbogwqefvfc.supabase.co';  // e.g., 'https://xxxxx.supabase.co'
        const SUPABASE_ANON_KEY = 'sb_publishable_LDr2Tvnosv-H38JuWV5B0g_aKKA4NV1';  // Your anon/public key
        
        // Initialize Supabase client
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ============================================
        // STORAGE ABSTRACTION LAYER (Supabase)
        // ============================================
        const Storage = {
            // Users - get all users as object keyed by username
            getUsers: async () => {
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('*');
                
                if (error) {
                    console.error('Error fetching users:', error);
                    return {};
                }
                
                // Convert array to object keyed by username
                const usersObj = {};
                data.forEach(user => {
                    const normalizedUsername = (user.username || '').trim().toLowerCase();
                    if (!normalizedUsername) return;

                    usersObj[normalizedUsername] = {
                        nickname: user.nickname,
                        passwordHash: user.password_hash,
                        totalTries: user.total_tries,
                        jokerMatchId: user.joker_match_id,
                        supportedTeams: user.supported_teams ? user.supported_teams.split(',') : [],
                        predictions: {}  // Will be populated separately
                    };
                });
                
                // Fetch predictions for all users
                const { data: predictions, error: predError } = await supabaseClient
                    .from('predictions')
                    .select('*');
                
                if (!predError && predictions) {
                    // Map user_id to username
                    const userIdToUsername = {};
                    data.forEach(user => {
                        userIdToUsername[user.id] = (user.username || '').trim().toLowerCase();
                    });
                    
                    predictions.forEach(pred => {
                        const username = userIdToUsername[pred.user_id];
                        if (username && usersObj[username]) {
                            usersObj[username].predictions[pred.match_id] = {
                                team1: pred.team1_score,
                                team2: pred.team2_score
                            };
                        }
                    });
                }
                
                return usersObj;
            },
            
            // Save a single user (for registration/updates)
            saveUser: async (username, userData) => {
                username = (username || '').trim().toLowerCase();
                if (!username) return;

                // Check if user exists
                const { data: existing } = await supabaseClient
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single();
                
                if (existing) {
                    // Update existing user
                    const { error } = await supabaseClient
                        .from('users')
                        .update({
                            nickname: userData.nickname,
                            password_hash: userData.passwordHash,
                            total_tries: userData.totalTries,
                            joker_match_id: userData.jokerMatchId,
                            supported_teams: userData.supportedTeams && userData.supportedTeams.length > 0 ? userData.supportedTeams.join(',') : null
                        })
                        .eq('username', username);
                    
                    if (error) console.error('Error updating user:', error);
                } else {
                    // Insert new user
                    const { error } = await supabaseClient
                        .from('users')
                        .insert({
                            username: username,
                            nickname: userData.nickname,
                            password_hash: userData.passwordHash,
                            total_tries: userData.totalTries,
                            joker_match_id: userData.jokerMatchId,
                            supported_teams: userData.supportedTeams && userData.supportedTeams.length > 0 ? userData.supportedTeams.join(',') : null
                        });
                    
                    if (error) console.error('Error inserting user:', error);
                }
            },

            // Rename a user (update username in DB)
            renameUser: async (oldUsername, newUsername) => {
                oldUsername = (oldUsername || '').trim().toLowerCase();
                newUsername = (newUsername || '').trim().toLowerCase();
                if (!oldUsername || !newUsername) return;

                const { error } = await supabaseClient
                    .from('users')
                    .update({ username: newUsername })
                    .eq('username', oldUsername);

                if (error) console.error('Error renaming user:', error);
            },

            // Save predictions for a user
            savePredictions: async (username, predictions, totalTries) => {
                username = (username || '').trim().toLowerCase();
                if (!username) return;

                // Get user ID
                const { data: user } = await supabaseClient
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .single();
                
                if (!user) {
                    console.error('User not found:', username);
                    return;
                }
                
                // Update total tries
                await supabaseClient
                    .from('users')
                    .update({ total_tries: totalTries })
                    .eq('id', user.id);
                
                // Upsert predictions
                for (const [matchId, pred] of Object.entries(predictions)) {
                    const { error } = await supabaseClient
                        .from('predictions')
                        .upsert({
                            user_id: user.id,
                            match_id: parseInt(matchId),
                            team1_score: pred.team1,
                            team2_score: pred.team2,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'user_id,match_id'
                        });
                    
                    if (error) console.error('Error saving prediction:', error);
                }
            },
            
            // Delete a user
            deleteUser: async (username) => {
                username = (username || '').trim().toLowerCase();
                if (!username) return;

                const { error } = await supabaseClient
                    .from('users')
                    .delete()
                    .eq('username', username);
                
                if (error) console.error('Error deleting user:', error);
            },
            
            // Matches/Fixtures
            getMatches: async () => {
                const { data, error } = await supabaseClient
                    .from('matches')
                    .select('*')
                    .order('id');
                
                if (error) {
                    console.error('Error fetching matches:', error);
                    return null;
                }
                
                if (!data || data.length === 0) return null;
                
                // Convert to app format
                return data.map(m => ({
                    id: m.id,
                    round: m.round,
                    date: m.date,
                    time: m.time,
                    team1: m.team1,
                    team2: m.team2,
                    actualScore1: m.actual_score1,
                    actualScore2: m.actual_score2,
                    actualTries1: m.actual_tries1,
                    actualTries2: m.actual_tries2,
                    jokerEligible: m.joker_eligible || false
                }));
            },

            saveMatches: async (matchesData) => {
                // Delete all existing matches and re-insert
                await supabaseClient.from('matches').delete().neq('id', 0);
                
                const rows = matchesData.map(m => ({
                    id: m.id,
                    round: m.round,
                    date: m.date,
                    time: m.time,
                    team1: m.team1,
                    team2: m.team2,
                    actual_score1: m.actualScore1,
                    actual_score2: m.actualScore2,
                    actual_tries1: m.actualTries1,
                    actual_tries2: m.actualTries2,
                    joker_eligible: m.jokerEligible || false
                }));

                const { error } = await supabaseClient.from('matches').insert(rows);
                if (error) console.error('Error saving matches:', error);
            },
            
            // Admin usernames
            getAdminUsernames: async () => {
                const { data, error } = await supabaseClient
                    .from('admin_usernames')
                    .select('username');

                if (error) {
                    console.error('Error fetching admin usernames:', error);
                    return [];
                }

                return data
                    .map(row => (row.username || '').trim().toLowerCase())
                    .filter(Boolean);
            },

            saveAdminUsernames: async (usernames) => {
                // Delete all and re-insert
                await supabaseClient.from('admin_usernames').delete().neq('username', '');

                if (usernames.length > 0) {
                    const normalized = [...new Set(
                        usernames
                            .map(username => (username || '').trim().toLowerCase())
                            .filter(Boolean)
                    )];
                    const rows = normalized.map(username => ({ username }));
                    const { error } = await supabaseClient.from('admin_usernames').insert(rows);
                    if (error) console.error('Error saving admin usernames:', error);
                }
            },
            
            // App settings
            getSettings: async () => {
                const { data, error } = await supabaseClient
                    .from('settings')
                    .select('*');
                
                if (error || !data || data.length === 0) {
                    return { predictionsLocked: false };
                }
                
                const settings = {};
                data.forEach(row => {
                    if (row.key === 'predictions_locked') {
                        settings.predictionsLocked = row.value === 'true' || row.value === true;
                    }
                });
                
                return settings;
            },
            
            saveSettings: async (settings) => {
                const { error } = await supabaseClient
                    .from('settings')
                    .upsert({
                        key: 'predictions_locked',
                        value: settings.predictionsLocked ? 'true' : 'false'
                    }, {
                        onConflict: 'key'
                    });
                
                if (error) console.error('Error saving settings:', error);
            }
        };

        // In-memory state (loaded from storage on init)
        let users = {};
        let currentUsername = null;
        let adminUsernames = [];
        let appSettings = { predictionsLocked: false };
        let isGuest = false;
        let editingFixtureId = null;
        let adminPredictionUsername = null;
        const THEME_COOKIE_NAME = 'rugbyPredictorTheme';
        const THEME_STORAGE_KEY = 'rugbyPredictorTheme';
        const COOKIE_FALLBACK_PREFIX = 'rugbyPredictorCookieFallback:';

        // Loading state
        let isLoading = true;

        // Cookie helper functions
        function setCookie(name, value, days = 365) {
            try {
                localStorage.setItem(`${COOKIE_FALLBACK_PREFIX}${name}`, String(value));
            } catch (error) {
                // Ignore storage errors and continue with normal cookie write attempt.
            }

            if (window.location.protocol === 'file:') {
                return;
            }

            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        }

        function getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }

            try {
                return localStorage.getItem(`${COOKIE_FALLBACK_PREFIX}${name}`);
            } catch (error) {
                return null;
            }
        }

        function deleteCookie(name) {
            try {
                localStorage.removeItem(`${COOKIE_FALLBACK_PREFIX}${name}`);
            } catch (error) {
                // Ignore storage cleanup errors.
            }

            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        }

        // Initialize data from supabaseClient
        async function initializeData() {
            try {
                // Show loading indicator
                showLoadingScreen();
                
                // Load all data in parallel
                const [loadedUsers, loadedAdmins, loadedSettings, loadedMatches] = await Promise.all([
                    Storage.getUsers(),
                    Storage.getAdminUsernames(),
                    Storage.getSettings(),
                    Storage.getMatches()
                ]);
                
                users = loadedUsers;
                adminUsernames = loadedAdmins;
                appSettings = loadedSettings;
                
                // Load matches from database or use defaults
                if (loadedMatches && loadedMatches.length > 0) {
                    matches.length = 0;
                    loadedMatches.forEach(m => matches.push(m));
                }
                
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

        // Check if current user is admin
        function isCurrentUserAdmin() {
            if (!currentUsername || !users[currentUsername]) return false;
            return adminUsernames.includes(currentUsername);
        }

        // Initialize app
        function init() {
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
            const toggle = document.getElementById('lockToggle');
            if (toggle) {
                if (appSettings.predictionsLocked) {
                    toggle.classList.add('active');
                } else {
                    toggle.classList.remove('active');
                }
            }
        }

        // Render admin matches for entering results
        function renderAdminMatches() {
            const container = document.getElementById('adminMatchesContainer');
            if (!container) return;

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
            const match = matches.find(m => m.id === matchId);
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
            const modal = document.getElementById('editFixtureModal');
            if (modal) modal.classList.add('hidden');
        }

        async function saveFixtureEdits() {
            if (editingFixtureId === null) return;
            const match = matches.find(m => m.id === editingFixtureId);
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

            match.round = roundVal;
            match.team1 = team1Val;
            match.team2 = team2Val;
            match.date = dateVal ? formatDateForDisplay(dateVal) : 'TBD';
            match.time = timeVal || 'TBD';
            match.jokerEligible = jokerVal;

            match.actualScore1 = score1Val === '' ? null : parseInt(score1Val, 10);
            match.actualScore2 = score2Val === '' ? null : parseInt(score2Val, 10);
            match.actualTries1 = tries1Val === '' ? null : parseInt(tries1Val, 10);
            match.actualTries2 = tries2Val === '' ? null : parseInt(tries2Val, 10);

            await Storage.saveMatches(matches);
            closeEditFixtureModal();
            renderAdminMatches();
            renderMatches();
            showSummary();
        }

        // Parse a display date (e.g., "Sat, Feb 7") to ISO format for date input (e.g., "2026-02-07")
        function parseDateForInput(dateStr) {
            if (!dateStr || dateStr === 'TBD') return '';
            // Already ISO format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
            
            const months = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            
            // Try to parse "Day, Mon DD" format
            const match = dateStr.match(/(\w+),?\s*(\w+)\s+(\d+)/);
            if (match) {
                const month = months[match[2]];
                const day = match[3].padStart(2, '0');
                if (month) {
                    return `2026-${month}-${day}`;
                }
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
            // Find the highest existing ID
            const maxId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) : 0;
            // Find the highest round
            const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;
            
            const newMatch = {
                id: maxId + 1,
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

            matches.push(newMatch);
            await Storage.saveMatches(matches);
            renderAdminMatches();
            renderMatches();
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
            if (!confirm('This will delete all match data. Are you really sure?')) {
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
            
            // Find the highest existing ID
            const maxId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) : 0;
            let nextId = maxId + 1;
            
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
                    } else if (!match.date || match.date === 'TBD') {
                        match.date = 'TBD';
                    }
                }
                
                // Store time in HH:MM format
                if (timeEl && timeEl.value) {
                    match.time = timeEl.value;
                } else if (timeEl) {
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

        // Render competitor management table
        function renderCompetitorManagement() {
            const container = document.getElementById('competitorManagementContainer');
            const allUsers = Object.keys(users).sort((a, b) => a.localeCompare(b));

            const teams = Object.keys(countryFlags);

            let html = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Display Name</th>
                            <th>Supported Teams</th>
                            <th>Admin</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: rgba(52, 152, 219, 0.08);">
                            <td><input type="text" id="new-username-admin" placeholder="username" style="max-width: 150px;"></td>
                            <td>
                                <input type="text" id="new-nickname-admin" placeholder="Display name" style="max-width: 150px;">
                                <input type="password" id="new-password-admin" placeholder="Password (optional)" style="max-width: 150px; margin-top: 0.25rem;">
                            </td>
                            <td>
                                <select id="new-team1-admin" style="font-size: 0.85rem; margin-bottom: 0.25rem;">
                                    <option value="">None</option>
                                    ${teams.map(t => `<option value="${t}">${getFlag(t)} ${t}</option>`).join('')}
                                </select><br>
                                <select id="new-team2-admin" style="font-size: 0.85rem;">
                                    <option value="">None</option>
                                    ${teams.map(t => `<option value="${t}">${getFlag(t)} ${t}</option>`).join('')}
                                </select>
                            </td>
                            <td style="text-align: center;">
                                <input type="checkbox" id="new-admin-admin">
                            </td>
                            <td>
                                <div class="competitor-actions">
                                    <button class="btn-small btn-success" onclick="addCompetitorFromAdmin()">Add Competitor</button>
                                </div>
                            </td>
                        </tr>
            `;

            allUsers.forEach(username => {
                const user = users[username];
                const isAdmin = adminUsernames.includes(username);
                const safeUsername = username.replace(/'/g, "\\'");
                const userTeams = user.supportedTeams || [];
                html += `
                    <tr id="user-row-${username}">
                        <td><input type="text" id="edit-username-${username}" value="${username}" style="max-width: 150px;"></td>
                        <td><input type="text" id="edit-nickname-${username}" value="${user.nickname || ''}" style="max-width: 150px;"></td>
                        <td>
                            <select id="edit-team1-${username}" style="font-size: 0.85rem; margin-bottom: 0.25rem;">
                                <option value="">None</option>
                                ${teams.map(t => `<option value="${t}" ${userTeams[0] === t ? 'selected' : ''}>${getFlag(t)} ${t}</option>`).join('')}
                            </select><br>
                            <select id="edit-team2-${username}" style="font-size: 0.85rem;">
                                <option value="">None</option>
                                ${teams.map(t => `<option value="${t}" ${userTeams[1] === t ? 'selected' : ''}>${getFlag(t)} ${t}</option>`).join('')}
                            </select>
                        </td>
                        <td>
                            <input type="checkbox" id="edit-admin-${username}" ${isAdmin ? 'checked' : ''} onchange="toggleUserAdmin('${safeUsername}')">
                        </td>
                        <td>
                            <div class="competitor-actions">
                                <button class="btn-small btn-success" onclick="saveUserChanges('${safeUsername}')">Save</button>
                                <button class="btn-small btn-warning" onclick="resetUserPassword('${safeUsername}')">Reset Password</button>
                                <button class="btn-small btn-danger" onclick="deleteUser('${safeUsername}')">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            container.innerHTML = html;
        }

        // Add a new competitor from admin management screen
        async function addCompetitorFromAdmin() {
            const username = (document.getElementById('new-username-admin').value || '').trim().toLowerCase();
            const nickname = (document.getElementById('new-nickname-admin').value || '').trim();
            const password = document.getElementById('new-password-admin').value || '';
            const team1 = (document.getElementById('new-team1-admin').value || '').trim();
            const team2 = (document.getElementById('new-team2-admin').value || '').trim();
            const makeAdmin = !!document.getElementById('new-admin-admin').checked;

            if (!username) {
                alert('Username is required.');
                return;
            }

            if (!/^[a-z0-9]+$/.test(username)) {
                alert('Username can only contain letters and numbers.');
                return;
            }

            if (users[username]) {
                alert('This username is already taken.');
                return;
            }

            if (!nickname) {
                alert('Display name is required.');
                return;
            }

            const existingNickname = Object.keys(users).find(u =>
                users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingNickname) {
                alert('This display name is already taken.');
                return;
            }

            if (password && password.length < 4) {
                alert('If set, password must be at least 4 characters long.');
                return;
            }

            const supportedTeams = [team1, team2].filter(Boolean);
            const newUser = {
                nickname,
                passwordHash: password ? await hashPassword(password) : null,
                predictions: {},
                totalTries: null,
                supportedTeams
            };

            users[username] = newUser;
            await Storage.saveUser(username, newUser);

            if (makeAdmin && !adminUsernames.includes(username)) {
                adminUsernames.push(username);
                await Storage.saveAdminUsernames(adminUsernames);
            }

            alert(`Competitor ${toTitleCase(nickname)} added.`);
            renderCompetitorManagement();
            updateLeaderboard();
        }

        // Save changes to a user
        async function saveUserChanges(username) {
            const newUsername = document.getElementById(`edit-username-${username}`).value.trim().toLowerCase();
            const nickname = document.getElementById(`edit-nickname-${username}`).value.trim();

            if (!newUsername) {
                alert('Username is required.');
                return;
            }

            if (!/^[a-z0-9]+$/.test(newUsername)) {
                alert('Username can only contain letters and numbers.');
                return;
            }

            if (!nickname) {
                alert('Display name is required.');
                return;
            }

            // Check if new username is taken by another user
            if (newUsername !== username && users[newUsername]) {
                alert('This username is already taken by another user.');
                return;
            }

            // Check if nickname is taken by another user
            const existingUser = Object.keys(users).find(u =>
                u !== username && users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingUser) {
                alert('This display name is already taken by another user.');
                return;
            }

            // Read supported teams from dropdowns
            const team1El = document.getElementById(`edit-team1-${username}`);
            const team2El = document.getElementById(`edit-team2-${username}`);
            const team1 = team1El ? team1El.value : '';
            const team2 = team2El ? team2El.value : '';

            if (newUsername !== username) {
                // Username changed - update DB username, re-key local data, update admin list
                await Storage.renameUser(username, newUsername);

                // Update admin usernames list
                const adminIndex = adminUsernames.indexOf(username);
                if (adminIndex !== -1) {
                    adminUsernames[adminIndex] = newUsername;
                    await Storage.saveAdminUsernames(adminUsernames);
                }

                // Re-key in local users object
                users[newUsername] = users[username];
                delete users[username];

                // Update current session if editing self
                if (currentUsername === username) {
                    currentUsername = newUsername;
                    setCookie('rugbyPredictorUser', newUsername);
                }
            }

            users[newUsername].nickname = nickname;
            users[newUsername].supportedTeams = [team1, team2].filter(Boolean);

            await Storage.saveUser(newUsername, users[newUsername]);
            alert('User updated successfully.');

            // Update current user display if editing self
            if (newUsername === currentUsername) {
                document.getElementById('currentUser').textContent = toTitleCase(nickname);
            }

            // Re-render to update row IDs and input IDs
            renderCompetitorManagement();
        }

        // Toggle user admin status
        async function toggleUserAdmin(username) {
            const user = users[username];
            if (!user) return;

            const isCurrentlyAdmin = adminUsernames.includes(username);

            if (isCurrentlyAdmin) {
                // Remove from admins
                adminUsernames = adminUsernames.filter(u => u !== username);
            } else {
                // Add to admins
                adminUsernames.push(username);
            }

            await Storage.saveAdminUsernames(adminUsernames);
        }

        // Delete a user
        async function deleteUser(username) {
            if (!username || !users[username]) {
                alert('User not found.');
                return;
            }
            
            if (username === currentUsername) {
                alert('You cannot delete your own account while logged in.');
                return;
            }

            const displayName = toTitleCase(users[username].nickname || username);
            if (!confirm(`Are you sure you want to delete ${displayName}? This cannot be undone.`)) {
                return;
            }

            // Remove from admin list if they were an admin
            adminUsernames = adminUsernames.filter(u => u !== username);
            await Storage.saveAdminUsernames(adminUsernames);

            delete users[username];
            await Storage.deleteUser(username);
            renderCompetitorManagement();
            updateLeaderboard();
        }

        // Reset a user's password
        async function resetUserPassword(username) {
            if (!username || !users[username]) {
                alert('User not found.');
                return;
            }

            const displayName = toTitleCase(users[username].nickname || username);
            if (!confirm(`Are you sure you want to remove the password for ${displayName}? Their password will be cleared.`)) {
                return;
            }

            // Remove existing password
            users[username].passwordHash = null;
            delete users[username].password;
            await Storage.saveUser(username, users[username]);
            
            alert(`Password removed for ${displayName}.`);
            renderCompetitorManagement();
        }

        let profileInitialState = null;
        let profileHasInteracted = false;

        function normalizeTeamSelection(teams) {
            return [...(teams || [])].sort((a, b) => a.localeCompare(b));
        }

        function getProfileFormState() {
            return {
                nickname: document.getElementById('profileDisplayName').value.trim(),
                currentPassword: document.getElementById('profileCurrentPassword').value,
                newPassword: document.getElementById('profileNewPassword').value,
                confirmPassword: document.getElementById('profileConfirmPassword').value,
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
                currentState.currentPassword !== profileInitialState.currentPassword ||
                currentState.newPassword !== profileInitialState.newPassword ||
                currentState.confirmPassword !== profileInitialState.confirmPassword ||
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
            const hasExistingPassword = !!(user.passwordHash || user.password);
            const currentPasswordInput = document.getElementById('profileCurrentPassword');
            const passwordHint = document.getElementById('profilePasswordHint');

            document.getElementById('profileUsername').value = currentUsername;
            document.getElementById('profileDisplayName').value = user.nickname || '';
            currentPasswordInput.value = '';
            document.getElementById('profileNewPassword').value = '';
            document.getElementById('profileConfirmPassword').value = '';

            if (hasExistingPassword) {
                currentPasswordInput.disabled = false;
                currentPasswordInput.placeholder = 'Enter current password';
                currentPasswordInput.title = '';
                passwordHint.textContent = 'Leave blank to keep your current password.';
            } else {
                currentPasswordInput.disabled = true;
                currentPasswordInput.placeholder = 'No current password set';
                currentPasswordInput.title = 'There is no current password set';
                passwordHint.textContent = 'No current password is set. Enter a new password below to add one, or leave blank to keep no password.';
            }

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
            document.getElementById('profileCurrentPassword').oninput = markProfileInteraction;
            document.getElementById('profileNewPassword').oninput = markProfileInteraction;
            document.getElementById('profileConfirmPassword').oninput = markProfileInteraction;
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
            const hasExistingPassword = !!(user.passwordHash || user.password);
            const nickname = document.getElementById('profileDisplayName').value.trim();
            const currentPassword = document.getElementById('profileCurrentPassword').value;
            const newPassword = document.getElementById('profileNewPassword').value;
            const confirmPassword = document.getElementById('profileConfirmPassword').value;
            const feedbackEl = document.getElementById('profileFeedback');

            feedbackEl.classList.add('hidden');
            feedbackEl.className = 'login-feedback hidden';

            if (!nickname) {
                feedbackEl.textContent = 'Display name is required.';
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

            // Handle password change
            const isChangingPassword = hasExistingPassword
                ? !!(currentPassword || newPassword || confirmPassword)
                : !!(newPassword || confirmPassword);

            if (isChangingPassword) {
                if (hasExistingPassword) {
                    if (!currentPassword) {
                        feedbackEl.textContent = 'Please enter your current password.';
                        feedbackEl.classList.remove('hidden');
                        feedbackEl.classList.add('error');
                        return;
                    }

                    let isValid = false;
                    if (user.passwordHash) {
                        isValid = await verifyPassword(currentPassword, user.passwordHash);
                    } else if (user.password) {
                        isValid = user.password === currentPassword;
                    }

                    if (!isValid) {
                        feedbackEl.textContent = 'Current password is incorrect.';
                        feedbackEl.classList.remove('hidden');
                        feedbackEl.classList.add('error');
                        return;
                    }
                }

                if (!newPassword) {
                    feedbackEl.textContent = 'Please enter a new password.';
                    feedbackEl.classList.remove('hidden');
                    feedbackEl.classList.add('error');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    feedbackEl.textContent = 'New passwords do not match.';
                    feedbackEl.classList.remove('hidden');
                    feedbackEl.classList.add('error');
                    return;
                }

                if (newPassword.length < 4) {
                    feedbackEl.textContent = 'Password must be at least 4 characters.';
                    feedbackEl.classList.remove('hidden');
                    feedbackEl.classList.add('error');
                    return;
                }

                user.passwordHash = await hashPassword(newPassword);
                delete user.password;
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

        // Change theme
        async function changeTheme(theme) {
            const normalizedTheme = ['classic', 'retro', 'dark'].includes(theme) ? theme : 'classic';

            // Apply theme to document
            if (normalizedTheme === 'classic') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', normalizedTheme);
            }

            // Update the selector immediately
            const selector = document.getElementById('themeSelect');
            if (selector) {
                selector.value = normalizedTheme;
            }

            // Save theme to cookie so it persists across page reloads
            setCookie(THEME_COOKIE_NAME, normalizedTheme);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
            } catch (error) {
                // Ignore storage errors.
            }
            
            // Save to user's account if logged in
            if (currentUsername && users[currentUsername]) {
                users[currentUsername].theme = normalizedTheme;
                try {
                    await Storage.saveUser(currentUsername, users[currentUsername]);
                } catch (error) {
                    console.error('Failed to persist theme to user profile:', error);
                }
            }
        }

        // Load user's saved theme
        function loadUserTheme() {
            let storageTheme = '';
            try {
                storageTheme = (localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase();
            } catch (error) {
                storageTheme = '';
            }
            const cookieTheme = (getCookie(THEME_COOKIE_NAME) || '').trim().toLowerCase();
            const userTheme = currentUsername && users[currentUsername] ? users[currentUsername].theme : null;
            changeTheme(storageTheme || cookieTheme || userTheme || 'classic');
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

        // Show/hide login forms
        function showLoginForm(type) {
            const existingForm = document.getElementById('existingUserForm');
            const newForm = document.getElementById('newUserForm');
            const toggleBtns = document.querySelectorAll('.toggle-btn');
            const feedbackEl = document.getElementById('loginFeedback');

            // Clear feedback
            feedbackEl.classList.add('hidden');
            feedbackEl.className = 'login-feedback hidden';

            // Toggle forms
            if (type === 'existing') {
                existingForm.classList.remove('hidden');
                newForm.classList.add('hidden');
                toggleBtns[0].classList.add('active');
                toggleBtns[1].classList.remove('active');
            } else {
                existingForm.classList.add('hidden');
                newForm.classList.remove('hidden');
                toggleBtns[0].classList.remove('active');
                toggleBtns[1].classList.add('active');
            }
        }

        // Login as guest (view only)
        function loginAsGuest() {
            isGuest = true;
            currentUsername = null;
            showAppAsGuest();
        }

        // Login existing user
        async function loginExisting() {
            const username = document.getElementById('existingUsername').value.trim().toLowerCase();
            const password = document.getElementById('existingPassword').value;
            const feedbackEl = document.getElementById('loginFeedback');

            // Clear previous feedback
            feedbackEl.classList.add('hidden');
            feedbackEl.className = 'login-feedback hidden';

            if (!username) {
                showLoginFeedback('Please enter your username.', 'error');
                return;
            }

            // Check if user exists
            if (!users[username]) {
                showLoginFeedback('Username not found. Please check and try again.', 'error');
                return;
            }

            const hasPassword = !!(users[username].passwordHash || users[username].password);
            if (hasPassword && !password) {
                showLoginFeedback('Please enter both username and password.', 'error');
                return;
            }

            // Check password - support both hashed and legacy plain text passwords
            let passwordValid = false;
            if (!hasPassword) {
                passwordValid = true;
            } else if (users[username].passwordHash) {
                // New hashed password
                passwordValid = await verifyPassword(password, users[username].passwordHash);
            } else if (users[username].password) {
                // Legacy plain text password - migrate to hash on successful login
                if (users[username].password === password) {
                    passwordValid = true;
                    // Migrate to hashed password
                    users[username].passwordHash = await hashPassword(password);
                    delete users[username].password;
                    await Storage.saveUser(username, users[username]);
                }
            }

            if (!passwordValid) {
                showLoginFeedback('Incorrect password. Please try again.', 'error');
                return;
            }

            // Successful login
            showLoginFeedback('Login successful. Welcome back, ' + toTitleCase(users[username].nickname) + '.', 'success');
            currentUsername = username;
            setCookie('rugbyPredictorUser', username);
            setTimeout(() => {
                showApp();
            }, 800);
        }

        // Register new user
        async function registerNewUser() {
            const username = document.getElementById('newUsername').value.trim().toLowerCase();
            const nickname = document.getElementById('nickname').value.trim();
            const password = document.getElementById('newPassword').value;

            // Validation
            if (!username || !nickname || !password) {
                showLoginFeedback('Please fill in all fields.', 'error');
                return;
            }

            // Username format validation
            if (!/^[a-z0-9]+$/.test(username)) {
                showLoginFeedback('Username can only contain letters and numbers.', 'error');
                return;
            }

            // Check if username already exists
            if (users[username]) {
                showLoginFeedback('This username is already taken. Please choose another.', 'error');
                return;
            }

            // Check if nickname already exists
            const existingUser = Object.keys(users).find(u =>
                users[u].nickname && users[u].nickname.toLowerCase() === nickname.toLowerCase()
            );
            if (existingUser) {
                showLoginFeedback('This display name is already taken. Please choose another.', 'error');
                return;
            }

            // Check if this is the first user - they become admin automatically
            const isFirstUser = Object.keys(users).length === 0;

            // Hash the password
            const passwordHash = await hashPassword(password);

            // Get selected supported teams
            const supportedTeams = getSelectedTeams('registerTeamsPicker');

            // Create new user with hashed password
            users[username] = {
                nickname: nickname,
                passwordHash: passwordHash,
                predictions: {},
                totalTries: null,
                supportedTeams: supportedTeams
            };

            await Storage.saveUser(username, users[username]);

            // Make first user an admin
            if (isFirstUser) {
                adminUsernames.push(username);
                await Storage.saveAdminUsernames(adminUsernames);
                showLoginFeedback('Account created. As the first user, you are now an Admin. Welcome, ' + toTitleCase(nickname) + '.', 'info');
            } else {
                showLoginFeedback('Competitor account created. Welcome, ' + toTitleCase(nickname) + '.', 'info');
            }

            currentUsername = username;
            setCookie('rugbyPredictorUser', username);

            setTimeout(() => {
                showApp();
            }, 1000);
        }

        // Show login feedback
        function showLoginFeedback(message, type) {
            const feedbackEl = document.getElementById('loginFeedback');
            feedbackEl.textContent = message;
            feedbackEl.classList.remove('hidden', 'success', 'error', 'info');
            feedbackEl.classList.add(type);
        }

        // Handle Enter key on login inputs
        function handleLoginKeyPress(event, formType) {
            if (event.key === 'Enter') {
                if (formType === 'existing') {
                    loginExisting();
                } else if (formType === 'new') {
                    registerNewUser();
                }
            }
        }

        // Logout
        function logout() {
            currentUsername = null;
            isGuest = false;
            deleteCookie('rugbyPredictorUser');
            document.getElementById('loginView').classList.remove('hidden');
            document.getElementById('appView').classList.add('hidden');

            // Reset logout button text
            const logoutBtn = document.getElementById('logoutBtn');
            logoutBtn.textContent = 'Logout';

            // Clear all login form fields
            document.getElementById('existingUsername').value = '';
            document.getElementById('existingPassword').value = '';
            document.getElementById('newUsername').value = '';
            document.getElementById('nickname').value = '';
            document.getElementById('newPassword').value = '';

            // Reset to existing user form
            showLoginForm('existing');
        }

        // Show app
        function showApp() {
            isGuest = false;
            document.getElementById('loginView').classList.add('hidden');
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

            // Load user's saved theme
            loadUserTheme();

            // Update lock toggle UI
            updateLockToggleUI();

            // Initialize round selector dropdown
            initRoundSelector();

            // Always land on Match Summary after login.
            document.getElementById('predictionsTab').classList.add('hidden');
            document.getElementById('summaryTab').classList.remove('hidden');
            document.getElementById('competitorsTab').classList.add('hidden');
            document.getElementById('scoreCorrectionsTab').classList.add('hidden');
            document.getElementById('resultsTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');
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
            document.getElementById('recoveryTab').classList.add('hidden');

            // Show summary
            showSummary();
        }

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

        function getDisplayName(username) {
            if (!users[username]) return username;
            return toTitleCase(users[username].nickname || username);
        }

        function populateAdminPredictionUserSelect() {
            const select = document.getElementById('adminPredictionUserSelect');
            if (!select) return;

            const allUsers = Object.keys(users).sort((a, b) => {
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

        function renderAdminScoreCorrections() {
            const container = document.getElementById('adminUserMatchesContainer');
            const triesSection = document.getElementById('adminTriesSection');
            if (!container) return;

            populateAdminPredictionUserSelect();

            const username = adminPredictionUsername;
            if (!username || !users[username]) {
                container.innerHTML = '<p style="text-align: center; opacity: 0.8;">No competitor selected.</p>';
                const triesInput = document.getElementById('adminTotalTries');
                if (triesInput) triesInput.value = '';
                if (triesSection) triesSection.classList.add('hidden');
                return;
            }

            if (triesSection) triesSection.classList.remove('hidden');

            let currentRound = 0;
            let html = `<div class="unlock-banner">Editing predictions for <strong>${getDisplayName(username)}</strong>. Changes are saved automatically.</div>`;

            matches.forEach(match => {
                if (match.round !== currentRound) {
                    currentRound = match.round;
                    html += `<h2 style="font-family: 'Bebas Neue', cursive; font-size: 1.8rem; color: var(--bright-gold); margin: 1.5rem 0 0.75rem 0; letter-spacing: 0.1em;">Round ${currentRound}</h2>`;
                }

                const isJoker = users[username] && users[username].jokerMatchId === match.id;
                const jokerCardClass = isJoker ? ' joker-selected' : '';
                const jokerSection = match.jokerEligible ? `
                    <div class="joker-selection">
                        <label class="joker-label">
                            <input type="radio" name="adminJokerMatch" class="joker-checkbox" value="${match.id}"
                                ${isJoker ? 'checked' : ''}
                                onchange="selectAdminJoker(${match.id})">
                            <span class="joker-icon">🃏</span>
                            <span class="joker-text">Joker (2x points)</span>
                        </label>
                    </div>
                ` : '';

                html += `
                    <div class="match-card${jokerCardClass}" id="admin-match-card-${match.id}">
                        <div class="match-header">${match.date} - ${match.time} <span class="match-saved-indicator" id="admin-saved-${match.id}"></span></div>
                        <div class="match-teams">
                            <div class="team">
                                <div class="team-flag">${getFlag(match.team1)}</div>
                                <div class="team-name">${match.team1}</div>
                                <input type="number" class="score-input" id="admin-team1-${match.id}" min="0" placeholder="0" onblur="autoSaveAdminPredictions()">
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-flag">${getFlag(match.team2)}</div>
                                <div class="team-name">${match.team2}</div>
                                <input type="number" class="score-input" id="admin-team2-${match.id}" min="0" placeholder="0" onblur="autoSaveAdminPredictions()">
                            </div>
                        </div>
                        ${jokerSection}
                    </div>
                `;
            });

            container.innerHTML = html;
            loadAdminPredictions();
            updateAdminSavedIndicators();
        }

        function loadAdminPredictions() {
            const username = adminPredictionUsername;
            const userData = username ? users[username] : null;
            if (!userData) return;

            if (userData.predictions) {
                Object.keys(userData.predictions).forEach(matchId => {
                    const pred = userData.predictions[matchId];
                    const team1Input = document.getElementById(`admin-team1-${matchId}`);
                    const team2Input = document.getElementById(`admin-team2-${matchId}`);
                    if (team1Input) team1Input.value = pred.team1;
                    if (team2Input) team2Input.value = pred.team2;
                });
            }

            const triesInput = document.getElementById('adminTotalTries');
            if (triesInput) {
                triesInput.value = userData.totalTries === null || userData.totalTries === undefined
                    ? ''
                    : userData.totalTries;
            }
        }

        function updateAdminSavedIndicators() {
            const username = adminPredictionUsername;
            const userData = username ? users[username] : null;
            if (!userData || !userData.predictions) return;

            matches.forEach(match => {
                const indicator = document.getElementById(`admin-saved-${match.id}`);
                if (!indicator) return;

                if (userData.predictions[match.id]) {
                    indicator.textContent = '✓';
                    indicator.classList.add('visible');
                } else {
                    indicator.textContent = '';
                    indicator.classList.remove('visible');
                }
            });
        }

        async function autoSaveAdminPredictions() {
            const username = adminPredictionUsername;
            if (!username || !users[username]) return;

            const predictions = {};
            matches.forEach(match => {
                const team1Input = document.getElementById(`admin-team1-${match.id}`);
                const team2Input = document.getElementById(`admin-team2-${match.id}`);
                const team1Score = team1Input ? team1Input.value : '';
                const team2Score = team2Input ? team2Input.value : '';

                if (team1Score !== '' && team2Score !== '') {
                    predictions[match.id] = {
                        team1: parseInt(team1Score, 10),
                        team2: parseInt(team2Score, 10)
                    };
                }
            });

            const triesInput = document.getElementById('adminTotalTries');
            const totalTries = triesInput ? triesInput.value : '';
            const newTries = totalTries === '' ? null : parseInt(totalTries, 10);

            users[username].predictions = predictions;
            users[username].totalTries = newTries;
            await Storage.savePredictions(username, predictions, newTries);
            updateAdminSavedIndicators();
        }

        async function selectAdminJoker(matchId) {
            const username = adminPredictionUsername;
            if (!username || !users[username]) return;
            users[username].jokerMatchId = matchId;
            await Storage.saveUser(username, users[username]);
            renderAdminScoreCorrections();
        }

        // Render matches
        function renderMatches() {
            const container = document.getElementById('matchesContainer');
            let currentRound = 0;
            let html = '';
            
            // Calculate outstanding predictions
            const { outstandingCount, hasTries } = getOutstandingPredictionStatus(currentUsername);
            
            // Show lock status banner at top
            if (appSettings.predictionsLocked) {
                html += '<div class="lock-banner">🔒 Predictions are LOCKED. You cannot make changes.</div>';
            } else {
                html += '<div class="unlock-banner">🔓 Predictions are OPEN. Your changes are saved automatically.</div>';
            }
            
            // Show outstanding predictions banner if there are any
            if (!appSettings.predictionsLocked && (outstandingCount > 0 || !hasTries)) {
                html += `<div id="outstandingBanner" class="outstanding-banner">
                    <span class="outstanding-banner-icon">⚠️</span>
                    <span class="outstanding-banner-text">${buildOutstandingBannerText(outstandingCount, hasTries)}</span>
                </div>`;
            } else if (!appSettings.predictionsLocked) {
                // Add hidden banner that can be shown later if predictions are removed
                html += `<div id="outstandingBanner" class="outstanding-banner" style="display: none;">
                    <span class="outstanding-banner-icon">⚠️</span>
                    <span class="outstanding-banner-text"></span>
                </div>`;
            }

            matches.forEach(match => {
                // Add round header if it's a new round
                if (match.round !== currentRound) {
                    currentRound = match.round;
                    html += `<h2 style="font-family: 'Bebas Neue', cursive; font-size: 1.8rem; color: var(--bright-gold); margin: 1.5rem 0 0.75rem 0; letter-spacing: 0.1em;">Round ${currentRound}</h2>`;
                }

                const disabledAttr = appSettings.predictionsLocked ? 'disabled' : '';
                const disabledStyle = appSettings.predictionsLocked ? 'opacity: 0.6; cursor: not-allowed;' : '';
                const onBlurHandler = appSettings.predictionsLocked ? '' : 'onblur="autoSavePredictions()"';

                const isJoker = users[currentUsername] && users[currentUsername].jokerMatchId === match.id;
                const jokerCardClass = isJoker ? ' joker-selected' : '';
                const jokerSection = match.jokerEligible ? `
                    <div class="joker-selection">
                        <label class="joker-label">
                            <input type="radio" name="jokerMatch" class="joker-checkbox" value="${match.id}"
                                ${isJoker ? 'checked' : ''} ${disabledAttr}
                                onchange="selectJoker(${match.id})" style="${disabledStyle}">
                            <span class="joker-icon">🃏</span>
                            <span class="joker-text">Joker (2x points)</span>
                        </label>
                    </div>
                ` : '';

                html += `
                    <div class="match-card${jokerCardClass}" id="match-card-${match.id}">
                        <div class="match-header">${match.date} - ${match.time} <span class="match-saved-indicator" id="saved-${match.id}"></span></div>
                        <div class="match-teams">
                            <div class="team">
                                <div class="team-flag">${getFlag(match.team1)}</div>
                                <div class="team-name">${match.team1}</div>
                                <input type="number" class="score-input" id="team1-${match.id}" min="0" placeholder="0" ${disabledAttr} ${onBlurHandler} style="${disabledStyle}">
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-flag">${getFlag(match.team2)}</div>
                                <div class="team-name">${match.team2}</div>
                                <input type="number" class="score-input" id="team2-${match.id}" min="0" placeholder="0" ${disabledAttr} ${onBlurHandler} style="${disabledStyle}">
                            </div>
                        </div>
                        ${jokerSection}
                    </div>
                `;
            });

            container.innerHTML = html;
            
            // Also disable/enable tries input
            const triesInput = document.getElementById('totalTries');
            
            if (triesInput) {
                triesInput.disabled = appSettings.predictionsLocked;
                triesInput.style.opacity = appSettings.predictionsLocked ? '0.6' : '1';
                triesInput.style.cursor = appSettings.predictionsLocked ? 'not-allowed' : '';
                // Add onblur for auto-save
                if (!appSettings.predictionsLocked) {
                    triesInput.onblur = autoSavePredictions;
                } else {
                    triesInput.onblur = null;
                }
            }
            
            // Update saved indicators for matches that already have predictions
            updateSavedIndicators();
        }

        // Update the saved tick indicators for all matches
        function updateSavedIndicators() {
            const userData = users[currentUsername];
            if (!userData || !userData.predictions) return;
            
            matches.forEach(match => {
                const indicator = document.getElementById(`saved-${match.id}`);
                if (indicator) {
                    if (userData.predictions[match.id]) {
                        indicator.textContent = '✓';
                        indicator.classList.add('visible');
                    } else {
                        indicator.textContent = '';
                        indicator.classList.remove('visible');
                    }
                }
            });
        }

        // Auto-save predictions on blur
        async function autoSavePredictions() {
            if (appSettings.predictionsLocked) return;
            
            const predictions = {};
            
            matches.forEach(match => {
                const team1Input = document.getElementById(`team1-${match.id}`);
                const team2Input = document.getElementById(`team2-${match.id}`);
                const team1Score = team1Input ? team1Input.value : '';
                const team2Score = team2Input ? team2Input.value : '';
                
                // Only save if BOTH scores have been entered
                if (team1Score !== '' && team2Score !== '') {
                    predictions[match.id] = {
                        team1: parseInt(team1Score),
                        team2: parseInt(team2Score)
                    };
                }
            });

            const totalTriesInput = document.getElementById('totalTries');
            const totalTries = totalTriesInput ? totalTriesInput.value : '';
            const newTries = totalTries ? parseInt(totalTries) : null;

            users[currentUsername].predictions = predictions;
            users[currentUsername].totalTries = newTries;
            await Storage.savePredictions(currentUsername, predictions, newTries);

            // Update the tick indicators
            updateSavedIndicators();
            
            // Update the outstanding banner in real time
            updateOutstandingBanner();
        }
        
        // Select joker match
        async function selectJoker(matchId) {
            if (appSettings.predictionsLocked) return;
            users[currentUsername].jokerMatchId = matchId;
            await Storage.saveUser(currentUsername, users[currentUsername]);
            // Re-render to update card highlight and re-populate inputs
            renderMatches();
            loadPredictions();
        }

        // Update the outstanding predictions banner
        function updateOutstandingBanner() {
            const banner = document.getElementById('outstandingBanner');
            if (!banner) return;
            
            const { outstandingCount, hasTries } = getOutstandingPredictionStatus(currentUsername);
            
            if (appSettings.predictionsLocked || (outstandingCount === 0 && hasTries)) {
                banner.style.display = 'none';
                return;
            }
            
            banner.style.display = 'flex';

            banner.querySelector('.outstanding-banner-text').innerHTML = buildOutstandingBannerText(outstandingCount, hasTries);
        }

        // Save predictions
        // Load predictions
        function loadPredictions() {
            const userData = users[currentUsername];
            if (userData.predictions) {
                Object.keys(userData.predictions).forEach(matchId => {
                    const pred = userData.predictions[matchId];
                    document.getElementById(`team1-${matchId}`).value = pred.team1;
                    document.getElementById(`team2-${matchId}`).value = pred.team2;
                });
            }
            if (userData.totalTries) {
                document.getElementById('totalTries').value = userData.totalTries;
            }
        }

        // Shared scoring logic used across leaderboard, summary, and PDF export.
        function calculateMatchPoints(prediction, match, isJoker = false) {
            if (!prediction || match.actualScore1 === null || match.actualScore2 === null) {
                return null;
            }

            const actualResult = getResult(match.actualScore1, match.actualScore2);
            const predictedResult = getResult(prediction.team1, prediction.team2);
            let points = 0;

            if (actualResult === predictedResult) {
                points += 3;

                const team1Diff = Math.abs(prediction.team1 - match.actualScore1);
                const team2Diff = Math.abs(prediction.team2 - match.actualScore2);

                if (team1Diff === 0 && team2Diff === 0) {
                    points += 3;
                } else {
                    if (team1Diff <= 5) points += 1;
                    if (team2Diff <= 5) points += 1;
                }

                if (actualResult === 'draw') {
                    points += 2;
                }
            }

            if (isJoker) {
                points *= 2;
            }

            return points;
        }

        // Calculate points based on scoring rules
        function calculatePoints(username) {
            const user = users[username];
            if (!user) return 0;
            let totalPoints = 0;

            matches.forEach(match => {
                const prediction = user.predictions[match.id];
                const matchPoints = calculateMatchPoints(prediction, match, user.jokerMatchId === match.id);
                if (matchPoints !== null) totalPoints += matchPoints;
            });

            return totalPoints;
        }

        // Helper function to determine result (win/draw)
        function getResult(score1, score2) {
            if (score1 > score2) return 'team1';
            if (score2 > score1) return 'team2';
            return 'draw';
        }

        // Update leaderboard
        function updateLeaderboard() {
            // Update tries stats and Trev's Tips
            updateTriesStats();
        }

        // Update the tries stats display above leaderboard
        function updateTriesStats() {
            const container = document.getElementById('triesStatsContainer');
            if (!container) return;
            
            const totalActualTries = getTotalActualTries();
            const completedMatches = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatches = matches.length;
            const remainingMatches = totalMatches - completedMatches;
            
            let estimatedTotal = '-';
            let avgPerMatch = '-';
            
            if (completedMatches > 0) {
                avgPerMatch = (totalActualTries / completedMatches).toFixed(1);
                estimatedTotal = Math.round((totalActualTries / completedMatches) * totalMatches);
            }
            
            container.innerHTML = `
                <div class="tries-stats-title">Tournament Tries</div>
                <div class="tries-stats-grid">
                    <div class="tries-stat">
                        <div class="tries-stat-value">${totalActualTries}</div>
                        <div class="tries-stat-label">Tries So Far</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${completedMatches}/${totalMatches}</div>
                        <div class="tries-stat-label">Matches Completed</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${avgPerMatch}</div>
                        <div class="tries-stat-label">Avg Per Match</div>
                    </div>
                    <div class="tries-stat">
                        <div class="tries-stat-value">${estimatedTotal}</div>
                        <div class="tries-stat-label">Estimated Total</div>
                    </div>
                </div>
            `;
            
            // Update Trev's Tips
            updateTrevsTips();
        }

        // Generate Trev's Tips - fun commentary on the competition
        function updateTrevsTips() {
            const container = document.getElementById('trevsTipsContainer');
            if (!container) return;
            
            const allUsers = Object.keys(users);
            if (allUsers.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            // Get leaderboard data
            const leaderboardData = allUsers.map(username => ({
                nickname: toTitleCase(users[username].nickname || username),
                points: calculatePoints(username),
                username: username
            })).sort((a, b) => b.points - a.points);
            
            // Get completed matches with results
            const completedMatches = matches.filter(m => m.actualScore1 !== null && m.actualScore2 !== null);
            const recentMatch = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;
            
            // Generate tips based on current state
            let tip = '';
            
            const gloucesterRefs = [
                "showing the kind of form Gloucester had in the 2002-03 Zurich Premiership",
                "more dominant than Gloucester's pack on a muddy Kingsholm afternoon",
                "channeling serious Cherry and White energy",
                "playing it tighter than a Gloucester maul five metres out",
                "with the precision of a prime James Simpson-Daniel sidestep",
                "looking sharper than Mike Teague on a charge against the All Blacks",
                "more relentless than a Kingsholm crowd in full voice on a Friday night",
                "as solid as the Shed End faithful in December",
                "with the guile of a young Jeremy Guscott cutting through the defence",
                "fiercer than the Bath-Gloucester derby in the 80s",
                "tougher than playing at the Rec in February without gloves",
                "more committed than Phil Vickery scrummaging on a wet Wednesday",
                "steadier than Don Caskie slotting penalties in the wind",
                "showing more heart than Gloucester's 2003 Powergen Cup final win",
                "hungrier than a young Olly Morgan chasing a high ball",
                "more unpredictable than a Friday night under the lights at Kingsholm",
                "with the power of the Cherry and Whites in their Heineken Cup days",
                "as fearless as Marcel Garvey running at a full defence",
                "with the footwork of Terry Fanolua dancing through tackles",
                "hitting harder than Junior Paramore on a rampaging burst",
                "showing the consistency of Andy Gomarsall's box kicking",
                "as reliable as Henry Paul pulling the strings at fly-half",
                "more clinical than Ludovic Mercier slotting kicks from the touchline",
                "with the vision of Ryan Lamb spotting gaps in the defence",
                "as explosive as Lesley Vainikolo in full flight down the wing",
                "tougher than the Kingsholm pitch after a week of West Country rain",
                "showing the never-say-die attitude of the 2006-07 EDF Energy Cup winners",
                "as fired up as Kingsholm on derby day against Bath",
                "with the composure of Greig Laidlaw knocking over late pressure kicks in Cherry and White",
                "as clinical as Charlie Sharples finishing in the corner at full pace",
                "like Gloucester in full flow during those Heineken Cup nights under the lights"
            ];

            const worldCupClassicRefs = [
                "the 1995 World Cup final in Johannesburg",
                "France's stunning comeback against New Zealand in the 1999 World Cup semi-final",
                "Jonny Wilkinson's 2003 World Cup final drop goal in Sydney",
                "France v New Zealand in the 2007 World Cup quarter-final in Cardiff",
                "the 2007 World Cup final arm wrestle between South Africa and England"
            ];
            
            const randomGloucester = gloucesterRefs[Math.floor(Math.random() * gloucesterRefs.length)];
            const randomGloucester2 = gloucesterRefs[Math.floor(Math.random() * gloucesterRefs.length)];
            const randomWorldCupClassic = worldCupClassicRefs[Math.floor(Math.random() * worldCupClassicRefs.length)];
            const nextMatch = matches.find(m => m.actualScore1 === null || m.actualScore2 === null);
            const nextFixtureText = nextMatch
                ? `Next up we have ${nextMatch.team1} vs ${nextMatch.team2} on ${nextMatch.date} at ${nextMatch.time}.`
                : '';
            const nextFixtureWithHistory = nextFixtureText;
            
            if (completedMatches.length === 0) {
                tip = `No matches played yet, but the tension is building like ${randomWorldCupClassic}! Get your predictions in sharpish - this isn't a Gloucester training session where you can take your time. The tournament kicks off soon and every point counts. Make sure you've got all your scores in before kick-off - no late changes allowed once the whistle blows! Remember, predicting a draw gets you bonus points, and if you nail the exact score, you'll be celebrating like Gloucester winning the Premiership. ${nextFixtureWithHistory}`;
            } else if (leaderboardData.length === 1) {
                tip = `${leaderboardData[0].nickname} is currently the only competitor - ${randomGloucester}! Bit lonely at the top though, like being the only person who remembers Gloucester's Powergen Cup wins. Get some mates involved and make this a proper competition! The more the merrier, as they say down at Kingsholm on match day. ${nextFixtureWithHistory}`;
            } else {
                const leader = leaderboardData[0];
                const second = leaderboardData[1];
                const gap = leader.points - second.points;
                const remainingMatches = matches.length - completedMatches.length;
                const scoreGroups = {};
                leaderboardData.forEach(entry => {
                    if (!scoreGroups[entry.points]) scoreGroups[entry.points] = [];
                    scoreGroups[entry.points].push(entry.nickname);
                });

                const multiWayTies = Object.keys(scoreGroups)
                    .map(points => ({ points: parseInt(points, 10), names: scoreGroups[points] }))
                    .filter(group => group.names.length >= 3)
                    .sort((a, b) => b.points - a.points);

                let tieAnalysis = '';
                if (multiWayTies.length > 0) {
                    const tie = multiWayTies[0];
                    tieAnalysis = `${tie.names.join(', ')} are all locked together on ${tie.points} points - that's a proper ${tie.names.length}-way tie. `;
                    if (multiWayTies.length > 1) {
                        tieAnalysis += `And it's not just them - there are multiple score ties right across the table. `;
                    }
                }

                let bottomTableAnalysis = '';
                if (leaderboardData.length >= 4) {
                    const bottomSlice = leaderboardData.slice(-3);
                    const bottomNames = bottomSlice.map(entry => entry.nickname).join(', ');
                    const lastEntry = leaderboardData[leaderboardData.length - 1];
                    const secondLast = leaderboardData[leaderboardData.length - 2];
                    const aboveBottom = leaderboardData[leaderboardData.length - 4];

                    if (lastEntry.points === secondLast.points) {
                        bottomTableAnalysis = `Down near the bottom it's tight between ${bottomNames}, all scrapping for every point. `;
                    } else if (aboveBottom && (aboveBottom.points - lastEntry.points) <= 3) {
                        bottomTableAnalysis = `Even at the foot of the table it's close - ${bottomNames} are only a good prediction away from climbing places. `;
                    } else {
                        bottomTableAnalysis = `${bottomNames} are chasing hard from the lower end of the table and one strong round could shake everything up. `;
                    }
                }
                
                // Build match analysis with more detail
                let matchAnalysis = '';
                if (completedMatches.length > 0) {
                    const recentMatch = completedMatches[completedMatches.length - 1];
                    const scoreDiff = Math.abs(recentMatch.actualScore1 - recentMatch.actualScore2);
                    const totalPoints = recentMatch.actualScore1 + recentMatch.actualScore2;
                    const winner = recentMatch.actualScore1 > recentMatch.actualScore2 ? recentMatch.team1 : 
                                   recentMatch.actualScore2 > recentMatch.actualScore1 ? recentMatch.team2 : null;
                    const loser = recentMatch.actualScore1 < recentMatch.actualScore2 ? recentMatch.team1 : 
                                  recentMatch.actualScore2 < recentMatch.actualScore1 ? recentMatch.team2 : null;
                    
                    if (winner) {
                        if (scoreDiff > 30) {
                            matchAnalysis = `Blimey! ${winner} absolutely annihilated ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} - that's the kind of hammering you don't see often in international rugby! ${loser} will want to forget that one quickly. Reminds me of when the All Blacks used to put 50 on teams in the early 2000s. `;
                        } else if (scoreDiff > 20) {
                            matchAnalysis = `${winner} put ${loser} to the sword with a dominant ${recentMatch.actualScore1}-${recentMatch.actualScore2} victory - a proper thrashing that would make the old Kingsholm faithful proud! ${loser} had no answer to that kind of pressure. Anyone who predicted that margin deserves a pint! `;
                        } else if (scoreDiff > 10) {
                            matchAnalysis = `${winner} claimed a convincing ${recentMatch.actualScore1}-${recentMatch.actualScore2} win over ${loser}. A solid performance that showed real class and composure when it mattered. ${loser} competed but couldn't live with ${winner}'s intensity in the key moments. `;
                        } else if (scoreDiff <= 3) {
                            matchAnalysis = `What a nail-biter! ${winner} scraped past ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} - tighter than a Gloucester scrum on their own five-metre line! Could have gone either way right until the final whistle. That's the kind of match that makes this tournament special. If you got that result right, take a bow! `;
                        } else {
                            matchAnalysis = `${winner} edged out ${loser} ${recentMatch.actualScore1}-${recentMatch.actualScore2} in a hard-fought contest. Neither side gave an inch, proper Test match rugby that was. ${loser} will feel they let that one slip, but ${winner} showed composure when it counted. `;
                        }
                        
                        // High scoring game
                        if (totalPoints > 60) {
                            matchAnalysis += `A ${totalPoints}-point thriller - the defences will be getting a talking to after that one! `;
                        } else if (totalPoints < 25) {
                            matchAnalysis += `Low-scoring but brutal - a real arm-wrestle between two tough teams. `;
                        }
                    } else {
                        matchAnalysis = `A ${recentMatch.actualScore1}-${recentMatch.actualScore2} draw between ${recentMatch.team1} and ${recentMatch.team2}! You don't see many of those in international rugby - rarer than a sunny day at Kingsholm in February! If anyone predicted that exact score, they deserve a standing ovation from the Shed. That's seriously impressive prediction work. `;
                    }
                    
                    // Add tries analysis if available
                    if (recentMatch.actualTries1 !== null && recentMatch.actualTries2 !== null) {
                        const totalTries = recentMatch.actualTries1 + recentMatch.actualTries2;
                        if (totalTries >= 10) {
                            matchAnalysis += `${totalTries} tries in one match - that's an absolute try-fest! The kind of rugby we all want to see. `;
                        } else if (totalTries >= 8) {
                            matchAnalysis += `${totalTries} tries in total - proper running rugby that keeps the crowd on their feet! `;
                        } else if (totalTries <= 2) {
                            matchAnalysis += `Only ${totalTries} tries though - a real forwards' battle that one, the kind of game where every scrum matters. `;
                        } else if (totalTries <= 4) {
                            matchAnalysis += `${totalTries} tries tells you it was tight and tense - defences on top throughout. `;
                        }
                    }
                }
                
                // Overall tournament stats with more analysis
                let tournamentStats = '';
                if (completedMatches.length >= 3) {
                    const totalActualTries = getTotalActualTries();
                    const avgTries = (totalActualTries / completedMatches.length).toFixed(1);
                    const totalPointsScored = completedMatches.reduce((sum, m) => sum + m.actualScore1 + m.actualScore2, 0);
                    const avgPointsPerGame = (totalPointsScored / completedMatches.length).toFixed(0);
                    
                    tournamentStats = `Tournament stats: ${totalActualTries} tries across ${completedMatches.length} matches (${avgTries} per game), averaging ${avgPointsPerGame} points per match. `;
                    
                    if (avgTries > 7) {
                        tournamentStats += `This is shaping up to be a high-scoring tournament - good news for the try prediction! `;
                    } else if (avgTries < 5) {
                        tournamentStats += `Defences have been on top - those predicting lower try totals might be onto something. `;
                    }
                }
                
                // Who predicted well in recent match
                let predictionAnalysis = '';
                if (recentMatch) {
                    const correctPredictions = allUsers.filter(username => {
                        const pred = users[username].predictions[recentMatch.id];
                        if (!pred) return false;
                        const actualResult = getResult(recentMatch.actualScore1, recentMatch.actualScore2);
                        const predictedResult = getResult(pred.team1, pred.team2);
                        return actualResult === predictedResult;
                    });
                    
                    if (correctPredictions.length === 0) {
                        predictionAnalysis = `Nobody got that result right - ${recentMatch.team1} vs ${recentMatch.team2} caught everyone out! `;
                    } else if (correctPredictions.length === 1) {
                        const winner = toTitleCase(users[correctPredictions[0]].nickname || correctPredictions[0]);
                        predictionAnalysis = `Only ${winner} called that one correctly - sharp stuff! `;
                    } else if (correctPredictions.length <= 3) {
                        predictionAnalysis = `Only ${correctPredictions.length} competitors got the result right - not an easy one to call! `;
                    }
                }
                
                if (gap === 0) {
                    tip = `It's tighter than the 2003 World Cup final at the top! ${leader.nickname} and ${second.nickname} are level on ${leader.points} points - ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}${tournamentStats}${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches still to play, this one's going down to the wire like England vs Australia in Sydney! Every prediction counts now - one perfect score could swing it all. ${nextFixtureWithHistory}`;
                } else if (gap <= 3) {
                    tip = `${leader.nickname} leads with ${leader.points} points but ${second.nickname} is breathing down their neck like a Gloucester flanker hunting a fly-half! Only ${gap} point${gap > 1 ? 's' : ''} separating them. ${matchAnalysis}${predictionAnalysis}${tournamentStats}${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches left, one good round of predictions could change everything. Feels like the closing minutes of ${randomWorldCupClassic}. ${nextFixtureWithHistory}`;
                } else if (gap <= 6) {
                    tip = `${leader.nickname} is building a handy lead on ${leader.points} points, but ${second.nickname} on ${second.points} won't give up without a fight - ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}${tournamentStats}${tieAnalysis}${bottomTableAnalysis}Still ${remainingMatches} matches to play, which means plenty of points up for grabs. A couple of perfect scores and this leaderboard could look very different. ${nextFixtureWithHistory}`;
                } else if (gap <= 10) {
                    tip = `${leader.nickname} is pulling clear on ${leader.points} points - ${randomGloucester}! ${second.nickname} trails by ${gap} points and needs to find form quickly. ${matchAnalysis}${predictionAnalysis}${tournamentStats}${tieAnalysis}${bottomTableAnalysis}But don't count anyone out yet - remember ${randomWorldCupClassic}? Anything's possible in this game! ${nextFixtureWithHistory}`;
                } else {
                    tip = `${leader.nickname} is running away with it on ${leader.points} points - ${randomGloucester}! ${second.nickname} trails by ${gap} points and needs a serious comeback worthy of the 1999 French team against the All Blacks. ${matchAnalysis}${predictionAnalysis}${tournamentStats}${tieAnalysis}${bottomTableAnalysis}The gap looks big, but ${remainingMatches} matches means up to ${remainingMatches * 11} points still available. Stranger things have happened - ${randomGloucester2}! ${nextFixtureWithHistory}`;
                }
            }
            
            container.innerHTML = `
                <div class="trevs-tips-header">
                    <span class="trevs-tips-emoji">🏉</span>
                    <span class="trevs-tips-title">Trev's Tips</span>
                </div>
                <div class="trevs-tips-content">${tip}</div>
            `;
        }

        // Current filter state
        let currentFilter = 'all';
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
            
            // Automatically switch to round filter when dropdown is changed
            currentFilter = 'round';
            
            // Update button states
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.round-filter-group .filter-btn').classList.add('active');
            
            // Refresh the view
            showSummary();
        }

        // Filter matches based on selected filter
        function filterMatches(filterType) {
            currentFilter = filterType;
            
            // Update button states
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Refresh summary
            showSummary();
        }

        // Get filtered matches based on current filter
        function getFilteredMatches() {
            if (currentFilter === 'completed') {
                return matches.filter(m => m.actualScore1 !== null && m.actualScore2 !== null);
            } else if (currentFilter === 'round') {
                return matches.filter(m => m.round === selectedRound);
            }
            
            return matches; // 'all'
        }

        // Show comprehensive summary with matches as columns
        function showSummary() {
            const container = document.getElementById('summaryContainer');
            const allUsers = Object.keys(users);
            
            if (allUsers.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No competitors have registered yet.</p>';
                updateLeaderboard();
                return;
            }

            const filteredMatches = getFilteredMatches();
            
            if (filteredMatches.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No matches match the current filter.</p>';
                updateLeaderboard();
                return;
            }

            // Calculate total actual tries so far
            const totalActualTries = getTotalActualTries();
            const completedMatches = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatches = matches.length;

            let html = '<div class="summary-container">';
            const isNarrowScreen = window.innerWidth <= 768;
            const scrollHintText = isNarrowScreen
                ? 'Scroll right to see full table. On phone, rotate to landscape for the best view.'
                : 'Scroll right to see full table';
            const scrollHintMarkup = `<div class="scroll-hint hidden" id="scrollHint"><span>${scrollHintText}</span><span class="scroll-hint-arrow">→</span></div>`;
            if (currentFilter === 'all') {
                html += scrollHintMarkup;
            }
            html += '<table class="summary-table">';
            
            // Header row: Rank | Competitor | Score | Match 1 | Match 2 | ... | Predicted Tries
            html += '<thead><tr>';
            html += '<th class="rank-col">#</th>';
            html += '<th class="competitor-col">Competitor</th>';
            html += '<th class="pts-col">Score</th>';
            filteredMatches.forEach(match => {
                const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                const hasTries = match.actualTries1 !== null && match.actualTries2 !== null;
                const totalMatchTries = hasTries ? match.actualTries1 + match.actualTries2 : null;
                const jokerBadge = match.jokerEligible ? '<div class="joker-eligible-badge">🃏 Joker Eligible</div>' : '<div class="joker-eligible-badge" style="visibility: hidden;">🃏 Joker Eligible</div>';
                html += `<th class="match-header-cell ${match.jokerEligible ? 'joker-eligible-header' : ''}">
                    <div class="match-header-cell-inner">
                        <div class="match-header-top">
                            ${jokerBadge}
                            <div class="match-teams">${getFlag(match.team1)} ${getTeamAbbr(match.team1)}<br>vs<br>${getFlag(match.team2)} ${getTeamAbbr(match.team2)}</div>
                            <div class="match-date">${match.date} - ${match.time}</div>
                        </div>
                        <div class="match-header-bottom">
                            ${hasResult ? `<div class="match-result">${match.actualScore1} - ${match.actualScore2}</div>` : '<div class="no-result">-</div>'}
                            ${hasTries ? `<div class="match-tries">(${totalMatchTries} tries)</div>` : ''}
                        </div>
                    </div>
                </th>`;
            });
            // Only show Tries column if not filtering by weekend
            if (currentFilter !== 'round') {
                html += '<th class="tries-col">Predicted Tries</th>';
            }
            html += '</tr></thead>';
            
            html += '<tbody>';
            
            // Sort competitors by total points
            const sortedUsers = Object.keys(users)
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
                
                html += `<tr class="${rowClass}">`;
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
                    const isJoker = users[user.username].jokerMatchId === match.id;

                    if (hasResult) {
                        const actualResult = getResult(match.actualScore1, match.actualScore2);
                        const predictedResult = getResult(pred.team1, pred.team2);

                        const team1Diff = Math.abs(pred.team1 - match.actualScore1);
                        const team2Diff = Math.abs(pred.team2 - match.actualScore2);

                        // Build tooltip content
                        tooltipContent += `<span class="tooltip-line">Predicted: ${pred.team1} - ${pred.team2}</span>`;
                        tooltipContent += `<span class="tooltip-line">Actual: ${match.actualScore1} - ${match.actualScore2}</span>`;

                        if (actualResult === predictedResult) {
                            pointsEarned = 3;
                            pointsClass = 'points-3';
                            tooltipContent += `<span class="tooltip-line correct">✓ Correct result: +3 pts</span>`;

                            // Check for perfect score OR within 5 points
                            if (team1Diff === 0 && team2Diff === 0) {
                                pointsEarned += 3;
                                pointsClass = 'points-perfect';
                                tooltipContent += `<span class="tooltip-line bonus">🎯 Perfect score: +3 pts</span>`;
                            } else {
                                // 1 extra point for each team score within 5 points (max 2)
                                if (team1Diff <= 5) {
                                    pointsEarned += 1;
                                    tooltipContent += `<span class="tooltip-line bonus">★ ${match.team1} score within 5: +1 pt</span>`;
                                }
                                if (team2Diff <= 5) {
                                    pointsEarned += 1;
                                    tooltipContent += `<span class="tooltip-line bonus">★ ${match.team2} score within 5: +1 pt</span>`;
                                }
                                if (team1Diff <= 5 || team2Diff <= 5) {
                                    pointsClass = 'points-4';
                                }
                            }

                            // Bonus 2 points for correctly predicting a draw
                            if (actualResult === 'draw') {
                                pointsEarned += 2;
                                tooltipContent += `<span class="tooltip-line bonus">★ Draw bonus: +2 pts</span>`;
                            }
                        } else {
                            tooltipContent += `<span class="tooltip-line incorrect">✗ Wrong result: 0 pts</span>`;
                        }

                        // Apply joker doubling
                        if (isJoker) {
                            tooltipContent += `<span class="tooltip-line joker-bonus">🃏 Joker: ${pointsEarned} × 2 = ${pointsEarned * 2} pts</span>`;
                            pointsEarned *= 2;
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
                        html += `<td class="${jokerCellClass}">
                            <div class="tooltip-container">
                                <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                <span class="points-earned ${pointsClass}">${pointsEarned} pts</span>
                                <div class="tooltip">${tooltipContent}</div>
                            </div>
                        </td>`;
                    } else {
                        if (isJoker) {
                            html += `<td class="${jokerCellClass}">
                                <div class="tooltip-container">
                                    <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                    <span class="points-earned points-placeholder">&nbsp;</span>
                                    <div class="tooltip">${tooltipContent}</div>
                                </div>
                            </td>`;
                        } else {
                            html += `<td class="${jokerCellClass}">
                                <div class="${jokerScoreClass}"><span class="${score1Class}">${score1}</span> - <span class="${score2Class}">${score2}</span> ${jokerIndicator}</div>
                                <span class="points-earned points-placeholder">&nbsp;</span>
                            </td>`;
                        }
                    }
                });
                
                // Predicted tries column with calculated projection (only if not weekend filter)
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
            if (currentFilter !== 'all') {
                html += scrollHintMarkup;
            }
            html += '</div>';

            container.innerHTML = html;
            updateLeaderboard();
            checkTableOverflow();
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

            // Hide hint when user scrolls to the end
            container.addEventListener('scroll', function() {
                const isScrolledToEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
                if (isScrolledToEnd) {
                    scrollHint.classList.add('hidden');
                }
            });

            // Enable touch tooltips for mobile
            initTouchTooltips();
        }

        function exportToPDF(options = {}) {
            const { openInBrowser = false } = options;
            const allMatches = matches;

            const sortedUsers = Object.keys(users)
                .map(username => ({
                    username,
                    nickname: toTitleCase(users[username].nickname || username),
                    totalPoints: calculatePoints(username)
                }))
                .sort((a, b) => b.totalPoints - a.totalPoints);

            function getMatchPoints(username, match) {
                const pred = users[username].predictions[match.id];
                return calculateMatchPoints(pred, match, users[username].jokerMatchId === match.id);
            }

            function hexToRgb(hex) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return [r, g, b];
            }

            // Printer-friendly palette
            const C = {
                black: '#111111',
                gray: '#666666',
                lightGray: '#DADADA',
                border: '#BEBEBE',
                white: '#FFFFFF',
                winFg: '#0B6B2C',
                loseFg: '#C0392B',
                drawFg: '#D4820A',
                pointsFg: '#5A4A00',
                pendingHomeWin: '#2471A3',
                pendingAwayWin: '#7D3C98',
                pendingDraw: '#D4820A',
                exactBg: '#C6EFCE',
            };

            // --- Initialise PDF ---
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            // Title
            const now = new Date();
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Six Nations Guesser \u2014 Match Summary', 14, 15);

            const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(102, 102, 102);
            doc.text('Exported ' + dateStr, 14, 22);
            doc.setTextColor(0, 0, 0);

            // --- Calculate actual + estimated tries ---
            const totalActualTries = getTotalActualTries();
            const completedTriesMatches = allMatches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatchCount = allMatches.length;
            let estimatedTotalTries = null;
            if (completedTriesMatches > 0) {
                estimatedTotalTries = Math.round((totalActualTries / completedTriesMatches) * totalMatchCount);
            }

            // --- Build header rows (fixture header spans Home/Away score columns) ---
            const teamAbbr = {
                England: 'ENG',
                France: 'FRA',
                Ireland: 'IRE',
                Italy: 'ITA',
                Scotland: 'SCO',
                Wales: 'WAL'
            };

            const headerRowTop = [
                { content: '#', styles: { halign: 'center' } },
                { content: 'Name', styles: { halign: 'left' } },
                { content: 'Score', styles: { halign: 'center' } },
                ...allMatches.map(m => ({
                    content: m.date + '\n' + m.time,
                    colSpan: 2,
                    styles: {
                        halign: 'center',
                        overflow: 'visible',
                        fontSize: 5.5,
                        fillColor: m.round % 2 === 0 ? [255, 255, 255] : [242, 242, 242]
                    }
                })),
                { content: 'Predicted\nTries', styles: { halign: 'center' } }
            ];

            const headerRowBottom = [
                { content: '', styles: { halign: 'center' } },
                { content: '', styles: { halign: 'left' } },
                { content: '', styles: { halign: 'center' } },
                ...allMatches.flatMap(m => ([
                    { content: teamAbbr[m.team1] || m.team1, styles: { halign: 'center', fontSize: 5.2 } },
                    { content: teamAbbr[m.team2] || m.team2, styles: { halign: 'center', fontSize: 5.2 } }
                ])),
                { content: '', styles: { halign: 'center' } }
            ];

            // --- Build actual results rows ---
            const actualScoresRow = [
                { content: '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold' } },
                { content: 'Actual Scores', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold', halign: 'left' } },
                { content: '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold' } },
                ...allMatches.map(m => {
                    const hasResult = m.actualScore1 !== null && m.actualScore2 !== null;
                    const home = hasResult ? String(m.actualScore1) : '';
                    const away = hasResult ? String(m.actualScore2) : '';
                    let homeColor = hexToRgb(C.gray);
                    let awayColor = hexToRgb(C.gray);
                    if (hasResult) {
                        if (m.actualScore1 > m.actualScore2) {
                            homeColor = hexToRgb(C.winFg);
                            awayColor = hexToRgb(C.loseFg);
                        } else if (m.actualScore1 < m.actualScore2) {
                            homeColor = hexToRgb(C.loseFg);
                            awayColor = hexToRgb(C.winFg);
                        } else {
                            homeColor = hexToRgb(C.drawFg);
                            awayColor = hexToRgb(C.drawFg);
                        }
                    }
                    return [
                        { content: home, styles: { textColor: homeColor, fontStyle: 'bold', fontSize: 6, halign: 'center' } },
                        { content: away, styles: { textColor: awayColor, fontStyle: 'bold', fontSize: 6, halign: 'center' } }
                    ];
                }).flat(),
                { content: '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold', fontSize: 6.5 } }
            ];

            const actualTriesRow = [
                { content: '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold' } },
                { content: 'Actual Tries', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold', halign: 'left' } },
                { content: '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold' } },
                ...allMatches.map(m => {
                    const homeTries = m.actualTries1 !== null ? String(m.actualTries1) : '';
                    const awayTries = m.actualTries2 !== null ? String(m.actualTries2) : '';
                    return [
                        {
                            content: homeTries,
                            styles: { textColor: m.actualTries1 !== null ? hexToRgb(C.black) : hexToRgb(C.gray), fontStyle: 'bold', fontSize: 6, halign: 'center' }
                        },
                        {
                            content: awayTries,
                            styles: { textColor: m.actualTries2 !== null ? hexToRgb(C.black) : hexToRgb(C.gray), fontStyle: 'bold', fontSize: 6, halign: 'center' }
                        }
                    ];
                }).flat(),
                { content: completedTriesMatches > 0 ? totalActualTries + ' (' + estimatedTotalTries + ')' : '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold', fontSize: 6.5 } }
            ];

            // --- Build data rows (scores row + merged points row per user) ---
            const dataRows = sortedUsers.flatMap((user, index) => {
                let rank = index + 1;
                if (index > 0 && sortedUsers[index - 1].totalPoints === user.totalPoints) {
                    for (let i = index - 1; i >= 0; i--) {
                        if (sortedUsers[i].totalPoints === user.totalPoints) rank = i + 1; else break;
                    }
                }

                const scoreRow = [
                    { content: String(rank), styles: { fontStyle: 'bold', halign: 'center' } },
                    { content: user.nickname, styles: { fontStyle: 'bold', halign: 'left' } },
                    { content: String(user.totalPoints), styles: { fontStyle: 'bold', textColor: hexToRgb(C.pointsFg), fontSize: 9 } },
                ];

                const pointsRow = [
                    { content: '', styles: { textColor: hexToRgb(C.gray) } },
                    { content: '', styles: { textColor: hexToRgb(C.gray) } },
                    { content: '', styles: { textColor: hexToRgb(C.gray) } },
                ];

                allMatches.forEach(match => {
                    const pred = users[user.username].predictions[match.id];
                    const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                    const isJoker = users[user.username].jokerMatchId === match.id;
                    const pts = getMatchPoints(user.username, match);

                    if (!pred) {
                        scoreRow.push({ content: '\u2014', styles: { textColor: hexToRgb(C.gray), fontSize: 6 } });
                        scoreRow.push({ content: '\u2014', styles: { textColor: hexToRgb(C.gray), fontSize: 6 } });
                        pointsRow.push({ content: '\u2014', colSpan: 2, styles: { textColor: hexToRgb(C.gray), fontSize: 5.5, halign: 'center' } });
                        return;
                    }

                    let homeColor = hexToRgb(C.black);
                    let awayColor = hexToRgb(C.black);
                    if (pred.team1 > pred.team2) {
                        homeColor = hexToRgb(C.winFg);
                        awayColor = hexToRgb(C.loseFg);
                    } else if (pred.team1 < pred.team2) {
                        homeColor = hexToRgb(C.loseFg);
                        awayColor = hexToRgb(C.winFg);
                    } else {
                        homeColor = hexToRgb(C.drawFg);
                        awayColor = hexToRgb(C.drawFg);
                    }

                    const homeStyles = { textColor: homeColor, fontSize: 6.5, fontStyle: isJoker ? 'bold' : 'normal' };
                    const awayStyles = { textColor: awayColor, fontSize: 6.5, fontStyle: isJoker ? 'bold' : 'normal' };

                    if (hasResult && pred.team1 === match.actualScore1 && pred.team2 === match.actualScore2) {
                        homeStyles.fillColor = hexToRgb(C.exactBg);
                        awayStyles.fillColor = hexToRgb(C.exactBg);
                    }

                    scoreRow.push({ content: String(pred.team1) + (isJoker ? '*' : ''), styles: homeStyles });
                    scoreRow.push({ content: String(pred.team2) + (isJoker ? '*' : ''), styles: awayStyles });

                    const ptsText = pts === null ? '' : `${pts} pts`;
                    const ptsColor = pts === null
                        ? hexToRgb(C.gray)
                        : pts === 0
                            ? [184, 92, 0] // dark orange
                            : hexToRgb('#1F5FBF'); // blue
                    pointsRow.push({
                        content: ptsText,
                        colSpan: 2,
                        styles: {
                            textColor: ptsColor,
                            fontSize: 5.5,
                            halign: 'center',
                            fontStyle: pts !== null && pts > 3 ? 'bold' : 'normal'
                        }
                    });
                });

                // Predicted Tries
                const userTries = users[user.username].totalTries;
                scoreRow.push({
                    content: userTries != null ? String(userTries) : '\u2014',
                    styles: { textColor: hexToRgb(C.black) }
                });
                pointsRow.push({
                    content: '',
                    styles: { textColor: hexToRgb(C.gray) }
                });

                return [scoreRow, pointsRow];
            });

            // --- Render table ---
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginLR = 6;
            const tableWidth = pageWidth - marginLR * 2;
            const scoreColumnCount = allMatches.length * 2;
            const fixedWidth = 7 + 24 + 11 + 12; // rank + name + score + tries
            const matchColWidth = Math.max(6.4, (tableWidth - fixedWidth) / scoreColumnCount);
            const triesColIndex = 3 + scoreColumnCount;
            const colStyles = {
                0: { cellWidth: 7 },
                1: { cellWidth: 24 },
                2: { cellWidth: 11 },
            };
            for (let i = 3; i < triesColIndex; i++) {
                colStyles[i] = { cellWidth: matchColWidth };
            }
            colStyles[triesColIndex] = { cellWidth: 12 };

            doc.autoTable({
                head: [headerRowTop, headerRowBottom],
                body: [actualScoresRow, actualTriesRow, ...dataRows],
                startY: 28,
                theme: 'grid',
                tableWidth: tableWidth,
                styles: {
                    fontSize: 6.5,
                    cellPadding: 0.8,
                    lineColor: hexToRgb(C.border),
                    lineWidth: 0.2,
                    halign: 'center',
                    valign: 'middle',
                    overflow: 'visible',
                    font: 'helvetica',
                },
                headStyles: {
                    fillColor: hexToRgb(C.white),
                    textColor: hexToRgb(C.black),
                    fontStyle: 'bold',
                    fontSize: 5.5,
                    cellPadding: 0.6,
                    halign: 'center',
                    lineColor: hexToRgb(C.border),
                    lineWidth: 0.3,
                },
                columnStyles: colStyles,
                didParseCell: function(data) {
                    // Subtle striping for user rows (skip the "Actual Result" row at index 0).
                    // Keep any explicit per-cell fill (e.g. exact-score highlight) untouched.
                    if (data.section === 'body' && data.row.index > 0) {
                        const hasExplicitFill = Array.isArray(data.cell.styles.fillColor);
                        if (!hasExplicitFill && data.row.index % 2 === 0) {
                            data.cell.styles.fillColor = [248, 248, 248];
                        }
                    }

                    // Thicker right border on Score column to separate fixed columns from matches
                    if (data.column.index === 2) {
                        data.cell.styles.lineWidth = { bottom: 0.2, top: 0.2, left: 0.2, right: 0.5 };
                    }
                    // Thicker separators after each Away score column.
                    if (data.column.index >= 3 && data.column.index < triesColIndex && ((data.column.index - 3) % 2 === 1)) {
                        const lw = data.cell.styles.lineWidth;
                        if (typeof lw === 'object') {
                            lw.right = 0.5;
                        } else {
                            data.cell.styles.lineWidth = { bottom: 0.2, top: 0.2, left: 0.2, right: 0.5 };
                        }
                    }
                    // Thicker separators before each Home score column.
                    if (data.column.index >= 3 && data.column.index < triesColIndex && ((data.column.index - 3) % 2 === 0)) {
                        const lw = data.cell.styles.lineWidth;
                        if (typeof lw === 'object') {
                            lw.left = 0.5;
                        } else {
                            data.cell.styles.lineWidth = { bottom: 0.2, top: 0.2, left: 0.5, right: 0.2 };
                        }
                    }
                    // Thicker bottom border after the actual rows block.
                    if (data.section === 'body' && data.row.index === 1) {
                        const lw = data.cell.styles.lineWidth;
                        if (typeof lw === 'object') {
                            lw.bottom = 0.5;
                        } else {
                            data.cell.styles.lineWidth = { bottom: 0.5, top: 0.2, left: 0.2, right: data.column.index === 2 ? 0.5 : 0.2 };
                        }
                    }
                },
                margin: { top: 10, left: marginLR, right: marginLR },
            });

            // --- Download ---
            const filename = 'SixNations_Summary_' + now.toISOString().slice(0, 10) + '.pdf';
            if (openInBrowser) {
                const blobUrl = doc.output('bloburl');
                window.location.href = blobUrl;
                return;
            }
            doc.save(filename);
        }

        function initTouchTooltips() {
            // Add click/touch handlers for tooltip containers
            document.querySelectorAll('.summary-container .tooltip-container').forEach(container => {
                container.addEventListener('click', function(e) {
                    e.stopPropagation();

                    // Close any other open tooltips
                    document.querySelectorAll('.tooltip-container.tooltip-active').forEach(el => {
                        if (el !== container) {
                            el.classList.remove('tooltip-active');
                        }
                    });

                    // Toggle this tooltip
                    container.classList.toggle('tooltip-active');
                });
            });

            // Close tooltips when clicking elsewhere
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.tooltip-container')) {
                    document.querySelectorAll('.tooltip-container.tooltip-active').forEach(el => {
                        el.classList.remove('tooltip-active');
                    });
                }
            });
        }

        // Database Recovery Functions
        function generateSchemaSQL() {
            return `-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS admin_usernames;
DROP TABLE IF EXISTS settings;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    nickname VARCHAR(255),
    password_hash VARCHAR(255),
    total_tries INTEGER,
    joker_match_id INTEGER,
    supported_teams VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE matches (
    id INTEGER PRIMARY KEY,
    round INTEGER NOT NULL,
    date VARCHAR(50),
    time VARCHAR(10),
    team1 VARCHAR(100) NOT NULL,
    team2 VARCHAR(100) NOT NULL,
    actual_score1 INTEGER,
    actual_score2 INTEGER,
    actual_tries1 INTEGER,
    actual_tries2 INTEGER,
    joker_eligible BOOLEAN DEFAULT FALSE
);

-- Create predictions table
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL,
    team1_score INTEGER,
    team2_score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

-- Create admin_usernames table
CREATE TABLE admin_usernames (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL
);

-- Create settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT
);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_usernames ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your security needs)
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all access to predictions" ON predictions FOR ALL USING (true);
CREATE POLICY "Allow all access to matches" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all access to admin_usernames" ON admin_usernames FOR ALL USING (true);
CREATE POLICY "Allow all access to settings" ON settings FOR ALL USING (true);`;
        }

        function generateDataSQL() {
            let sql = '';

            // Helper to escape single quotes in SQL strings
            const esc = (str) => str ? str.replace(/'/g, "''") : '';

            // Generate matches INSERT statements
            if (matches.length > 0) {
                sql += '\n-- Insert matches data\n';
                matches.forEach(m => {
                    sql += `INSERT INTO matches (id, round, date, time, team1, team2, actual_score1, actual_score2, actual_tries1, actual_tries2, joker_eligible) VALUES (${m.id}, ${m.round}, '${esc(m.date)}', '${esc(m.time)}', '${esc(m.team1)}', '${esc(m.team2)}', ${m.actualScore1 === null ? 'NULL' : m.actualScore1}, ${m.actualScore2 === null ? 'NULL' : m.actualScore2}, ${m.actualTries1 === null ? 'NULL' : m.actualTries1}, ${m.actualTries2 === null ? 'NULL' : m.actualTries2}, ${m.jokerEligible ? 'TRUE' : 'FALSE'});\n`;
                });
            }

            // Generate admin_usernames INSERT statements
            if (adminUsernames.length > 0) {
                sql += '\n-- Insert admin usernames\n';
                adminUsernames.forEach(u => {
                    sql += `INSERT INTO admin_usernames (username) VALUES ('${esc(u)}');\n`;
                });
            }

            // Generate settings INSERT statements
            sql += '\n-- Insert settings\n';
            sql += `INSERT INTO settings (key, value) VALUES ('predictionsLocked', '${appSettings.predictionsLocked}');\n`;

            // Generate users INSERT statements
            const userList = Object.keys(users);
            if (userList.length > 0) {
                sql += '\n-- Insert users\n';
                userList.forEach((username, index) => {
                    const u = users[username];
                    const oderId = index + 1;
                    const supportedTeamsVal = u.supportedTeams && u.supportedTeams.length > 0 ? `'${esc(u.supportedTeams.join(','))}'` : 'NULL';
                    sql += `INSERT INTO users (id, username, nickname, password_hash, total_tries, joker_match_id, supported_teams) VALUES (${oderId}, '${esc(username)}', '${esc(u.nickname)}', '${esc(u.passwordHash)}', ${u.totalTries === null || u.totalTries === undefined ? 'NULL' : u.totalTries}, ${u.jokerMatchId === null || u.jokerMatchId === undefined ? 'NULL' : u.jokerMatchId}, ${supportedTeamsVal});\n`;
                });

                // Generate predictions INSERT statements
                sql += '\n-- Insert predictions\n';
                userList.forEach((username, userIndex) => {
                    const userId = userIndex + 1;
                    const predictions = users[username].predictions || {};
                    Object.keys(predictions).forEach(matchId => {
                        const pred = predictions[matchId];
                        sql += `INSERT INTO predictions (user_id, match_id, team1_score, team2_score) VALUES (${userId}, ${matchId}, ${pred.team1}, ${pred.team2});\n`;
                    });
                });

                // Reset the sequence for users table
                sql += '\n-- Reset sequences\n';
                sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n`;
                sql += `SELECT setval('predictions_id_seq', (SELECT MAX(id) FROM predictions));\n`;
                sql += `SELECT setval('admin_usernames_id_seq', (SELECT MAX(id) FROM admin_usernames));\n`;
                sql += `SELECT setval('settings_id_seq', (SELECT MAX(id) FROM settings));\n`;
            }

            return sql;
        }

        function generateFullSQL(includeData = true) {
            if (includeData) {
                return generateSchemaSQL() + '\n' + generateDataSQL();
            } else {
                return generateSchemaSQL();
            }
        }

        function updateRecoverySQL() {
            const includeData = document.getElementById('includeDataCheckbox').checked;
            const sql = generateFullSQL(includeData);
            document.getElementById('sqlPreview').textContent = sql;

            // Update description and list based on checkbox
            const description = document.getElementById('recoveryDescription');
            const list = document.getElementById('recoveryList');

            if (includeData) {
                description.textContent = 'This SQL will recreate all tables and restore:';
                list.innerHTML = `
                    <li>All matches and fixtures</li>
                    <li>All user accounts (usernames, password hashes)</li>
                    <li>All predictions</li>
                    <li>Admin usernames list</li>
                    <li>App settings</li>
                `;
            } else {
                description.textContent = 'This SQL will recreate empty tables only:';
                list.innerHTML = `
                    <li>Empty matches table</li>
                    <li>Empty users table</li>
                    <li>Empty predictions table</li>
                    <li>Empty admin_usernames table</li>
                    <li>Empty settings table</li>
                `;
            }
        }

        function initRecoveryTab() {
            // Display the SQL based on checkbox state
            updateRecoverySQL();
        }

        function copySqlToClipboard() {
            const includeData = document.getElementById('includeDataCheckbox').checked;
            const sql = generateFullSQL(includeData);
            navigator.clipboard.writeText(sql).then(() => {
                alert('SQL copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy:', err);
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = sql;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('SQL copied to clipboard!');
            });
        }

        // Tab switching
        function showTab(tabName) {
            // Hide all tabs
            document.getElementById('predictionsTab').classList.add('hidden');
            document.getElementById('summaryTab').classList.add('hidden');
            document.getElementById('competitorsTab').classList.add('hidden');
            document.getElementById('scoreCorrectionsTab').classList.add('hidden');
            document.getElementById('resultsTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');

            // Update tab buttons
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

            // Show selected tab
            if (tabName === 'predictions') {
                document.getElementById('predictionsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderMatches(); // Re-render to check lock status
                loadPredictions(); // Pre-populate with saved predictions
            } else if (tabName === 'summary') {
                document.getElementById('summaryTab').classList.remove('hidden');
                event.target.classList.add('active');
                refreshSummaryData();
            } else if (tabName === 'competitors') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('competitorsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderCompetitorManagement();
            } else if (tabName === 'scoreCorrections') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('scoreCorrectionsTab').classList.remove('hidden');
                event.target.classList.add('active');
                renderAdminScoreCorrections();
            } else if (tabName === 'results') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('resultsTab').classList.remove('hidden');
                event.target.classList.add('active');
                updateLockToggleUI();
                renderAdminMatches();
            } else if (tabName === 'recovery') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('recoveryTab').classList.remove('hidden');
                event.target.classList.add('active');
                initRecoveryTab();
            }
        }

        async function refreshSummaryData() {
            try {
                // Show a subtle loading state on the summary container
                const container = document.getElementById('matchSummary');
                if (container) {
                    container.style.opacity = '0.6';
                }

                // Fetch fresh data from Supabase
                const [loadedUsers, loadedMatches] = await Promise.all([
                    Storage.getUsers(),
                    Storage.getMatches()
                ]);

                // Update local data
                users = loadedUsers;
                if (loadedMatches && loadedMatches.length > 0) {
                    matches.length = 0;
                    loadedMatches.forEach(m => matches.push(m));
                }

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
        initializeData().then(() => {
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
                exportToPDF({ openInBrowser: true });
                return;
            }

            // Check for saved user cookie and auto-login
            const savedUsername = (getCookie('rugbyPredictorUser') || '').trim().toLowerCase();
            if (savedUsername && users[savedUsername]) {
                currentUsername = savedUsername;
                showApp();
            }
        });
