// Example data for taking the tour screenshots (dev only, see dev/tour-shots.sh). Injected into the page; it swaps the
// app's state for made-up people, matches, predictions and chat and stubs the database client so nothing real is read or written.
// ---- Example data: the tour never shows real results or people ----
let tourSaved = null;

function tourDemoData() {
    const year = selectedYear;
    const m = (id, round, date, time, t1, t2, s1, s2, tr1, tr2, joker) => ({ id, year, round, date, time, team1: t1, team2: t2, actualScore1: s1, actualScore2: s2, actualTries1: tr1, actualTries2: tr2, jokerEligible: joker });
    const demoMatches = [
        m(9001, 1, 'Thu, Feb 5', '20:10', 'France', 'Ireland', 36, 14, 5, 2, false),
        m(9002, 1, 'Sat, Feb 7', '14:10', 'Italy', 'Scotland', 18, 15, 2, 1, false),
        m(9003, 1, 'Sat, Feb 7', '16:40', 'England', 'Wales', 24, 19, 3, 2, true),
        m(9004, 2, 'Sat, Feb 14', '14:10', 'Ireland', 'Italy', 30, 12, 4, 1, false),
        m(9005, 2, 'Sat, Feb 14', '16:40', 'Scotland', 'England', null, null, null, null, true),
        m(9006, 2, 'Sun, Feb 15', '15:10', 'Wales', 'France', null, null, null, null, false)
    ];
    const preds = (list) => { const o = {}; list.forEach((p, i) => { if (p) o[9001 + i] = { team1: p[0], team2: p[1] }; }); return o; };
    const person = (id, nickname, teams, tries, list) => ({ id, nickname, totalTries: tries, supportedTeams: teams, predictions: preds(list) });
    const demoUsers = {
        demoalex: person(9101, 'Alex', ['France'], 24, [[30, 12], [20, 16], [22, 17], [28, 10], [18, 21], [14, 29]]),
        demobryn: person(9102, 'Bryn', ['Wales'], 31, [[25, 20], [15, 18], [20, 24], [32, 14], [19, 22], [16, 24]]),
        democara: person(9103, 'Cara', ['Scotland'], 27, [[34, 14], [12, 21], [26, 18], [24, 12], [21, 17], [10, 33]]),
        demodev: person(9104, 'Dev', ['Italy', 'England'], 29, [[22, 18], [18, 15], [18, 21], [27, 13], [20, 20], [12, 30]]),
        demoerin: person(9105, 'Erin', ['Ireland'], 22, [[28, 24], [24, 10], [23, 19], [20, 15], [16, 25], [9, 28]])
    };
    // The signed-in person appears as "You" with a half-finished card, so the predictions screen has something to show
    if (currentUsername && !isGuest) {
        demoUsers[currentUsername] = person(9100, 'You', [], 26, [[31, 13], [17, 14], [24, 19], [29, 11], null, null]);
    }
    const jokers = { demoalex: [9003], demobryn: [9005], democara: [9003], demodev: [9003], demoerin: [9005] };
    if (demoUsers[currentUsername]) jokers[currentUsername] = [9003];
    const at = (mins) => new Date(Date.now() - mins * 60000).toISOString();
    const chat = {
        available: true,
        comments: [
            { id: 1, match_id: 9001, user_id: 9102, target_user_id: null, body: 'What a start for France. Nobody saw that coming!', created_at: at(180) },
            { id: 2, match_id: 9001, user_id: 9104, target_user_id: null, body: 'Joker well spent. Thank you France.', created_at: at(95) },
            { id: 3, match_id: 9001, user_id: 9103, target_user_id: 9102, body: 'Bold pick, Bryn. Ireland by 5?', created_at: at(60) },
            { id: 4, match_id: 9002, user_id: 9105, target_user_id: null, body: 'Italy edge it. Table is wide open now.', created_at: at(1500) }
        ],
        reactions: [
            { id: 1, match_id: 9001, user_id: 9102, target_user_id: null, emoji: '🔥' }, { id: 2, match_id: 9001, user_id: 9103, target_user_id: null, emoji: '🔥' },
            { id: 3, match_id: 9001, user_id: 9104, target_user_id: null, emoji: '😱' }, { id: 4, match_id: 9002, user_id: 9101, target_user_id: null, emoji: '😱' },
            { id: 5, match_id: 9002, user_id: 9103, target_user_id: null, emoji: '😭' }, { id: 6, match_id: 9001, user_id: 9101, target_user_id: 9102, emoji: '😂' },
            { id: 7, match_id: 9003, user_id: 9105, target_user_id: 9104, emoji: '👏' }
        ]
    };
    // An invited person who has not signed in yet, and example sign-in accounts for the Competitors screen
    demoUsers.demoinvite = { id: 9106, nickname: null, totalTries: null, supportedTeams: [], predictions: {} };
    const emails = { demoalex: 'alex@example.com', demobryn: 'bryn@example.com', democara: 'cara@example.com', demodev: 'dev@example.com', demoerin: 'erin@example.com', demoinvite: 'newplayer@example.com' };
    const emails2 = { demodev: 'dev.home@example.com' };
    const accounts = [
        { auth_user_id: 'demo-a1', email: 'alex@example.com', linked_username: 'demoalex' },
        { auth_user_id: 'demo-a2', email: 'bryn@example.com', linked_username: 'demobryn' },
        { auth_user_id: 'demo-a3', email: 'cara@example.com', linked_username: 'democara' },
        { auth_user_id: 'demo-a4', email: 'dev@example.com', linked_username: 'demodev' },
        { auth_user_id: 'demo-a5', email: 'dev.home@example.com', linked_username: 'demodev' },
        { auth_user_id: 'demo-a6', email: 'erin@example.com', linked_username: 'demoerin' }
    ];
    return { demoMatches, demoUsers, jokers, chat, emails, emails2, accounts };
}

