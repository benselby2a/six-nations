// Supabase client and the Storage persistence boundary
// Classic script (shared global scope); load order is set in index.html.

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
                const yearMatchIds = new Set(matches.map(m => m.id));
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('id, username, nickname, supported_teams');
                
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
                        id: user.id,
                        nickname: (user.nickname === null || user.nickname === undefined) ? user.nickname : cleanDisplayText(user.nickname),
                        totalTries: null,  // Per-year, filled in from user_tries below
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
                        if (username && usersObj[username] && yearMatchIds.has(pred.match_id)) {
                            usersObj[username].predictions[pred.match_id] = {
                                team1: pred.team1_score,
                                team2: pred.team2_score
                            };
                        }
                    });
                }

                // Tournament tries are stored per competitor per year
                const { data: triesRows, error: triesError } = await supabaseClient
                    .from('user_tries')
                    .select('user_id, total_tries')
                    .eq('year', selectedYear);
                if (triesError) {
                    console.error('Error fetching user tries:', triesError);
                } else {
                    const idToUsername = {};
                    data.forEach(user => {
                        idToUsername[user.id] = (user.username || '').trim().toLowerCase();
                    });
                    (triesRows || []).forEach(row => {
                        const username = idToUsername[row.user_id];
                        if (username && usersObj[username]) {
                            usersObj[username].totalTries = row.total_tries;
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
                await Storage.updateActiveOverrideUsername(oldUsername, newUsername);
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
                
                // Tournament tries are stored per year
                const { error: totalTriesError } = await supabaseClient
                    .from('user_tries')
                    .upsert({
                        user_id: user.id,
                        year: selectedYear,
                        total_tries: totalTries === undefined ? null : totalTries
                    }, { onConflict: 'user_id,year' });
                if (totalTriesError) {
                    console.error('Error updating total tries:', totalTriesError);
                    return;
                }

                // Replace the stored predictions for this user in the selected year only, so
                // cleared rows are persisted as deletions and other years are never touched.
                const yearMatchIds = matches.map(m => m.id);
                if (yearMatchIds.length > 0) {
                    const { error: deleteError } = await supabaseClient
                        .from('predictions')
                        .delete()
                        .eq('user_id', user.id)
                        .in('match_id', yearMatchIds);
                    if (deleteError) {
                        console.error('Error clearing existing predictions:', deleteError);
                        return;
                    }
                }

                const yearMatchIdSet = new Set(yearMatchIds);
                const predictionRows = Object.entries(predictions || {})
                    .filter(([matchId]) => yearMatchIdSet.has(parseInt(matchId, 10)))
                    .map(([matchId, pred]) => ({
                        user_id: user.id,
                        match_id: parseInt(matchId, 10),
                        team1_score: pred.team1,
                        team2_score: pred.team2,
                        updated_at: new Date().toISOString()
                    }));

                if (predictionRows.length === 0) {
                    trackUsage('save predictions', formatUsagePayload({
                        username,
                        year: selectedYear,
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
                    year: selectedYear,
                    predictions: predictions || {},
                    totalTries
                }), username);
            },
            
            // Match Summary chat (comments and emoji reactions on fixtures and predictions)
            getFixtureChat: async (matchIds) => {
                if (!matchIds || matchIds.length === 0) return { available: true, comments: [], reactions: [] };
                const [comments, reactions] = await Promise.all([
                    supabaseClient.from('fixture_comments').select('*').in('match_id', matchIds).order('created_at'),
                    supabaseClient.from('fixture_reactions').select('*').in('match_id', matchIds)
                ]);
                if (comments.error || reactions.error) {
                    // Normally the chat tables have not been created yet (fixture_chat_migration.sql): hide the feature
                    return { available: false, comments: [], reactions: [] };
                }
                return { available: true, comments: comments.data || [], reactions: reactions.data || [] };
            },
            addFixtureComment: async (row) => {
                const { error } = await supabaseClient.from('fixture_comments').insert(row);
                return error;
            },
            deleteFixtureComment: async (id) => {
                const { error } = await supabaseClient.from('fixture_comments').delete().eq('id', id);
                return error;
            },
            addFixtureReaction: async (row) => {
                const { error } = await supabaseClient.from('fixture_reactions').insert(row);
                return error;
            },
            deleteFixtureReaction: async (id) => {
                const { error } = await supabaseClient.from('fixture_reactions').delete().eq('id', id);
                return error;
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
                await Storage.updateActiveOverrideUsername(username, null);
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
                    year: m.year || 2026,
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

            // Years available in the year dropdown
            getSeasons: async () => {
                const { data, error } = await supabaseClient
                    .from('seasons')
                    .select('year')
                    .order('year', { ascending: true });
                if (error) {
                    console.error('Error fetching seasons:', error);
                    return [];
                }
                return (data || []).map(row => row.year);
            },

            // Add a year, copying scoring/prize rules from another year when given
            addSeason: async (year, copyRulesFromYear = null) => {
                const { error } = await supabaseClient.from('seasons').insert({ year });
                if (error) {
                    console.error('Error adding season:', error);
                    return false;
                }

                if (copyRulesFromYear) {
                    const { data: rule } = await supabaseClient
                        .from('scoring_rules')
                        .select('*')
                        .eq('year', copyRulesFromYear)
                        .maybeSingle();
                    if (rule) {
                        const { error: ruleError } = await supabaseClient
                            .from('scoring_rules')
                            .insert({ ...rule, id: year, year, updated_at: new Date().toISOString() });
                        if (ruleError) console.error('Error copying scoring rules to new year:', ruleError);

                        const { data: tiers } = await supabaseClient
                            .from('scoring_close_tiers')
                            .select('tier_order, within_points, bonus_points')
                            .eq('year', copyRulesFromYear);
                        if (tiers && tiers.length > 0) {
                            const { error: tierError } = await supabaseClient
                                .from('scoring_close_tiers')
                                .insert(tiers.map(t => ({ ...t, year })));
                            if (tierError) console.error('Error copying close tiers to new year:', tierError);
                        }
                    }
                }

                trackUsage('add year', formatUsagePayload({ year, copyRulesFromYear }));
                return true;
            },

            // How much data belongs to a year (for the remove confirmation)
            getSeasonCounts: async (year) => {
                const { data: matchRows } = await supabaseClient
                    .from('matches')
                    .select('id, actual_score1, actual_score2')
                    .eq('year', year);
                const matchIds = (matchRows || []).map(row => row.id);
                const results = (matchRows || []).filter(row =>
                    (row.actual_score1 !== null && row.actual_score1 !== undefined) ||
                    (row.actual_score2 !== null && row.actual_score2 !== undefined)
                ).length;
                let predictionRows = [];
                if (matchIds.length > 0) {
                    const { data } = await supabaseClient.from('predictions').select('user_id').in('match_id', matchIds);
                    predictionRows = data || [];
                }
                const { data: triesRows } = await supabaseClient
                    .from('user_tries')
                    .select('user_id, total_tries')
                    .eq('year', year);
                const tries = (triesRows || []).filter(row => row.total_tries !== null && row.total_tries !== undefined).length;
                return {
                    matches: matchIds.length,
                    results,
                    predictions: predictionRows.length,
                    tries,
                    competitors: new Set(predictionRows.map(row => row.user_id)).size
                };
            },

            // Clear every competitor's predictions, jokers and tries for a year (fixtures are kept)
            clearSeasonPredictions: async (year) => {
                const counts = await Storage.getSeasonCounts(year);
                if (counts.results > 0) {
                    console.error(`Refusing to clear ${year}: it has results entered.`);
                    return false;
                }

                const { data: matchRows, error: matchReadError } = await supabaseClient
                    .from('matches')
                    .select('id')
                    .eq('year', year);
                if (matchReadError) {
                    console.error('Error reading fixtures before clearing predictions:', matchReadError);
                    return false;
                }
                const matchIds = (matchRows || []).map(row => row.id);

                const steps = [];
                if (matchIds.length > 0) {
                    steps.push(['predictions', () => supabaseClient.from('predictions').delete().in('match_id', matchIds)]);
                    steps.push(['user_joker_selections', () => supabaseClient.from('user_joker_selections').delete().in('match_id', matchIds)]);
                }
                steps.push(['user_tries', () => supabaseClient.from('user_tries').delete().eq('year', year)]);

                for (const [table, run] of steps) {
                    const { error } = await run();
                    if (error) {
                        console.error(`Error clearing ${year} ${table}:`, error);
                        return false;
                    }
                }

                trackUsage('clear year predictions', formatUsagePayload({ year }));
                return true;
            },

            // Delete a year and everything that belongs to it. Competitors are kept.
            removeSeason: async (year) => {
                const counts = await Storage.getSeasonCounts(year);
                if (counts.results > 0) {
                    console.error(`Refusing to remove ${year}: it has results entered.`);
                    return false;
                }
                if (counts.predictions > 0 || counts.tries > 0) {
                    console.error(`Refusing to remove ${year}: it still has predictions.`);
                    return false;
                }

                const { data: matchRows, error: matchReadError } = await supabaseClient
                    .from('matches')
                    .select('id')
                    .eq('year', year);
                if (matchReadError) {
                    console.error('Error reading fixtures before removing year:', matchReadError);
                    return false;
                }
                const matchIds = (matchRows || []).map(row => row.id);

                const steps = [];
                if (matchIds.length > 0) {
                    steps.push(['predictions', () => supabaseClient.from('predictions').delete().in('match_id', matchIds)]);
                    steps.push(['user_joker_selections', () => supabaseClient.from('user_joker_selections').delete().in('match_id', matchIds)]);
                    steps.push(['matches', () => supabaseClient.from('matches').delete().eq('year', year)]);
                }
                steps.push(['user_tries', () => supabaseClient.from('user_tries').delete().eq('year', year)]);
                steps.push(['scoring_close_tiers', () => supabaseClient.from('scoring_close_tiers').delete().eq('year', year)]);
                steps.push(['scoring_rules', () => supabaseClient.from('scoring_rules').delete().eq('year', year)]);
                steps.push(['settings', () => supabaseClient.from('settings').delete().in('key', [
                    `predictions_locked:${year}`,
                    `rules_saved:${year}`,
                    `prize_saved:${year}`,
                    `active_overrides:${year}`
                ])]);
                steps.push(['seasons', () => supabaseClient.from('seasons').delete().eq('year', year)]);

                for (const [table, run] of steps) {
                    const { error } = await run();
                    if (error) {
                        console.error(`Error removing ${year} from ${table}:`, error);
                        return false;
                    }
                }

                trackUsage('remove year', formatUsagePayload({ year, fixtures: matchIds.length }));
                return true;
            },

            saveMatches: async (matchesData, options = {}) => {
                // Keep the all-years cache in step with the selected year's fixtures
                allMatches = allMatches
                    .filter(m => m.year !== selectedYear)
                    .concat(matchesData.map(m => ({ ...m, year: selectedYear })));

                const rows = matchesData.map(m => ({
                    id: m.id,
                    year: selectedYear,
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

                const { data: existingMatches, error: existingError } = await supabaseClient
                    .from('matches')
                    .select('id')
                    .eq('year', selectedYear);
                if (existingError) {
                    console.error('Error reading existing matches before save:', existingError);
                    return;
                }

                const incomingIds = new Set(rows.map(row => row.id));
                const idsToDelete = (existingMatches || [])
                    .map(row => row.id)
                    .filter(id => !incomingIds.has(id));

                if (idsToDelete.length > 0) {
                    const { error: deleteError } = await supabaseClient
                        .from('matches')
                        .delete()
                        .in('id', idsToDelete);
                    if (deleteError) {
                        console.error('Error deleting removed matches:', deleteError);
                        return;
                    }
                }

                if (rows.length > 0) {
                    const { error: upsertError } = await supabaseClient
                        .from('matches')
                        .upsert(rows, { onConflict: 'id' });
                    if (upsertError) {
                        console.error('Error saving matches:', upsertError);
                        return;
                    }
                }
                if (!options || !options.skipUsageLog) {
                    await Storage.trackUsageEvent(getUsageActor(), 'save fixtures', formatUsagePayload({ matchesData: matchesData || [] }));
                }
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
                const normalized = [...new Set(
                    (usernames || [])
                        .map(username => (username || '').trim().toLowerCase())
                        .filter(Boolean)
                )];

                // Diff against the stored list rather than clearing it: RLS ties admin
                // rights to this table, so emptying it mid-save would lock the admin out.
                const { data: existingRows, error: readError } = await supabaseClient
                    .from('admin_usernames')
                    .select('username');
                if (readError) {
                    console.error('Error reading admin usernames before save:', readError);
                    return;
                }

                const existing = new Set((existingRows || []).map(row => (row.username || '').trim().toLowerCase()));
                const toAdd = normalized.filter(username => !existing.has(username));
                const toRemove = [...existing].filter(username => !normalized.includes(username));

                if (toAdd.length > 0) {
                    const { error } = await supabaseClient
                        .from('admin_usernames')
                        .insert(toAdd.map(username => ({ username })));
                    if (error) {
                        console.error('Error saving admin usernames:', error);
                        return;
                    }
                }

                if (toRemove.length > 0) {
                    const { error } = await supabaseClient
                        .from('admin_usernames')
                        .delete()
                        .in('username', toRemove);
                    if (error) {
                        console.error('Error removing admin usernames:', error);
                        return;
                    }
                }

                trackUsage('save admin usernames', formatUsagePayload({ usernames: normalized }));
            },

            // App settings
            getSettings: async () => {
                const { data, error } = await supabaseClient
                    .from('settings')
                    .select('*');
                
                if (error || !data || data.length === 0) {
                    return { predictionsLocked: false };
                }
                
                const settings = { predictionsLocked: false, rulesSavedAt: null, prizeSavedAt: null, activeOverrides: {} };
                const lockKey = `predictions_locked:${selectedYear}`;
                data.forEach(row => {
                    if (row.key === lockKey) {
                        settings.predictionsLocked = row.value === 'true' || row.value === true;
                    } else if (row.key === `rules_saved:${selectedYear}`) {
                        settings.rulesSavedAt = row.value || null;
                    } else if (row.key === `prize_saved:${selectedYear}`) {
                        settings.prizeSavedAt = row.value || null;
                    } else if (row.key === `active_overrides:${selectedYear}`) {
                        try {
                            const parsed = JSON.parse(row.value || '{}');
                            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) settings.activeOverrides = parsed;
                        } catch (error) {
                            console.error('Could not read active competitor overrides:', error);
                        }
                    }
                });
                
                return settings;
            },
            
            // Record that the admin saved the Guesser Rules or Prize Fund for the selected year.
            // (A new year's rules are copied forward, so a stored row alone does not mean they were reviewed.)
            markSettingsSaved: async (kind) => {
                if (kind !== 'rules' && kind !== 'prize') return null;
                const savedAt = new Date().toISOString();
                const { error } = await supabaseClient
                    .from('settings')
                    .upsert({ key: `${kind}_saved:${selectedYear}`, value: savedAt }, { onConflict: 'key' });
                if (error) {
                    console.error(`Error recording ${kind} saved:`, error);
                    return null;
                }
                return savedAt;
            },

            // Which competitors are playing in the selected year: { username: true|false }.
            // Anyone not listed counts as playing if they have predictions that year.
            saveActiveOverrides: async (overrides) => {
                const { error } = await supabaseClient
                    .from('settings')
                    .upsert({ key: `active_overrides:${selectedYear}`, value: JSON.stringify(overrides || {}) }, { onConflict: 'key' });
                if (error) {
                    console.error('Error saving active competitors:', error);
                    return false;
                }
                return true;
            },

            // Rewrite (or drop, when newUsername is null) a competitor's entry in every year's overrides
            updateActiveOverrideUsername: async (oldUsername, newUsername) => {
                const { data, error } = await supabaseClient
                    .from('settings')
                    .select('key, value')
                    .like('key', 'active_overrides:%');
                if (error) {
                    console.error('Error reading active competitor overrides:', error);
                    return;
                }
                for (const row of data || []) {
                    let parsed;
                    try { parsed = JSON.parse(row.value || '{}'); } catch (e) { continue; }
                    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, oldUsername)) continue;
                    const value = parsed[oldUsername];
                    delete parsed[oldUsername];
                    if (newUsername) parsed[newUsername] = value;
                    const { error: saveError } = await supabaseClient
                        .from('settings')
                        .upsert({ key: row.key, value: JSON.stringify(parsed) }, { onConflict: 'key' });
                    if (saveError) console.error('Error updating active competitor overrides:', saveError);
                }
            },

            saveSettings: async (settings) => {
                const { error } = await supabaseClient
                    .from('settings')
                    .upsert({
                        key: `predictions_locked:${selectedYear}`,
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
                    .eq('year', selectedYear)
                    .maybeSingle();

                if (rulesError || !rule) {
                    if (rulesError) console.error('Error fetching scoring rules:', rulesError);
                    return fallback;
                }

                const { data: tierRows, error: tiersError } = await supabaseClient
                    .from('scoring_close_tiers')
                    .select('*')
                    .eq('year', selectedYear)
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

                const yearMatchIds = new Set(matches.map(m => m.id));
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
                    if (!username || !yearMatchIds.has(row.match_id)) return;
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
                const { data: existingRule } = await supabaseClient
                    .from('scoring_rules')
                    .select('id')
                    .eq('year', selectedYear)
                    .maybeSingle();
                const normalized = {
                    id: existingRule ? existingRule.id : selectedYear,
                    year: selectedYear,
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
                    .eq('year', selectedYear);
                if (deleteTiersError) {
                    console.error('Error clearing existing scoring close tiers:', deleteTiersError);
                    return null;
                }

                const normalizedTiers = ((rules && rules.closeTiers) || [])
                    .map((tier, index) => ({
                        tier_order: Math.min(3, Math.max(1, parseInt(tier && tier.tierOrder, 10) || index + 1)),
                        within_points: Math.max(0, parseInt(tier && tier.withinPoints, 10) || 0),
                        bonus_points: Math.max(0, parseInt(tier && tier.bonusPoints, 10) || 0),
                        year: selectedYear
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

                const uniqueMatchIds = [...new Set((matchIds || [])
                    .map(id => parseInt(id, 10))
                    .filter(id => Number.isInteger(id) && id > 0))]
                    .sort((a, b) => a - b);

                const yearMatchIds = matches.map(m => m.id);
                const { data: existingRows, error: existingError } = await supabaseClient
                    .from('user_joker_selections')
                    .select('match_id')
                    .eq('user_id', user.id)
                    .in('match_id', yearMatchIds);
                if (existingError) {
                    console.error('Error reading existing joker selections:', existingError);
                    return false;
                }

                const existingMatchIds = new Set((existingRows || [])
                    .map(row => parseInt(row.match_id, 10))
                    .filter(id => Number.isInteger(id) && id > 0));
                const desiredMatchIds = new Set(uniqueMatchIds);
                const matchIdsToInsert = uniqueMatchIds.filter(matchId => !existingMatchIds.has(matchId));
                const matchIdsToDelete = Array.from(existingMatchIds).filter(matchId => !desiredMatchIds.has(matchId));

                if (matchIdsToInsert.length > 0) {
                    const rows = matchIdsToInsert.map(matchId => ({
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
                }

                if (uniqueMatchIds.length === 0) {
                    if (existingMatchIds.size > 0) {
                        const { error: deleteAllError } = await supabaseClient
                            .from('user_joker_selections')
                            .delete()
                            .eq('user_id', user.id)
                            .in('match_id', yearMatchIds);
                        if (deleteAllError) {
                            console.error('Error clearing existing joker selections:', deleteAllError);
                            return false;
                        }
                    }
                    trackUsage('save joker selections', formatUsagePayload({ username: normalizedUsername, matchIds: [] }), normalizedUsername);
                    return true;
                }

                if (matchIdsToDelete.length > 0) {
                    const { error: deleteError } = await supabaseClient
                        .from('user_joker_selections')
                        .delete()
                        .eq('user_id', user.id)
                        .in('match_id', matchIdsToDelete);
                    if (deleteError) {
                        console.error('Error deleting removed joker selections:', deleteError);
                        return false;
                    }
                }

                trackUsage('save joker selections', formatUsagePayload({ username: normalizedUsername, matchIds: uniqueMatchIds }), normalizedUsername);
                return true;
            }
        };
