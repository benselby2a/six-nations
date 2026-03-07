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

        function isAiPlayer(username) {
            if (!username) return false;
            const user = users && users[username] ? users[username] : null;
            const usernameText = String(username).trim().toLowerCase();
            const nicknameText = String(user && user.nickname ? user.nickname : '').trim().toLowerCase();
            return usernameText === 'ai' || nicknameText === 'ai';
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
            if (isAiPlayer(username)) {
                return '<span class="supported-team-flags">🤖</span> ';
            }
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
                            supported_teams: userData.supportedTeams && userData.supportedTeams.length > 0 ? userData.supportedTeams.join(',') : null
                        })
                        .eq('username', username);
                    
                    if (error) {
                        console.error('Error updating user:', error);
                        return;
                    }
                    trackUsage('update user', formatUsagePayload({
                        username,
                        userData: {
                            nickname: userData.nickname,
                            passwordHash: userData.passwordHash,
                            totalTries: userData.totalTries,
                            supportedTeams: userData.supportedTeams || []
                        }
                    }), username);
                } else {
                    // Insert new user
                    const { error } = await supabaseClient
                        .from('users')
                        .insert({
                            username: username,
                            nickname: userData.nickname,
                            password_hash: userData.passwordHash,
                            total_tries: userData.totalTries,
                            supported_teams: userData.supportedTeams && userData.supportedTeams.length > 0 ? userData.supportedTeams.join(',') : null
                        });
                    
                    if (error) {
                        console.error('Error inserting user:', error);
                        return;
                    }
                    trackUsage('create user', formatUsagePayload({
                        username,
                        userData: {
                            nickname: userData.nickname,
                            passwordHash: userData.passwordHash,
                            totalTries: userData.totalTries,
                            supportedTeams: userData.supportedTeams || []
                        }
                    }), username);
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

                if (error) {
                    console.error('Error renaming user:', error);
                    return;
                }
                trackUsage('rename user', formatUsagePayload({ oldUsername, newUsername }), newUsername);
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
                const { error: totalTriesError } = await supabaseClient
                    .from('users')
                    .update({ total_tries: totalTries })
                    .eq('id', user.id);
                if (totalTriesError) {
                    console.error('Error updating total tries:', totalTriesError);
                    return;
                }

                // Replace all stored predictions for this user so cleared rows are
                // persisted as deletions (not left behind in Supabase).
                const { error: deleteError } = await supabaseClient
                    .from('predictions')
                    .delete()
                    .eq('user_id', user.id);
                if (deleteError) {
                    console.error('Error clearing existing predictions:', deleteError);
                    return;
                }

                const predictionRows = Object.entries(predictions || {}).map(([matchId, pred]) => ({
                    user_id: user.id,
                    match_id: parseInt(matchId, 10),
                    team1_score: pred.team1,
                    team2_score: pred.team2,
                    updated_at: new Date().toISOString()
                }));

                if (predictionRows.length === 0) {
                    trackUsage('save predictions', formatUsagePayload({
                        username,
                        predictions: predictions || {},
                        totalTries
                    }), username);
                    return;
                }

                const { error: insertError } = await supabaseClient
                    .from('predictions')
                    .insert(predictionRows);
                if (insertError) {
                    console.error('Error saving prediction rows:', insertError);
                    return;
                }
                trackUsage('save predictions', formatUsagePayload({
                    username,
                    predictions: predictions || {},
                    totalTries
                }), username);
            },
            
            // Delete a user
            deleteUser: async (username) => {
                username = (username || '').trim().toLowerCase();
                if (!username) return;

                const { error } = await supabaseClient
                    .from('users')
                    .delete()
                    .eq('username', username);
                
                if (error) {
                    console.error('Error deleting user:', error);
                    return;
                }
                trackUsage('delete user', formatUsagePayload({ username }), username);
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
                const { error: deleteError } = await supabaseClient.from('matches').delete().neq('id', 0);
                if (deleteError) {
                    console.error('Error clearing matches:', deleteError);
                    return;
                }
                
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
                if (error) {
                    console.error('Error saving matches:', error);
                    return;
                }
                trackUsage('save fixtures', formatUsagePayload({ matchesData: matchesData || [] }));
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
                const { error: deleteError } = await supabaseClient.from('admin_usernames').delete().neq('username', '');
                if (deleteError) {
                    console.error('Error clearing admin usernames:', deleteError);
                    return;
                }

                if (usernames.length > 0) {
                    const normalized = [...new Set(
                        usernames
                            .map(username => (username || '').trim().toLowerCase())
                            .filter(Boolean)
                    )];
                    const rows = normalized.map(username => ({ username }));
                    const { error } = await supabaseClient.from('admin_usernames').insert(rows);
                    if (error) {
                        console.error('Error saving admin usernames:', error);
                        return;
                    }
                    trackUsage('save admin usernames', formatUsagePayload({ usernames: normalized }));
                    return;
                }

                trackUsage('save admin usernames', formatUsagePayload({ usernames: [] }));
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
                
                if (error) {
                    console.error('Error saving settings:', error);
                    return;
                }
                trackUsage('update settings', formatUsagePayload({ settings }));
            },

            getUsageEvents: async (limit = 100) => {
                const rowLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
                const { data, error } = await supabaseClient
                    .from('usage_events')
                    .select('id, created_at, actor, action, payload')
                    .order('created_at', { ascending: false })
                    .limit(rowLimit);

                if (error) {
                    console.error('Error fetching usage events:', error);
                    return [];
                }

                return data || [];
            },

            deleteUsageEventsOlderThanLatest: async (keepLatest = 100) => {
                const keepCount = Math.max(1, parseInt(keepLatest, 10) || 100);
                const { data: allRows, error: listError } = await supabaseClient
                    .from('usage_events')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });

                if (listError) {
                    console.error('Error listing usage events for prune:', listError);
                    return { deletedCount: 0, totalCount: 0 };
                }

                const ids = (allRows || []).map(row => row.id);
                if (ids.length <= keepCount) {
                    return { deletedCount: 0, totalCount: ids.length };
                }

                const toDelete = ids.slice(keepCount);
                const chunkSize = 500;
                for (let i = 0; i < toDelete.length; i += chunkSize) {
                    const chunk = toDelete.slice(i, i + chunkSize);
                    const { error: deleteError } = await supabaseClient
                        .from('usage_events')
                        .delete()
                        .in('id', chunk);
                    if (deleteError) {
                        console.error('Error deleting usage events chunk:', deleteError);
                        return { deletedCount: i, totalCount: ids.length };
                    }
                }

                return { deletedCount: toDelete.length, totalCount: ids.length };
            },

            clearUsageEvents: async () => {
                const { error } = await supabaseClient
                    .from('usage_events')
                    .delete()
                    .neq('id', 0);

                if (error) {
                    console.error('Error clearing usage events:', error);
                    return false;
                }
                return true;
            },

            trackUsageEvent: async (actor, action, payload) => {
                const normalizedActor = (actor || '').trim().toLowerCase() || 'guest';
                const normalizedAction = (action || '').trim();
                if (!normalizedAction) return;

                const { error } = await supabaseClient
                    .from('usage_events')
                    .insert({
                        actor: normalizedActor,
                        action: normalizedAction,
                        payload: (payload || '').toString()
                    });
                if (error) {
                    console.warn('Usage tracking failed:', error.message || error);
                }
            },

            // Active scoring rules + close tiers (single-row model)
            getActiveScoringRules: async () => {
                const fallback = {
                    id: 1,
                    name: 'Scoring Rules',
                    status: 'saved',
                    isActive: true,
                    correctResultPoints: 3,
                    perfectScoreBonus: 3,
                    drawBonus: 2,
                    applyClosePerTeam: true,
                    maxJokersPerUser: 1,
                    entryFeeAmount: 0,
                    payoutFirstPct: 0,
                    payoutSecondPct: 0,
                    payoutThirdPct: 0,
                    payoutClosestTriesPct: 0,
                    closeTiers: [{ tierOrder: 1, withinPoints: 5, bonusPoints: 1 }]
                };

                const { data: rule, error: rulesError } = await supabaseClient
                    .from('scoring_rules')
                    .select('*')
                    .eq('id', 1)
                    .maybeSingle();

                if (rulesError || !rule) {
                    if (rulesError) console.error('Error fetching scoring rules:', rulesError);
                    return fallback;
                }

                const { data: tierRows, error: tiersError } = await supabaseClient
                    .from('scoring_close_tiers')
                    .select('*')
                    .order('tier_order', { ascending: true });

                if (tiersError) {
                    console.error('Error fetching scoring close tiers:', tiersError);
                }

                const closeTiers = (tierRows || []).map(t => ({
                    tierOrder: t.tier_order,
                    withinPoints: t.within_points,
                    bonusPoints: t.bonus_points
                }));

                return {
                    id: rule.id,
                    name: 'Scoring Rules',
                    status: 'saved',
                    isActive: true,
                    correctResultPoints: rule.correct_result_points,
                    perfectScoreBonus: rule.perfect_score_bonus,
                    drawBonus: rule.draw_bonus,
                    maxJokersPerUser: rule.max_jokers_per_user,
                    entryFeeAmount: Number(rule.entry_fee_amount ?? 0),
                    payoutFirstPct: Number(rule.payout_first_pct ?? 0),
                    payoutSecondPct: Number(rule.payout_second_pct ?? 0),
                    payoutThirdPct: Number(rule.payout_third_pct ?? 0),
                    payoutClosestTriesPct: Number(rule.payout_closest_tries_pct ?? 0),
                    closeTiers: closeTiers.length > 0 ? closeTiers : fallback.closeTiers
                };
            },

            // New multi-joker selections, returned as username => [matchId]
            getUserJokerSelections: async () => {
                const { data: userRows, error: usersError } = await supabaseClient
                    .from('users')
                    .select('id, username');

                if (usersError) {
                    console.error('Error fetching users for joker selection map:', usersError);
                    return {};
                }

                const userIdToUsername = {};
                (userRows || []).forEach(u => {
                    const normalizedUsername = (u.username || '').trim().toLowerCase();
                    if (normalizedUsername) userIdToUsername[u.id] = normalizedUsername;
                });

                const { data: selectionRows, error: selectionError } = await supabaseClient
                    .from('user_joker_selections')
                    .select('user_id, match_id');

                if (selectionError) {
                    console.error('Error fetching joker selections:', selectionError);
                    return {};
                }

                const byUsername = {};
                (selectionRows || []).forEach(row => {
                    const username = userIdToUsername[row.user_id];
                    if (!username) return;
                    if (!byUsername[username]) byUsername[username] = [];
                    byUsername[username].push(row.match_id);
                });

                Object.keys(byUsername).forEach(username => {
                    byUsername[username] = [...new Set(byUsername[username])].sort((a, b) => a - b);
                });

                return byUsername;
            },

            // Save singleton scoring rules and replace close tiers.
            // Returns 1 on success, or null on failure.
            saveScoringRulesDraft: async (rules) => {
                const normalized = {
                    id: 1,
                    correct_result_points: Math.max(0, parseInt(rules && rules.correctResultPoints, 10) || 0),
                    perfect_score_bonus: Math.max(0, parseInt(rules && rules.perfectScoreBonus, 10) || 0),
                    draw_bonus: Math.max(0, parseInt(rules && rules.drawBonus, 10) || 0),
                    max_jokers_per_user: Math.max(0, parseInt(rules && rules.maxJokersPerUser, 10) || 0),
                    entry_fee_amount: Math.max(0, Number(rules && rules.entryFeeAmount) || 0),
                    payout_first_pct: Math.max(0, Number(rules && rules.payoutFirstPct) || 0),
                    payout_second_pct: Math.max(0, Number(rules && rules.payoutSecondPct) || 0),
                    payout_third_pct: Math.max(0, Number(rules && rules.payoutThirdPct) || 0),
                    payout_closest_tries_pct: Math.max(0, Number(rules && rules.payoutClosestTriesPct) || 0),
                    updated_at: new Date().toISOString()
                };

                const { error: upsertError } = await supabaseClient
                    .from('scoring_rules')
                    .upsert(normalized, { onConflict: 'id' });
                if (upsertError) {
                    console.error('Error saving scoring rules:', upsertError);
                    return null;
                }

                const { error: deleteTiersError } = await supabaseClient
                    .from('scoring_close_tiers')
                    .delete()
                    .gte('tier_order', 1);
                if (deleteTiersError) {
                    console.error('Error clearing existing scoring close tiers:', deleteTiersError);
                    return null;
                }

                const normalizedTiers = ((rules && rules.closeTiers) || [])
                    .map((tier, index) => ({
                        tier_order: Math.min(3, Math.max(1, parseInt(tier && tier.tierOrder, 10) || index + 1)),
                        within_points: Math.max(0, parseInt(tier && tier.withinPoints, 10) || 0),
                        bonus_points: Math.max(0, parseInt(tier && tier.bonusPoints, 10) || 0)
                    }))
                    .slice(0, 3)
                    .sort((a, b) => a.tier_order - b.tier_order);

                if (normalizedTiers.length > 0) {
                    const { error: insertTiersError } = await supabaseClient
                        .from('scoring_close_tiers')
                        .insert(normalizedTiers);
                    if (insertTiersError) {
                        console.error('Error inserting scoring close tiers:', insertTiersError);
                        return null;
                    }
                }

                trackUsage('update scoring rules', formatUsagePayload({ rules }));
                return 1;
            },

            // Single-row model: save is immediately active.
            publishScoringRules: async (ruleSetId) => {
                return true;
            },

            // Replace joker selections for a user with supplied match IDs.
            saveUserJokerSelections: async (username, matchIds) => {
                const normalizedUsername = (username || '').trim().toLowerCase();
                if (!normalizedUsername) return false;

                const { data: user, error: userError } = await supabaseClient
                    .from('users')
                    .select('id')
                    .eq('username', normalizedUsername)
                    .single();
                if (userError || !user) {
                    console.error('Error finding user for joker selection save:', userError);
                    return false;
                }

                const { error: deleteError } = await supabaseClient
                    .from('user_joker_selections')
                    .delete()
                    .eq('user_id', user.id);
                if (deleteError) {
                    console.error('Error clearing existing joker selections:', deleteError);
                    return false;
                }

                const uniqueMatchIds = [...new Set((matchIds || [])
                    .map(id => parseInt(id, 10))
                    .filter(id => Number.isInteger(id) && id > 0))]
                    .sort((a, b) => a - b);

                if (uniqueMatchIds.length === 0) {
                    trackUsage('save joker selections', formatUsagePayload({ username: normalizedUsername, matchIds: [] }), normalizedUsername);
                    return true;
                }

                const rows = uniqueMatchIds.map(matchId => ({
                    user_id: user.id,
                    match_id: matchId
                }));
                const { error: insertError } = await supabaseClient
                    .from('user_joker_selections')
                    .insert(rows);
                if (insertError) {
                    console.error('Error inserting joker selections:', insertError);
                    return false;
                }

                trackUsage('save joker selections', formatUsagePayload({ username: normalizedUsername, matchIds: uniqueMatchIds }), normalizedUsername);
                return true;
            }
        };

        // In-memory state (loaded from storage on init)
        let users = {};
        let currentUsername = null;
        let adminUsernames = [];
        let appSettings = { predictionsLocked: false };
        let activeScoringRules = null;
        let userJokerSelections = {};
        let scoringRulesDraftId = null;
        let rulesFormInitialized = false;
        let isGuest = false;
        let editingFixtureId = null;
        let nextMatchScoreId = null;
        let editingPredictionContext = null;
        let adminPredictionUsername = null;
        let usageReportEvents = [];
        let usageEventsForRecovery = [];
        const THEME_COOKIE_NAME = 'rugbyPredictorTheme';
        const THEME_STORAGE_KEY = 'rugbyPredictorTheme';
        const COOKIE_FALLBACK_PREFIX = 'rugbyPredictorCookieFallback:';
        const REMEMBERED_USER_KEY = 'rugbyPredictorRememberedUser';

        // Loading state
        let isLoading = true;

        function getUsageActor(actorOverride = null) {
            if (actorOverride) return String(actorOverride).trim().toLowerCase();
            if (currentUsername) return String(currentUsername).trim().toLowerCase();
            return isGuest ? 'guest' : 'guest';
        }

        function trackUsage(action, payload = '', actorOverride = null) {
            const normalizedAction = (action || '').trim();
            if (!normalizedAction) return;
            Storage.trackUsageEvent(getUsageActor(actorOverride), normalizedAction, payload);
        }

        function formatUsagePayload(input) {
            if (input === null || input === undefined) return '';
            if (typeof input === 'string') return input;
            try {
                return JSON.stringify(input);
            } catch (error) {
                return String(input);
            }
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

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

        function normalizeRememberedUsername(value) {
            const normalized = (value || '').trim().toLowerCase();
            if (!normalized) return '';
            if (!/^[a-z0-9]+$/.test(normalized)) return '';
            return normalized;
        }

        function setRememberedUsername(username) {
            const normalized = normalizeRememberedUsername(username);
            if (!normalized) return;

            setCookie('rugbyPredictorUser', normalized);
            try {
                localStorage.setItem(REMEMBERED_USER_KEY, normalized);
            } catch (error) {
                // Ignore storage errors.
            }
        }

        function clearRememberedUsername() {
            deleteCookie('rugbyPredictorUser');
            try {
                localStorage.removeItem(REMEMBERED_USER_KEY);
            } catch (error) {
                // Ignore storage cleanup errors.
            }
        }

        function getRememberedUsername() {
            const cookieUsername = normalizeRememberedUsername(getCookie('rugbyPredictorUser'));
            if (cookieUsername) return cookieUsername;

            try {
                const storedUsername = normalizeRememberedUsername(localStorage.getItem(REMEMBERED_USER_KEY));
                if (storedUsername) return storedUsername;
            } catch (error) {
                // Ignore storage errors and return empty string below.
            }

            return '';
        }

        // Initialize data from supabaseClient
        async function initializeData() {
            try {
                // Show loading indicator
                showLoadingScreen();
                
                // Load all data in parallel
                const [loadedUsers, loadedAdmins, loadedSettings, loadedMatches, loadedRules, loadedJokerSelections] = await Promise.all([
                    Storage.getUsers(),
                    Storage.getAdminUsernames(),
                    Storage.getSettings(),
                    Storage.getMatches(),
                    Storage.getActiveScoringRules(),
                    Storage.getUserJokerSelections()
                ]);
                
                users = loadedUsers;
                adminUsernames = loadedAdmins;
                appSettings = loadedSettings;
                activeScoringRules = loadedRules;
                userJokerSelections = loadedJokerSelections;
                
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

        async function refreshMatchSummaryAfterScoreSave() {
            const summaryTab = document.getElementById('summaryTab');
            const isSummaryVisible = !!summaryTab && !summaryTab.classList.contains('hidden');
            if (isSummaryVisible) {
                await refreshSummaryData();
            } else {
                showSummary();
            }
        }

        // Render admin matches for entering results
        function renderAdminMatches() {
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

        function getNextMatchWithoutScore() {
            return matches.find(match => match.actualScore1 === null || match.actualScore2 === null) || null;
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
            const nextMatch = getNextMatchWithoutScore();
            const shouldShowQuickAdd = !!nextMatch && isMatchDueTodayOrPast(nextMatch);

            if (actionRow) {
                if (isCurrentUserAdmin() && shouldShowQuickAdd) {
                    actionRow.classList.remove('hidden');
                } else {
                    actionRow.classList.add('hidden');
                }
            }

            if (!nextMatch || !shouldShowQuickAdd) {
                btn.disabled = true;
                btn.textContent = nextMatch
                    ? `Add ${getFlag(nextMatch.team1)} ${getTeamAbbr(nextMatch.team1)} v ${getFlag(nextMatch.team2)} ${getTeamAbbr(nextMatch.team2)} Score`
                    : 'No Remaining Match Score To Add';
                return;
            }

            btn.disabled = false;
            btn.textContent = `Add ${getFlag(nextMatch.team1)} ${getTeamAbbr(nextMatch.team1)} v ${getFlag(nextMatch.team2)} ${getTeamAbbr(nextMatch.team2)} Score`;
        }

        function openNextMatchScoreModal() {
            if (!isCurrentUserAdmin()) return;
            const nextMatch = getNextMatchWithoutScore();
            if (!nextMatch || !isMatchDueTodayOrPast(nextMatch)) {
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

            await Storage.saveMatches(matches);
            closeNextMatchScoreModal();
            renderAdminMatches();
            updateLeaderboard();
            await refreshMatchSummaryAfterScoreSave();
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

            await Storage.saveMatches(matches);
            closeEditFixtureModal();
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
                const year = monthDayMatch[3] || '2026';
                if (month) return toIsoIfValid(year, month, day);
            }

            const dayMonthMatch = withoutWeekday.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
            if (dayMonthMatch) {
                const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                const day = dayMonthMatch[1];
                const year = dayMonthMatch[3] || '2026';
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
                updateAdminTabsSubheading();
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
                    updateAdminTabsSubheading();
                }

                // Re-key in local users object
                users[newUsername] = users[username];
                delete users[username];

                // Update current session if editing self
                if (currentUsername === username) {
                    currentUsername = newUsername;
                    setRememberedUsername(newUsername);
                }
            }

            users[newUsername].nickname = nickname;
            users[newUsername].supportedTeams = [team1, team2].filter(Boolean);

            await Storage.saveUser(newUsername, users[newUsername]);
            updateAdminTabsSubheading();
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
            updateAdminTabsSubheading();
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
            updateAdminTabsSubheading();

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
            const hasExistingPassword = !!user.passwordHash;
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
            const hasExistingPassword = !!user.passwordHash;
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

                    const isValid = await verifyPassword(currentPassword, user.passwordHash);

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
        async function changeTheme(theme, persistToUser = true) {
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
            if (persistToUser && currentUsername && users[currentUsername]) {
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
            changeTheme(storageTheme || cookieTheme || userTheme || 'classic', false);
        }

        function toggleGlobalHelp() {
            const modal = document.getElementById('globalHelpModal');
            if (!modal) return;
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
            trackUsage('guest logs in', formatUsagePayload({ mode: 'guest' }), 'guest');
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

            const hasPassword = !!users[username].passwordHash;
            if (hasPassword && !password) {
                showLoginFeedback('Please enter both username and password.', 'error');
                return;
            }

            // Check password
            let passwordValid = false;
            if (!hasPassword) {
                passwordValid = true;
            } else {
                passwordValid = await verifyPassword(password, users[username].passwordHash);
            }

            if (!passwordValid) {
                showLoginFeedback('Incorrect password. Please try again.', 'error');
                return;
            }

            // Successful login
            showLoginFeedback('Login successful. Welcome back, ' + toTitleCase(users[username].nickname) + '.', 'success');
            currentUsername = username;
            setRememberedUsername(username);
            trackUsage('user logs in', formatUsagePayload({ username }), username);
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
            setRememberedUsername(username);
            trackUsage('user logs in', formatUsagePayload({ username, source: 'register' }), username);

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
            clearRememberedUsername();
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
            updateAdminTabsSubheading();
            updateNextMatchScoreButtonState();

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
            document.getElementById('adminHomeTab').classList.add('hidden');

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

        function renderAdminPredictionOutstandingBox() {
            const usernames = Object.keys(users);
            if (usernames.length === 0) {
                return `
                    <div class="admin-prediction-audit-box complete">
                        <div class="admin-prediction-audit-title">Competitor Completion Check</div>
                        <div class="admin-prediction-audit-empty">No competitors found.</div>
                    </div>
                `;
            }

            const issues = usernames
                .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
                .map(username => {
                    const status = getPredictionChecklistStatus(username);
                    const missing = [];
                    if (status.pendingPredictions > 0) missing.push(`${status.pendingPredictions} prediction${status.pendingPredictions !== 1 ? 's' : ''}`);
                    if (!status.triesEntered) missing.push('tournament tries');
                    if (!status.jokerComplete) missing.push(`jokers ${status.jokerSelectedCount}/${status.jokerRequiredCount}`);
                    return { username, missing };
                })
                .filter(entry => entry.missing.length > 0);

            if (issues.length === 0) {
                return `
                    <div class="admin-prediction-audit-box complete">
                        <div class="admin-prediction-audit-title">Competitor Completion Check</div>
                        <div class="admin-prediction-audit-empty">All competitors are complete.</div>
                    </div>
                `;
            }

            const rows = issues.map(entry => `
                <div class="admin-prediction-audit-row">
                    <span class="admin-prediction-audit-user">${getDisplayName(entry.username)}</span>
                    <span class="admin-prediction-audit-missing">${entry.missing.join(', ')} outstanding</span>
                </div>
            `).join('');

            return `
                <div class="admin-prediction-audit-box">
                    <div class="admin-prediction-audit-title">Competitor Completion Check</div>
                    <div class="admin-prediction-audit-subtitle">Select a competitor to edit. The following still have outstanding items:</div>
                    <div class="admin-prediction-audit-list">${rows}</div>
                </div>
            `;
        }

        function getPredictionStatusLabel(prediction) {
            if (!prediction) {
                return '<span class="capture-status pending">-</span>';
            }
            return `<span class="capture-status captured">${prediction.team1}-${prediction.team2}</span>`;
        }

        function getActualStatusLabel(match) {
            if (match.actualScore1 === null || match.actualScore2 === null) {
                return '<span class="capture-status pending">-</span>';
            }
            return `<span class="capture-status captured">${match.actualScore1}-${match.actualScore2}</span>`;
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

            if (jokerInput) {
                jokerInput.checked = !!isCurrentJoker;
                jokerInput.disabled = !match.jokerEligible || requiredJokers === 0 || cannotSelectMore;
            }
            if (jokerGroup) {
                jokerGroup.style.display = match.jokerEligible ? 'flex' : 'none';
            }
            if (jokerHint) {
                jokerHint.textContent = match.jokerEligible
                    ? (requiredJokers === 0
                        ? 'Jokers are disabled in current rules.'
                        : `Select up to ${requiredJokers} joker${requiredJokers !== 1 ? 's' : ''}. Currently selected: ${selectedJokers.length}/${requiredJokers}.`)
                    : 'This fixture is not joker-eligible.';
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
            const container = document.getElementById('adminUserMatchesContainer');
            const triesSection = document.getElementById('adminTriesSection');
            if (!container) return;

            populateAdminPredictionUserSelect();

            const username = adminPredictionUsername;
            if (!username || !users[username]) {
                container.innerHTML = renderAdminPredictionOutstandingBox();
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
        
        // Legacy helper kept for compatibility with older UI hooks.
        async function selectJoker(matchId) {
            if (appSettings.predictionsLocked) return;
            const requiredJokers = getRequiredJokerCount();
            if (requiredJokers === 0) return;
            const selected = getUserSelectedJokerMatchIds(currentUsername);
            if (!selected.includes(matchId)) {
                if (selected.length >= requiredJokers) return;
                selected.push(matchId);
            }
            setUserSelectedJokerMatchIds(currentUsername, selected);
            await Storage.saveUserJokerSelections(currentUsername, selected);
            // Re-render to update card highlight
            renderMatches();
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

        function normalizeScoringRules(sourceRules = null) {
            const fallback = {
                correctResultPoints: 3,
                perfectScoreBonus: 3,
                drawBonus: 2,
                applyClosePerTeam: true,
                maxJokersPerUser: 1,
                entryFeeAmount: 0,
                payoutFirstPct: 0,
                payoutSecondPct: 0,
                payoutThirdPct: 0,
                payoutClosestTriesPct: 0,
                closeTiers: [{ tierOrder: 1, withinPoints: 5, bonusPoints: 1 }]
            };

            const source = sourceRules || fallback;
            const closeTiers = ((source.closeTiers || fallback.closeTiers) || [])
                .map((tier, index) => ({
                    tierOrder: Math.max(1, Number(tier.tierOrder ?? index + 1) || index + 1),
                    withinPoints: Math.max(0, Number(tier.withinPoints ?? 0) || 0),
                    bonusPoints: Math.max(0, Number(tier.bonusPoints ?? 0) || 0)
                }))
                .sort((a, b) => a.withinPoints - b.withinPoints)
                .slice(0, 3);

            return {
                correctResultPoints: Math.max(0, Number(source.correctResultPoints ?? fallback.correctResultPoints) || 0),
                perfectScoreBonus: Math.max(0, Number(source.perfectScoreBonus ?? fallback.perfectScoreBonus) || 0),
                drawBonus: Math.max(0, Number(source.drawBonus ?? fallback.drawBonus) || 0),
                applyClosePerTeam: true,
                maxJokersPerUser: Math.max(0, Number(source.maxJokersPerUser ?? fallback.maxJokersPerUser) || 0),
                entryFeeAmount: Math.max(0, Number(source.entryFeeAmount ?? fallback.entryFeeAmount) || 0),
                payoutFirstPct: Math.max(0, Number(source.payoutFirstPct ?? fallback.payoutFirstPct) || 0),
                payoutSecondPct: Math.max(0, Number(source.payoutSecondPct ?? fallback.payoutSecondPct) || 0),
                payoutThirdPct: Math.max(0, Number(source.payoutThirdPct ?? fallback.payoutThirdPct) || 0),
                payoutClosestTriesPct: Math.max(0, Number(source.payoutClosestTriesPct ?? fallback.payoutClosestTriesPct) || 0),
                closeTiers: closeTiers.length > 0 ? closeTiers : fallback.closeTiers
            };
        }

        function getEffectiveScoringRules() {
            return normalizeScoringRules(activeScoringRules);
        }

        function getUserSelectedJokerMatchIds(username) {
            const fromNewTable = userJokerSelections && Array.isArray(userJokerSelections[username])
                ? userJokerSelections[username]
                : [];
            if (fromNewTable.length > 0) {
                const eligibleIds = new Set(getEligibleJokerMatchIds());
                return [...new Set(fromNewTable.map(id => Number(id)).filter(Number.isInteger))]
                    .filter(id => eligibleIds.has(id))
                    .sort((a, b) => a - b);
            }

            return [];
        }

        function setUserSelectedJokerMatchIds(username, matchIds) {
            const normalizedUsername = (username || '').trim().toLowerCase();
            if (!normalizedUsername) return;
            const eligibleIds = new Set(getEligibleJokerMatchIds());
            const requiredJokers = getRequiredJokerCount();
            const normalized = [...new Set((matchIds || [])
                .map(id => Number(id))
                .filter(Number.isInteger))]
                .filter(id => eligibleIds.has(id))
                .sort((a, b) => a - b)
                .slice(0, requiredJokers === 0 ? 0 : requiredJokers);

            userJokerSelections[normalizedUsername] = normalized;
        }

        function isUserJokerForMatch(username, matchId) {
            const parsedMatchId = Number(matchId);
            if (!Number.isInteger(parsedMatchId)) return false;
            return getUserSelectedJokerMatchIds(username).includes(parsedMatchId);
        }

        function findCloseTierForDiff(diff, rules) {
            if (!Number.isFinite(diff) || diff < 0) return null;
            const eligible = (rules.closeTiers || []).filter(tier => diff <= tier.withinPoints);
            if (eligible.length === 0) return null;

            return eligible.reduce((best, tier) => {
                if (!best) return tier;
                if (tier.bonusPoints > best.bonusPoints) return tier;
                if (tier.bonusPoints === best.bonusPoints && tier.withinPoints < best.withinPoints) return tier;
                return best;
            }, null);
        }

        // Shared scoring logic used across leaderboard, summary, and PDF export.
        function calculateMatchPoints(prediction, match, isJoker = false) {
            if (!prediction || match.actualScore1 === null || match.actualScore2 === null) {
                return null;
            }
            return getMatchPointsBreakdown(prediction, match, isJoker).points;
        }

        function calculateMatchPointsBreakdownWithRules(prediction, match, isJoker, rules) {
            if (!prediction || match.actualScore1 === null || match.actualScore2 === null) {
                return {
                    points: 0,
                    summary: '',
                    basePoints: 0,
                    correctResult: false,
                    perfectScore: false,
                    team1CloseBonus: 0,
                    team2CloseBonus: 0,
                    drawBonus: 0,
                    jokerApplied: false
                };
            }

            const actualResult = getResult(match.actualScore1, match.actualScore2);
            const predictedResult = getResult(prediction.team1, prediction.team2);
            const correctResult = actualResult === predictedResult;
            const parts = [];
            let basePoints = 0;
            let perfectScore = false;
            let team1CloseBonus = 0;
            let team2CloseBonus = 0;
            let drawBonus = 0;

            if (correctResult) {
                if (rules.correctResultPoints > 0) {
                    basePoints += rules.correctResultPoints;
                    parts.push(`Correct Result (+${rules.correctResultPoints})`);
                }

                const team1Diff = Math.abs(prediction.team1 - match.actualScore1);
                const team2Diff = Math.abs(prediction.team2 - match.actualScore2);
                perfectScore = team1Diff === 0 && team2Diff === 0;

                if (perfectScore) {
                    if (rules.perfectScoreBonus > 0) {
                        basePoints += rules.perfectScoreBonus;
                        parts.push(`Perfect Score (+${rules.perfectScoreBonus})`);
                    }
                } else {
                    const team1Tier = findCloseTierForDiff(team1Diff, rules);
                    if (team1Tier && team1Tier.bonusPoints > 0) {
                        team1CloseBonus = team1Tier.bonusPoints;
                        basePoints += team1CloseBonus;
                        parts.push(`${match.team1} Close Score (+${team1CloseBonus})`);
                    }

                    const team2Tier = findCloseTierForDiff(team2Diff, rules);
                    if (team2Tier && team2Tier.bonusPoints > 0) {
                        team2CloseBonus = team2Tier.bonusPoints;
                        basePoints += team2CloseBonus;
                        parts.push(`${match.team2} Close Score (+${team2CloseBonus})`);
                    }
                }

                if (actualResult === 'draw' && rules.drawBonus > 0) {
                    drawBonus = rules.drawBonus;
                    basePoints += drawBonus;
                    parts.push(`Draw Bonus (+${drawBonus})`);
                }
            }

            let points = basePoints;
            const jokerApplied = !!isJoker && basePoints > 0;
            if (jokerApplied) {
                points *= 2;
                parts.push(`Joker Bonus (x2: ${basePoints} to ${points})`);
            }

            return {
                points,
                summary: points === 0 ? '' : parts.join(' + '),
                basePoints,
                correctResult,
                perfectScore,
                team1CloseBonus,
                team2CloseBonus,
                drawBonus,
                jokerApplied
            };
        }

        // Return both points and a short explanation for completed matches.
        function getMatchPointsBreakdown(prediction, match, isJoker = false) {
            const rules = getEffectiveScoringRules();
            return calculateMatchPointsBreakdownWithRules(prediction, match, isJoker, rules);
        }

        // Calculate points based on scoring rules
        function calculatePoints(username) {
            const user = users[username];
            if (!user) return 0;
            let totalPoints = 0;

            matches.forEach(match => {
                const prediction = user.predictions[match.id];
                const matchPoints = calculateMatchPoints(prediction, match, isUserJokerForMatch(username, match.id));
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
            const formatNameList = (nameList) => {
                if (!nameList || nameList.length === 0) return '';
                if (nameList.length <= 3) return nameList.join(', ');
                return `${nameList.slice(0, 3).join(', ')} and ${nameList.length - 3} others`;
            };

            let nextMatchPredictionSummary = '';
            if (nextMatch) {
                const nextPredictions = allUsers
                    .map(username => ({
                        username,
                        nickname: toTitleCase(users[username].nickname || username),
                        prediction: users[username] && users[username].predictions
                            ? users[username].predictions[nextMatch.id]
                            : null
                    }))
                    .filter(entry => entry.prediction &&
                        Number.isFinite(entry.prediction.team1) &&
                        Number.isFinite(entry.prediction.team2));

                if (nextPredictions.length === 0) {
                    nextMatchPredictionSummary = `No score predictions are in yet for ${nextMatch.team1} vs ${nextMatch.team2}.`;
                } else {
                    const team1Winners = [];
                    const team2Winners = [];
                    const drawPickers = [];

                    nextPredictions.forEach(entry => {
                        const predictedResult = getResult(entry.prediction.team1, entry.prediction.team2);
                        if (predictedResult === 'team1') {
                            team1Winners.push(entry.nickname);
                        } else if (predictedResult === 'team2') {
                            team2Winners.push(entry.nickname);
                        } else {
                            drawPickers.push(entry.nickname);
                        }
                    });

                    const totalPredictions = nextPredictions.length;
                    if (team1Winners.length === totalPredictions) {
                        nextMatchPredictionSummary = `Prediction split: everyone is backing ${nextMatch.team1}.`;
                    } else if (team2Winners.length === totalPredictions) {
                        nextMatchPredictionSummary = `Prediction split: everyone is backing ${nextMatch.team2}.`;
                    } else if (drawPickers.length === totalPredictions) {
                        nextMatchPredictionSummary = 'Prediction split: everyone is calling it a draw.';
                    } else {
                        const splitParts = [];
                        if (team1Winners.length > 0) splitParts.push(`${formatNameList(team1Winners)} ${team1Winners.length === 1 ? 'is' : 'are'} backing ${nextMatch.team1}`);
                        if (team2Winners.length > 0) splitParts.push(`${formatNameList(team2Winners)} ${team2Winners.length === 1 ? 'is' : 'are'} backing ${nextMatch.team2}`);
                        if (drawPickers.length > 0) splitParts.push(`${formatNameList(drawPickers)} ${drawPickers.length === 1 ? 'is' : 'are'} calling it a draw`);
                        nextMatchPredictionSummary = splitParts.length > 0
                            ? `Prediction split: ${splitParts.join('; ')}.`
                            : `No score predictions are in yet for ${nextMatch.team1} vs ${nextMatch.team2}.`;
                    }
                }
            }
            const nextFixtureWithHistory = [nextFixtureText, nextMatchPredictionSummary].filter(Boolean).join(' ');
            const nextFixtureParagraph = nextFixtureWithHistory ? `<br><br>${nextFixtureWithHistory}` : '';
            
            if (completedMatches.length === 0) {
                tip = `No matches played yet, but the tension is building like ${randomWorldCupClassic}! Get your predictions in sharpish - this isn't a Gloucester training session where you can take your time. The tournament kicks off soon and every point counts. Make sure you've got all your scores in before kick-off - no late changes allowed once the whistle blows! Remember, predicting a draw gets you bonus points, and if you nail the exact score, you'll be celebrating like Gloucester winning the Premiership.${nextFixtureParagraph}`;
            } else if (leaderboardData.length === 1) {
                tip = `${leaderboardData[0].nickname} is currently the only competitor - ${randomGloucester}! Bit lonely at the top though, like being the only person who remembers Gloucester's Powergen Cup wins. Get some mates involved and make this a proper competition! The more the merrier, as they say down at Kingsholm on match day.${nextFixtureParagraph}`;
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
                    tip = `It's tighter than the 2003 World Cup final at the top! ${leader.nickname} and ${second.nickname} are level on ${leader.points} points - ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}<br><br>${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches still to play, this one's going down to the wire like England vs Australia in Sydney! Every prediction counts now - one perfect score could swing it all.${nextFixtureParagraph}`;
                } else if (gap <= 3) {
                    tip = `${leader.nickname} leads with ${leader.points} points but ${second.nickname} is breathing down their neck like a Gloucester flanker hunting a fly-half! Only ${gap} point${gap > 1 ? 's' : ''} separating them. ${matchAnalysis}${predictionAnalysis}<br><br>${tieAnalysis}${bottomTableAnalysis}With ${remainingMatches} matches left, one good round of predictions could change everything. Feels like the closing minutes of ${randomWorldCupClassic}.${nextFixtureParagraph}`;
                } else if (gap <= 6) {
                    tip = `${leader.nickname} is building a handy lead on ${leader.points} points, but ${second.nickname} on ${second.points} won't give up without a fight - ${randomGloucester}. ${matchAnalysis}${predictionAnalysis}<br><br>${tieAnalysis}${bottomTableAnalysis}Still ${remainingMatches} matches to play, which means plenty of points up for grabs. A couple of perfect scores and this leaderboard could look very different.${nextFixtureParagraph}`;
                } else if (gap <= 10) {
                    tip = `${leader.nickname} is pulling clear on ${leader.points} points - ${randomGloucester}! ${second.nickname} trails by ${gap} points and needs to find form quickly. ${matchAnalysis}${predictionAnalysis}<br><br>${tieAnalysis}${bottomTableAnalysis}But don't count anyone out yet - remember ${randomWorldCupClassic}? Anything's possible in this game!${nextFixtureParagraph}`;
                } else {
                    tip = `${leader.nickname} is running away with it on ${leader.points} points - ${randomGloucester}! ${second.nickname} trails by ${gap} points and needs a serious comeback worthy of the 1999 French team against the All Blacks. ${matchAnalysis}${predictionAnalysis}<br><br>${tieAnalysis}${bottomTableAnalysis}The gap looks big, but ${remainingMatches} matches means up to ${remainingMatches * 11} points still available. Stranger things have happened - ${randomGloucester2}!${nextFixtureParagraph}`;
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

            const rankLine = (label, pct, group) => {
                const names = group ? formatNamesForUsers(group.users) : 'TBD';
                const share = group && group.users.length > 0
                    ? projection.leaderboardPayouts[group.users[0].username] || 0
                    : 0;
                const amountSuffix = group && group.users.length > 1 ? ' each' : '';
                return `
                    <div class="prize-rank-cell">
                        <div class="prize-row-head">${label} (${pct}%)</div>
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

            container.innerHTML = `
                <div class="tries-stats-title">Prize Money</div>
                <div class="prize-subheading">As things currently stand</div>
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
                    <div class="prize-row">
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

        // Show comprehensive summary with matches as columns
        function showSummary() {
            const container = document.getElementById('summaryContainer');
            const allUsers = Object.keys(users);
            
            if (allUsers.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No competitors have registered yet.</p>';
                renderPrizeMoneyPanel([]);
                updateLeaderboard();
                return;
            }

            const filteredMatches = getFilteredMatches();
            
            if (filteredMatches.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No matches match the current filter.</p>';
                const sortedUsersForPrizeOnly = Object.keys(users)
                    .map(username => ({
                        username: username,
                        nickname: toTitleCase(users[username].nickname || username),
                        totalPoints: calculatePoints(username)
                    }))
                    .sort((a, b) => b.totalPoints - a.totalPoints);
                renderPrizeMoneyPanel(sortedUsersForPrizeOnly);
                updateLeaderboard();
                return;
            }

            // Calculate total actual tries so far
            const totalActualTries = getTotalActualTries();
            const completedMatches = matches.filter(m => m.actualTries1 !== null && m.actualTries2 !== null).length;
            const totalMatches = matches.length;

            const isNarrowScreen = window.innerWidth <= 768;
            let scrollHintText;
            if (currentFilter === 'default') {
                scrollHintText = isNarrowScreen
                    ? 'Scroll left and right to see all matches. On phone, rotate to landscape for the best view.'
                    : 'Scroll left and right to see all matches';
            } else {
                scrollHintText = isNarrowScreen
                    ? 'Scroll right to see full table. On phone, rotate to landscape for the best view.'
                    : 'Scroll right to see full table';
            }
            const scrollHintArrow = currentFilter === 'default' ? '↔' : '→';
            const scrollHintMarkup = `<div class="scroll-hint hidden" id="scrollHint"><span>${scrollHintText}</span><span class="scroll-hint-arrow">${scrollHintArrow}</span></div>`;

            let html = scrollHintMarkup;
            html += '<div class="summary-container">';
            html += '<table class="summary-table">';
            
            // Header row: Rank | Competitor | Score | Match 1 | Match 2 | ... | Predicted Tries
            html += '<thead><tr>';
            html += '<th class="rank-col">#</th>';
            html += '<th class="competitor-col">Competitor</th>';
            html += '<th class="pts-col">Score</th>';
            filteredMatches.forEach((match, colIndex) => {
                const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                const hasTries = match.actualTries1 !== null && match.actualTries2 !== null;
                const totalMatchTries = hasTries ? match.actualTries1 + match.actualTries2 : null;
                const jokerBadge = match.jokerEligible ? '<div class="joker-eligible-badge">🃏 Joker Eligible</div>' : '<div class="joker-eligible-badge" style="visibility: hidden;">🃏 Joker Eligible</div>';
                html += `<th class="match-header-cell ${match.jokerEligible ? 'joker-eligible-header' : ''}" data-match-col="${colIndex}">
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
            // Only show Tries column when not filtering by round
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
                    const isJoker = isUserJokerForMatch(user.username, match.id);
                    const breakdown = hasResult
                        ? getMatchPointsBreakdown(pred, match, isJoker)
                        : null;

                    if (hasResult && breakdown) {
                        pointsEarned = breakdown.points;
                        if (breakdown.perfectScore) {
                            pointsClass = 'points-perfect';
                        } else if (breakdown.correctResult) {
                            pointsClass = pointsEarned > 3 ? 'points-4' : 'points-3';
                        }

                        tooltipContent += `<span class="tooltip-line">Predicted: ${pred.team1} - ${pred.team2}</span>`;
                        tooltipContent += `<span class="tooltip-line">Actual: ${match.actualScore1} - ${match.actualScore2}</span>`;
                        if (breakdown.summary) {
                            breakdown.summary.split(' + ').forEach(part => {
                                const className = part.startsWith('Joker Bonus')
                                    ? 'joker-bonus'
                                    : breakdown.correctResult
                                        ? 'bonus'
                                        : 'incorrect';
                                tooltipContent += `<span class="tooltip-line ${className}">${part}</span>`;
                            });
                        } else {
                            tooltipContent += '<span class="tooltip-line incorrect">Wrong result (0)</span>';
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
                
                // Predicted tries column with calculated projection (only when not filtering by round)
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
            html += '</div>';

            container.innerHTML = html;
            renderPrizeMoneyPanel(sortedUsers);
            updateLeaderboard();
            checkTableOverflow();

            // In default view, auto-scroll to show the relevant matches
            if (currentFilter === 'default') {
                scrollToDefaultMatches();
            }
        }

        // Scroll the summary table so the default matches (last 2 completed + next 3 upcoming) are visible
        function scrollToDefaultMatches() {
            const container = document.querySelector('.summary-container');
            if (!container) return;

            const targetIndex = getDefaultScrollTargetIndex();
            const targetCell = container.querySelector(`th[data-match-col="${targetIndex}"]`);
            if (!targetCell) return;

            // Scroll so the target cell is at the left edge (after the sticky columns)
            // Use offsetLeft relative to the table, minus the sticky columns width
            const stickyWidth = targetCell.closest('table').querySelector('.pts-col').offsetLeft +
                                targetCell.closest('table').querySelector('.pts-col').offsetWidth;
            const scrollTarget = targetCell.offsetLeft - stickyWidth;
            container.scrollLeft = Math.max(0, scrollTarget);
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
                return calculateMatchPoints(pred, match, isUserJokerForMatch(username, match.id));
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

            // --- Build header rows (fixture header spans Home/Away/Points columns) ---
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
                    colSpan: 3,
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
                    { content: teamAbbr[m.team2] || m.team2, styles: { halign: 'center', fontSize: 5.2 } },
                    { content: 'Pts', styles: { halign: 'center', fontSize: 5.2 } }
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
                        { content: away, styles: { textColor: awayColor, fontStyle: 'bold', fontSize: 6, halign: 'center' } },
                        { content: '', styles: { textColor: hexToRgb(C.gray), fontStyle: 'bold', fontSize: 6, halign: 'center' } }
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
                        },
                        { content: '', styles: { textColor: hexToRgb(C.gray), fontStyle: 'bold', fontSize: 6, halign: 'center' } }
                    ];
                }).flat(),
                { content: completedTriesMatches > 0 ? totalActualTries + ' (' + estimatedTotalTries + ')' : '', styles: { textColor: hexToRgb(C.black), fontStyle: 'bold', fontSize: 6.5 } }
            ];

            // --- Build data rows (single row per user with per-match points cell) ---
            const dataRows = sortedUsers.map((user, index) => {
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

                allMatches.forEach(match => {
                    const pred = users[user.username].predictions[match.id];
                    const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                    const isJoker = isUserJokerForMatch(user.username, match.id);
                    const pts = getMatchPoints(user.username, match);

                    if (!pred) {
                        scoreRow.push({ content: '\u2014', styles: { textColor: hexToRgb(C.gray), fontSize: 6 } });
                        scoreRow.push({ content: '\u2014', styles: { textColor: hexToRgb(C.gray), fontSize: 6 } });
                        scoreRow.push({ content: '\u2014', styles: { textColor: hexToRgb(C.gray), fontSize: 5.5, halign: 'center' } });
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

                    const ptsText = pts === null ? '' : String(pts);
                    const ptsColor = pts === null
                        ? hexToRgb(C.gray)
                        : pts === 0
                            ? [184, 92, 0] // dark orange
                            : hexToRgb('#1F5FBF'); // blue
                    scoreRow.push({
                        content: ptsText,
                        styles: {
                            textColor: ptsColor,
                            fontSize: 6.5,
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

                return scoreRow;
            });

            // --- Render table ---
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginLR = 4;
            const tableWidth = pageWidth - marginLR * 2;
            const scoreColumnCount = allMatches.length * 3;
            const fixedWidth = 6 + 20 + 9 + 10; // rank + name + score + tries
            const matchColWidth = Math.max(4.2, (tableWidth - fixedWidth) / scoreColumnCount);
            const triesColIndex = 3 + scoreColumnCount;
            const colStyles = {
                0: { cellWidth: 6 },
                1: { cellWidth: 20 },
                2: { cellWidth: 9 },
            };
            for (let i = 3; i < triesColIndex; i++) {
                colStyles[i] = { cellWidth: matchColWidth };
            }
            colStyles[triesColIndex] = { cellWidth: 10 };

            doc.autoTable({
                head: [headerRowTop, headerRowBottom],
                body: [actualScoresRow, actualTriesRow, ...dataRows],
                startY: 28,
                theme: 'grid',
                tableWidth: tableWidth,
                styles: {
                    fontSize: 5.8,
                    cellPadding: 0.45,
                    lineColor: hexToRgb(C.border),
                    lineWidth: 0.2,
                    halign: 'center',
                    valign: 'middle',
                    overflow: 'hidden',
                    font: 'helvetica',
                },
                headStyles: {
                    fillColor: hexToRgb(C.white),
                    textColor: hexToRgb(C.black),
                    fontStyle: 'bold',
                    fontSize: 4.8,
                    cellPadding: 0.35,
                    halign: 'center',
                    lineColor: hexToRgb(C.border),
                    lineWidth: 0.3,
                },
                columnStyles: colStyles,
                didParseCell: function(data) {
                    // Subtle striping for user rows.
                    // Keep any explicit per-cell fill (e.g. exact-score highlight) untouched.
                    if (data.section === 'body' && data.row.index >= 2) {
                        const hasExplicitFill = Array.isArray(data.cell.styles.fillColor);
                        if (!hasExplicitFill) {
                            const userRowIndex = data.row.index - 2;
                            if (userRowIndex % 2 === 0) {
                                data.cell.styles.fillColor = [248, 248, 248];
                            }
                        }
                    }

                    // Thicker right border on Score column to separate fixed columns from matches
                    if (data.column.index === 2) {
                        data.cell.styles.lineWidth = { bottom: 0.2, top: 0.2, left: 0.2, right: 0.5 };
                    }
                    // Thicker separators after each match block (home, away, points).
                    if (data.column.index >= 3 && data.column.index < triesColIndex && ((data.column.index - 3) % 3 === 2)) {
                        const lw = data.cell.styles.lineWidth;
                        if (typeof lw === 'object') {
                            lw.right = 0.5;
                        } else {
                            data.cell.styles.lineWidth = { bottom: 0.2, top: 0.2, left: 0.2, right: 0.5 };
                        }
                    }
                    // Thicker separators before each match block.
                    if (data.column.index >= 3 && data.column.index < triesColIndex && ((data.column.index - 3) % 3 === 0)) {
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

                    // Thicker horizontal borders around each user's row.
                    if (data.section === 'body' && data.row.index >= 2) {
                        const current = data.cell.styles.lineWidth;
                        const normalized = typeof current === 'object'
                            ? current
                            : { top: current || 0.2, bottom: current || 0.2, left: current || 0.2, right: current || 0.2 };

                        normalized.top = Math.max(normalized.top || 0.2, 0.45);
                        normalized.bottom = Math.max(normalized.bottom || 0.2, 0.45);

                        data.cell.styles.lineWidth = normalized;
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

        function setRulesFeedback(message, type = 'info') {
            const feedbackEls = [
                document.getElementById('rulesFeedback'),
                document.getElementById('prizeRulesFeedback')
            ].filter(Boolean);
            if (feedbackEls.length === 0) return;

            feedbackEls.forEach(feedback => {
                if (!message) {
                    feedback.classList.add('hidden');
                    feedback.classList.remove('error', 'success', 'info');
                    feedback.textContent = '';
                    return;
                }
                feedback.classList.remove('hidden', 'error', 'success', 'info');
                feedback.classList.add(type);
                feedback.textContent = message;
            });
        }

        function parseRulesIntInput(id, options = {}) {
            const { required = true, fallback = 0 } = options;
            const el = document.getElementById(id);
            if (!el) return required ? null : fallback;
            const raw = String(el.value || '').trim();
            if (!raw) return required ? null : fallback;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
                return null;
            }
            return parsed;
        }

        function parseRulesDecimalInput(id, options = {}) {
            const { required = true, fallback = 0, maxDecimals = 2 } = options;
            const el = document.getElementById(id);
            if (!el) return required ? null : fallback;
            const raw = String(el.value || '').trim();
            if (!raw) return required ? null : fallback;
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 0) return null;
            const factor = 10 ** maxDecimals;
            return Math.round(parsed * factor) / factor;
        }

        function readRulesFormData() {
            const data = {
                id: scoringRulesDraftId,
                correctResultPoints: parseRulesIntInput('rulesCorrectResultPoints'),
                perfectScoreBonus: parseRulesIntInput('rulesPerfectScoreBonus'),
                drawBonus: parseRulesIntInput('rulesDrawBonus'),
                maxJokersPerUser: parseRulesIntInput('rulesMaxJokersPerUser'),
                entryFeeAmount: parseRulesDecimalInput('rulesEntryFeeAmount'),
                payoutFirstPct: parseRulesDecimalInput('rulesPayoutFirstPct'),
                payoutSecondPct: parseRulesDecimalInput('rulesPayoutSecondPct'),
                payoutThirdPct: parseRulesDecimalInput('rulesPayoutThirdPct'),
                payoutClosestTriesPct: parseRulesDecimalInput('rulesPayoutClosestTriesPct'),
                closeTiers: []
            };

            for (let i = 1; i <= 3; i += 1) {
                const withinEl = document.getElementById(`rulesTier${i}Within`);
                const bonusEl = document.getElementById(`rulesTier${i}Bonus`);
                const withinRaw = withinEl ? String(withinEl.value || '').trim() : '';
                const bonusRaw = bonusEl ? String(bonusEl.value || '').trim() : '';

                if (!withinRaw && !bonusRaw) continue;

                const withinPoints = withinRaw ? Number(withinRaw) : null;
                const bonusPoints = bonusRaw ? Number(bonusRaw) : null;
                data.closeTiers.push({
                    tierOrder: i,
                    withinPoints: Number.isFinite(withinPoints) && withinPoints >= 0 && Number.isInteger(withinPoints) ? withinPoints : null,
                    bonusPoints: Number.isFinite(bonusPoints) && bonusPoints >= 0 && Number.isInteger(bonusPoints) ? bonusPoints : null,
                    _hasWithin: !!withinRaw,
                    _hasBonus: !!bonusRaw
                });
            }

            return data;
        }

        function validateRulesFormData(data) {
            const errors = [];

            if (data.correctResultPoints === null) errors.push('Correct result points must be a whole number 0 or higher.');
            if (data.perfectScoreBonus === null) errors.push('Perfect score bonus must be a whole number 0 or higher.');
            if (data.drawBonus === null) errors.push('Draw bonus must be a whole number 0 or higher.');
            if (data.maxJokersPerUser === null) errors.push('Jokers per user must be a whole number 0 or higher.');
            if (data.entryFeeAmount === null) errors.push('Entry fee must be a number 0 or higher.');
            if (data.payoutFirstPct === null) errors.push('1st place payout % must be a number 0 or higher.');
            if (data.payoutSecondPct === null) errors.push('2nd place payout % must be a number 0 or higher.');
            if (data.payoutThirdPct === null) errors.push('3rd place payout % must be a number 0 or higher.');
            if (data.payoutClosestTriesPct === null) errors.push('Closest tries payout % must be a number 0 or higher.');
            if (data.closeTiers.length === 0) errors.push('At least one close-score tier is required.');

            if (
                data.payoutFirstPct !== null &&
                data.payoutSecondPct !== null &&
                data.payoutThirdPct !== null &&
                data.payoutClosestTriesPct !== null
            ) {
                const payoutTotal = data.payoutFirstPct + data.payoutSecondPct + data.payoutThirdPct + data.payoutClosestTriesPct;
                const allZero = payoutTotal === 0;
                if (!allZero && Math.abs(payoutTotal - 100) > 0.001) {
                    errors.push('Prize payout percentages must total exactly 100 (or all be 0 to disable payouts).');
                }
            }

            data.closeTiers.forEach((tier, index) => {
                const row = index + 1;
                if (!tier._hasWithin || !tier._hasBonus) {
                    errors.push(`Tier ${row} must include both "within points" and "bonus points".`);
                    return;
                }
                if (tier.withinPoints === null || tier.bonusPoints === null) {
                    errors.push(`Tier ${row} values must be whole numbers 0 or higher.`);
                    return;
                }
            });

            return errors;
        }

        function getRulesPayloadFromForm() {
            const raw = readRulesFormData();
            const errors = validateRulesFormData(raw);
            const payload = {
                id: raw.id,
                correctResultPoints: raw.correctResultPoints ?? 0,
                perfectScoreBonus: raw.perfectScoreBonus ?? 0,
                drawBonus: raw.drawBonus ?? 0,
                maxJokersPerUser: raw.maxJokersPerUser ?? 0,
                entryFeeAmount: raw.entryFeeAmount ?? 0,
                payoutFirstPct: raw.payoutFirstPct ?? 0,
                payoutSecondPct: raw.payoutSecondPct ?? 0,
                payoutThirdPct: raw.payoutThirdPct ?? 0,
                payoutClosestTriesPct: raw.payoutClosestTriesPct ?? 0,
                closeTiers: raw.closeTiers
                    .filter(tier => tier.withinPoints !== null && tier.bonusPoints !== null)
                    .map((tier, index) => ({
                        tierOrder: index + 1,
                        withinPoints: tier.withinPoints,
                        bonusPoints: tier.bonusPoints
                    }))
            };
            return { payload, errors };
        }

        function updateRulesPublishState() {
            const { errors } = getRulesPayloadFromForm();
            const isValid = errors.length === 0;
            const saveBtns = [
                document.getElementById('rulesSaveUpdatedBtn'),
                document.getElementById('prizeSaveUpdatedBtn')
            ].filter(Boolean);
            saveBtns.forEach(btn => {
                btn.disabled = !isValid;
            });
        }

        function renderRulesPreview() {
            const output = document.getElementById('rulesPreviewOutput');
            if (!output) return;

            const { payload, errors } = getRulesPayloadFromForm();
            if (errors.length > 0) {
                output.textContent = `Preview unavailable: ${errors[0]}`;
                return;
            }

            const pred1 = parseRulesIntInput('rulesPreviewPred1');
            const pred2 = parseRulesIntInput('rulesPreviewPred2');
            const actual1 = parseRulesIntInput('rulesPreviewActual1');
            const actual2 = parseRulesIntInput('rulesPreviewActual2');
            const joker = !!(document.getElementById('rulesPreviewJoker') && document.getElementById('rulesPreviewJoker').checked);

            if ([pred1, pred2, actual1, actual2].some(value => value === null)) {
                output.textContent = 'Enter whole-number predicted and actual scores to preview points.';
                return;
            }

            const rules = normalizeScoringRules(payload);
            const breakdown = calculateMatchPointsBreakdownWithRules(
                { team1: pred1, team2: pred2 },
                { team1: 'Home', team2: 'Away', actualScore1: actual1, actualScore2: actual2 },
                joker,
                rules
            );

            output.textContent = breakdown.points > 0
                ? `${breakdown.points} pts\n${breakdown.summary}`
                : '0 pts\nNo points awarded for this combination.';
        }

        function populateRulesForm(sourceRules) {
            const source = sourceRules || activeScoringRules || {};
            const normalized = normalizeScoringRules(source);
            const tiersByOrder = {};
            (normalized.closeTiers || []).forEach(tier => {
                tiersByOrder[tier.tierOrder] = tier;
            });

            const correctResultPoints = document.getElementById('rulesCorrectResultPoints');
            const perfectScoreBonus = document.getElementById('rulesPerfectScoreBonus');
            const drawBonus = document.getElementById('rulesDrawBonus');
            const maxJokersPerUser = document.getElementById('rulesMaxJokersPerUser');
            const entryFeeAmount = document.getElementById('rulesEntryFeeAmount');
            const payoutFirstPct = document.getElementById('rulesPayoutFirstPct');
            const payoutSecondPct = document.getElementById('rulesPayoutSecondPct');
            const payoutThirdPct = document.getElementById('rulesPayoutThirdPct');
            const payoutClosestTriesPct = document.getElementById('rulesPayoutClosestTriesPct');

            if (correctResultPoints) correctResultPoints.value = normalized.correctResultPoints;
            if (perfectScoreBonus) perfectScoreBonus.value = normalized.perfectScoreBonus;
            if (drawBonus) drawBonus.value = normalized.drawBonus;
            if (maxJokersPerUser) maxJokersPerUser.value = normalized.maxJokersPerUser;
            if (entryFeeAmount) entryFeeAmount.value = normalized.entryFeeAmount;
            if (payoutFirstPct) payoutFirstPct.value = normalized.payoutFirstPct;
            if (payoutSecondPct) payoutSecondPct.value = normalized.payoutSecondPct;
            if (payoutThirdPct) payoutThirdPct.value = normalized.payoutThirdPct;
            if (payoutClosestTriesPct) payoutClosestTriesPct.value = normalized.payoutClosestTriesPct;

            for (let i = 1; i <= 3; i += 1) {
                const withinInput = document.getElementById(`rulesTier${i}Within`);
                const bonusInput = document.getElementById(`rulesTier${i}Bonus`);
                const tier = tiersByOrder[i];
                if (withinInput) withinInput.value = tier ? tier.withinPoints : '';
                if (bonusInput) bonusInput.value = tier ? tier.bonusPoints : '';
            }
        }

        function initializeRulesTabBindings() {
            if (rulesFormInitialized) return;
            const ids = [
                'rulesCorrectResultPoints',
                'rulesPerfectScoreBonus',
                'rulesDrawBonus',
                'rulesMaxJokersPerUser',
                'rulesEntryFeeAmount',
                'rulesPayoutFirstPct',
                'rulesPayoutSecondPct',
                'rulesPayoutThirdPct',
                'rulesPayoutClosestTriesPct',
                'rulesTier1Within',
                'rulesTier1Bonus',
                'rulesTier2Within',
                'rulesTier2Bonus',
                'rulesTier3Within',
                'rulesTier3Bonus',
                'rulesPreviewPred1',
                'rulesPreviewPred2',
                'rulesPreviewActual1',
                'rulesPreviewActual2',
                'rulesPreviewJoker'
            ];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const evt = el.type === 'checkbox' ? 'change' : 'input';
                el.addEventListener(evt, () => {
                    setRulesFeedback('');
                    updateRulesPublishState();
                    renderRulesPreview();
                });
            });
            rulesFormInitialized = true;
        }

        function renderRulesTab() {
            if (!isCurrentUserAdmin()) return;
            initializeRulesTabBindings();
            if (!scoringRulesDraftId) {
                populateRulesForm(activeScoringRules);
            }
            updateRulesPublishState();
            renderRulesPreview();
        }

        function renderPrizeFundTab() {
            if (!isCurrentUserAdmin()) return;
            initializeRulesTabBindings();
            if (!scoringRulesDraftId) {
                populateRulesForm(activeScoringRules);
            }
            updateRulesPublishState();
        }

        async function saveUpdatedRules() {
            if (!isCurrentUserAdmin()) return;
            const { payload, errors } = getRulesPayloadFromForm();
            if (errors.length > 0) {
                setRulesFeedback(errors[0], 'error');
                updateRulesPublishState();
                return;
            }

            const saveBtns = [
                document.getElementById('rulesSaveUpdatedBtn'),
                document.getElementById('prizeSaveUpdatedBtn')
            ].filter(Boolean);
            const originalTexts = new Map();
            saveBtns.forEach(btn => {
                originalTexts.set(btn, btn.textContent);
                btn.disabled = true;
                btn.textContent = 'Saving...';
            });

            try {
                payload.id = scoringRulesDraftId;
                const savedId = await Storage.saveScoringRulesDraft(payload);
                if (!savedId) {
                    setRulesFeedback('Failed to save rules.', 'error');
                    return;
                }
                const published = await Storage.publishScoringRules(savedId);
                if (!published) {
                    setRulesFeedback('Failed to save rules.', 'error');
                    return;
                }

                activeScoringRules = await Storage.getActiveScoringRules();
                scoringRulesDraftId = null;
                populateRulesForm(activeScoringRules);
                setRulesFeedback('Rules saved successfully.', 'success');
                renderRulesPreview();
            } catch (error) {
                console.error('Error saving rules:', error);
                setRulesFeedback('Error while saving rules.', 'error');
            } finally {
                saveBtns.forEach(btn => {
                    btn.textContent = originalTexts.get(btn) || 'Save Updated Rules';
                });
                updateRulesPublishState();
            }
        }

        async function revertRulesToSaved() {
            if (!isCurrentUserAdmin()) return;
            activeScoringRules = await Storage.getActiveScoringRules();
            scoringRulesDraftId = null;
            populateRulesForm(activeScoringRules);
            setRulesFeedback('Form reset to saved rules.', 'info');
            updateRulesPublishState();
            renderRulesPreview();
        }

        // Database Recovery Functions
        function generateSchemaSQL() {
            return `-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS user_joker_selections;
DROP TABLE IF EXISTS scoring_close_tiers;
DROP TABLE IF EXISTS scoring_rules;
DROP TABLE IF EXISTS usage_events;
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

-- Create single-row scoring rules table
CREATE TABLE scoring_rules (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    correct_result_points INTEGER NOT NULL DEFAULT 3,
    perfect_score_bonus INTEGER NOT NULL DEFAULT 3,
    draw_bonus INTEGER NOT NULL DEFAULT 2,
    max_jokers_per_user INTEGER NOT NULL DEFAULT 1,
    entry_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    payout_first_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    payout_second_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    payout_third_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    payout_closest_tries_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create close score tiers table
CREATE TABLE scoring_close_tiers (
    id SERIAL PRIMARY KEY,
    tier_order INTEGER NOT NULL CHECK (tier_order BETWEEN 1 AND 3),
    within_points INTEGER NOT NULL CHECK (within_points >= 0),
    bonus_points INTEGER NOT NULL CHECK (bonus_points >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tier_order)
);

-- Create multi-joker selections table
CREATE TABLE user_joker_selections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

-- Create usage events table
CREATE TABLE usage_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT
);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_usernames ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_close_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_joker_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your security needs)
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all access to predictions" ON predictions FOR ALL USING (true);
CREATE POLICY "Allow all access to matches" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all access to admin_usernames" ON admin_usernames FOR ALL USING (true);
CREATE POLICY "Allow all access to settings" ON settings FOR ALL USING (true);
CREATE POLICY "Allow all access to scoring_rules" ON scoring_rules FOR ALL USING (true);
CREATE POLICY "Allow all access to scoring_close_tiers" ON scoring_close_tiers FOR ALL USING (true);
CREATE POLICY "Allow all access to user_joker_selections" ON user_joker_selections FOR ALL USING (true);
CREATE POLICY "Allow all access to usage_events" ON usage_events FOR ALL USING (true);`;
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
            sql += `INSERT INTO settings (key, value) VALUES ('predictions_locked', '${appSettings.predictionsLocked}');\n`;

            // Generate scoring rules INSERT statement
            const rules = getEffectiveScoringRules();
            sql += '\n-- Insert scoring rules\n';
            sql += `INSERT INTO scoring_rules (id, correct_result_points, perfect_score_bonus, draw_bonus, max_jokers_per_user, entry_fee_amount, payout_first_pct, payout_second_pct, payout_third_pct, payout_closest_tries_pct, updated_at) VALUES (1, ${rules.correctResultPoints}, ${rules.perfectScoreBonus}, ${rules.drawBonus}, ${rules.maxJokersPerUser}, ${Number(rules.entryFeeAmount || 0)}, ${Number(rules.payoutFirstPct || 0)}, ${Number(rules.payoutSecondPct || 0)}, ${Number(rules.payoutThirdPct || 0)}, ${Number(rules.payoutClosestTriesPct || 0)}, NOW());\n`;

            // Generate close score tiers INSERT statements
            const closeTiers = (rules.closeTiers || []).slice(0, 3);
            if (closeTiers.length > 0) {
                sql += '\n-- Insert scoring close tiers\n';
                closeTiers.forEach((tier, index) => {
                    const tierOrder = Number.isInteger(tier.tierOrder) ? tier.tierOrder : (index + 1);
                    const withinPoints = Number.isFinite(tier.withinPoints) ? tier.withinPoints : 0;
                    const bonusPoints = Number.isFinite(tier.bonusPoints) ? tier.bonusPoints : 0;
                    sql += `INSERT INTO scoring_close_tiers (tier_order, within_points, bonus_points) VALUES (${tierOrder}, ${withinPoints}, ${bonusPoints});\n`;
                });
            }

            // Generate users INSERT statements
            const userList = Object.keys(users);
            if (userList.length > 0) {
                sql += '\n-- Insert users\n';
                userList.forEach((username, index) => {
                    const u = users[username];
                    const oderId = index + 1;
                    const supportedTeamsVal = u.supportedTeams && u.supportedTeams.length > 0 ? `'${esc(u.supportedTeams.join(','))}'` : 'NULL';
                    sql += `INSERT INTO users (id, username, nickname, password_hash, total_tries, supported_teams) VALUES (${oderId}, '${esc(username)}', '${esc(u.nickname)}', '${esc(u.passwordHash)}', ${u.totalTries === null || u.totalTries === undefined ? 'NULL' : u.totalTries}, ${supportedTeamsVal});\n`;
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

                // Generate multi-joker selections INSERT statements
                sql += '\n-- Insert user joker selections\n';
                userList.forEach((username, userIndex) => {
                    const userId = userIndex + 1;
                    const selectedJokers = getUserSelectedJokerMatchIds(username);
                    selectedJokers.forEach(matchId => {
                        sql += `INSERT INTO user_joker_selections (user_id, match_id) VALUES (${userId}, ${matchId});\n`;
                    });
                });

                // Reset the sequence for users table
                sql += '\n-- Reset sequences\n';
                sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n`;
                sql += `SELECT setval('predictions_id_seq', (SELECT MAX(id) FROM predictions));\n`;
                sql += `SELECT setval('admin_usernames_id_seq', (SELECT MAX(id) FROM admin_usernames));\n`;
                sql += `SELECT setval('settings_id_seq', (SELECT MAX(id) FROM settings));\n`;
                sql += `SELECT setval('scoring_close_tiers_id_seq', (SELECT MAX(id) FROM scoring_close_tiers));\n`;
                sql += `SELECT setval('user_joker_selections_id_seq', (SELECT MAX(id) FROM user_joker_selections));\n`;
            }

            if (usageEventsForRecovery.length > 0) {
                sql += '\n-- Insert usage events\n';
                usageEventsForRecovery.forEach(evt => {
                    const actor = esc(evt.actor || 'guest');
                    const action = esc(evt.action || '');
                    const payload = esc(evt.payload || '');
                    const createdAt = evt.created_at ? `'${esc(evt.created_at)}'` : 'NOW()';
                    sql += `INSERT INTO usage_events (created_at, actor, action, payload) VALUES (${createdAt}, '${actor}', '${action}', '${payload}');\n`;
                });
                sql += `SELECT setval('usage_events_id_seq', (SELECT MAX(id) FROM usage_events));\n`;
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
                    <li>Single scoring rules config, prize settings, and close-score tiers</li>
                    <li>User joker selections</li>
                    <li>Admin usernames list</li>
                    <li>App settings</li>
                    <li>Usage events</li>
                `;
            } else {
                description.textContent = 'This SQL will recreate empty tables only:';
                list.innerHTML = `
                    <li>Empty matches table</li>
                    <li>Empty users table</li>
                    <li>Empty predictions table</li>
                    <li>Empty scoring_rules (including prize fields) and scoring_close_tiers tables</li>
                    <li>Empty user_joker_selections table</li>
                    <li>Empty admin_usernames table</li>
                    <li>Empty settings table</li>
                    <li>Empty usage_events table</li>
                `;
            }
        }

        function renderRecoveryConnectionDetails() {
            const projectUrlEl = document.getElementById('recoveryProjectUrlPreview');
            const restEndpointEl = document.getElementById('recoveryRestEndpointPreview');
            const apiKeyEl = document.getElementById('recoveryApiKeyPreview');
            const connectionStringEl = document.getElementById('recoveryConnectionStringPreview');
            if (!projectUrlEl || !restEndpointEl || !apiKeyEl || !connectionStringEl) return;

            const cleanUrl = String(SUPABASE_URL || '').replace(/\/+$/, '');
            const urlMatch = cleanUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
            const projectRef = urlMatch ? urlMatch[1] : '';
            const connectionString = projectRef
                ? `postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`
                : 'postgresql://postgres:[YOUR_DB_PASSWORD]@db.<project-ref>.supabase.co:5432/postgres';

            projectUrlEl.textContent = cleanUrl || 'Not configured';
            restEndpointEl.textContent = cleanUrl ? `${cleanUrl}/rest/v1` : 'Not configured';
            apiKeyEl.textContent = SUPABASE_ANON_KEY || 'Not configured';
            connectionStringEl.textContent = connectionString;
        }

        async function initRecoveryTab() {
            renderRecoveryConnectionDetails();
            usageEventsForRecovery = await Storage.getUsageEvents(1000);
            // Display the SQL based on checkbox state
            updateRecoverySQL();
        }

        function formatUsageTimestamp(rawValue) {
            if (!rawValue) return '-';
            const date = new Date(rawValue);
            if (Number.isNaN(date.getTime())) return String(rawValue);
            return date.toLocaleString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }

        async function renderUsageReport() {
            const container = document.getElementById('usageReportContainer');
            if (!container) return;

            container.innerHTML = '<p style="opacity:0.8;">Loading usage events...</p>';
            usageReportEvents = await Storage.getUsageEvents(100);

            if (!usageReportEvents.length) {
                container.innerHTML = '<p style="opacity:0.8;">No usage events found.</p>';
                return;
            }

            const rowsHtml = usageReportEvents.map(evt => `
                <tr>
                    <td>${escapeHtml(formatUsageTimestamp(evt.created_at))}</td>
                    <td>${escapeHtml(evt.actor || '-')}</td>
                    <td>${escapeHtml(evt.action || '-')}</td>
                    <td>
                        <details class="usage-payload-details">
                            <summary>View payload</summary>
                            <pre class="usage-payload-pre">${escapeHtml(evt.payload || '')}</pre>
                        </details>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="usage-report-table-wrap">
                    <table class="admin-table usage-report-table">
                        <thead>
                            <tr>
                                <th style="width: 180px;">Timestamp</th>
                                <th style="width: 140px;">Actor</th>
                                <th style="width: 260px;">Action</th>
                                <th>Payload</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;
        }

        async function pruneUsageEventsKeepLatest() {
            if (!isCurrentUserAdmin()) return;
            if (!confirm('Remove all usage events older than the latest 100?')) return;

            const result = await Storage.deleteUsageEventsOlderThanLatest(100);
            alert(`Removed ${result.deletedCount} older usage event(s).`);
            await renderUsageReport();
        }

        async function clearAllUsageEvents() {
            if (!isCurrentUserAdmin()) return;
            if (!confirm('Remove all usage events? This cannot be undone.')) return;

            const ok = await Storage.clearUsageEvents();
            if (!ok) {
                alert('Failed to remove usage events.');
                return;
            }
            usageReportEvents = [];
            const container = document.getElementById('usageReportContainer');
            if (container) {
                container.innerHTML = '<p style="opacity:0.8;">No usage events found.</p>';
            }
            alert('All usage events removed.');
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
            document.getElementById('rulesTab').classList.add('hidden');
            document.getElementById('prizeFundTab').classList.add('hidden');
            document.getElementById('recoveryTab').classList.add('hidden');
            document.getElementById('usageReportTab').classList.add('hidden');

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
                renderAdminScoreCorrections();
            } else if (tabName === 'results') {
                if (!isCurrentUserAdmin()) return;
                document.getElementById('resultsTab').classList.remove('hidden');
                event.target.classList.add('active');
                updateLockToggleUI();
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
                activeScoringRules = await Storage.getActiveScoringRules();
                userJokerSelections = await Storage.getUserJokerSelections();
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
            const savedUsername = getRememberedUsername();
            if (savedUsername && users[savedUsername]) {
                currentUsername = savedUsername;
                trackUsage('user logs in', formatUsagePayload({ username: savedUsername, source: 'cookie_auto_login' }), savedUsername);
                showApp();
            } else if (savedUsername) {
                // Clean up stale remembered usernames that no longer exist.
                clearRememberedUsername();
            }
        });