function enterTourDemo() {
    tourSaved = {
        users, matches: matches.slice(), allMatches, appSettings, activeScoringRules, userJokerSelections, fixtureChat,
        from: supabaseClient.from, rpc: supabaseClient.rpc,
        authAccounts, authAccountsLoaded, competitorEmails, competitorEmails2, adminUsernames,
        getSeasonCounts: Storage.getSeasonCounts
    };
    const demo = tourDemoData();
    tourDemoActive = true;
    users = demo.demoUsers;
    matches.splice(0, matches.length, ...demo.demoMatches);
    allMatches = demo.demoMatches.slice();
    appSettings = { ...appSettings, predictionsLocked: false, activeOverrides: {} };
    // The scoring rules (and prize split) stay the real ones: only people, matches, predictions and chat are examples
    userJokerSelections = demo.jokers;
    fixtureChat = demo.chat;
    // Admin screens: example sign-in accounts, emails, admins, year counts (no real addresses)
    authAccounts = demo.accounts;
    authAccountsLoaded = true;
    competitorEmails = demo.emails;
    competitorEmails2 = demo.emails2;
    adminUsernames = [currentUsername, 'demoalex'].filter(Boolean);
    Storage.getSeasonCounts = async () => ({ predictions: 30, tries: 5, competitors: 5, results: 4 });
    // Nothing the tour touches may reach the database
    const quiet = () => {
        const builder = { then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject) };
        ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle'].forEach(name => { builder[name] = () => builder; });
        return builder;
    };
    supabaseClient.from = quiet;
    supabaseClient.rpc = async (name) => {
        if (name === 'admin_list_accounts') return { data: demo.accounts, error: null };
        if (name === 'admin_list_competitor_emails') {
            return { data: Object.keys(demo.emails).map(username => ({ username, email: demo.emails[username], email2: demo.emails2[username] || null })), error: null };
        }
        return { data: null, error: null };
    };
    tourRerenderCurrentScreen();
}

function leaveTourDemo() {
    if (!tourDemoActive || !tourSaved) return;
    closeFixtureChat();
    supabaseClient.from = tourSaved.from;
    supabaseClient.rpc = tourSaved.rpc;
    users = tourSaved.users;
    matches.splice(0, matches.length, ...tourSaved.matches);
    allMatches = tourSaved.allMatches;
    appSettings = tourSaved.appSettings;
    activeScoringRules = tourSaved.activeScoringRules;
    userJokerSelections = tourSaved.userJokerSelections;
    fixtureChat = tourSaved.fixtureChat;
    authAccounts = tourSaved.authAccounts;
    authAccountsLoaded = tourSaved.authAccountsLoaded;
    competitorEmails = tourSaved.competitorEmails;
    competitorEmails2 = tourSaved.competitorEmails2;
    adminUsernames = tourSaved.adminUsernames;
    Storage.getSeasonCounts = tourSaved.getSeasonCounts;
    tourSaved = null;
    tourDemoActive = false;
}

function tourRerenderCurrentScreen() {
    const summary = document.getElementById('summaryTab');
    const predictions = document.getElementById('predictionsTab');
    if (summary && !summary.classList.contains('hidden')) showSummary();
    if (predictions && !predictions.classList.contains('hidden')) { renderMatches(); loadPredictions(); }
}

// The summary table scrolls sideways under its sticky rank, name and score columns. Pick a chat chip that is
