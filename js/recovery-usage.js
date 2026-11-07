// Recovery SQL, usage report, clipboard
// Classic script (shared global scope); load order is set in index.html.

        // Database Recovery Functions
        function generateSchemaSQL() {
            return `-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS user_tries;
DROP TABLE IF EXISTS seasons;
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
    total_tries INTEGER,
    supported_teams VARCHAR(255),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create seasons table (years in the year dropdown)
CREATE TABLE seasons (
    year INTEGER PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE matches (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL DEFAULT 2026,
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

-- Create tournament tries per competitor per year
CREATE TABLE user_tries (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_tries INTEGER,
    PRIMARY KEY (user_id, year)
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

-- Create scoring rules table (one row per year)
CREATE TABLE scoring_rules (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL DEFAULT 2026 UNIQUE,
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
    year INTEGER NOT NULL DEFAULT 2026,
    tier_order INTEGER NOT NULL CHECK (tier_order BETWEEN 1 AND 3),
    within_points INTEGER NOT NULL CHECK (within_points >= 0),
    bonus_points INTEGER NOT NULL CHECK (bonus_points >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(year, tier_order)
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

-- Row Level Security, auth policies and helper functions live in supabase/auth_migration.sql
-- and supabase/years_migration.sql. Run both, in that order, after restoring (they are
-- idempotent). Until then the tables are locked down.
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_usernames ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_close_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_joker_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;`;
        }

        // Raw copy of every table (all years), fetched when the recovery tab opens
        let recoverySnapshot = null;

        async function fetchRecoverySnapshot() {
            const tables = {
                seasons: '*',
                matches: '*',
                users: 'id, username, nickname, supported_teams, created_at',
                user_tries: '*',
                predictions: '*',
                admin_usernames: '*',
                settings: '*',
                scoring_rules: '*',
                scoring_close_tiers: '*',
                user_joker_selections: '*'
            };
            const snapshot = {};
            for (const [table, columns] of Object.entries(tables)) {
                const { data, error } = await supabaseClient.from(table).select(columns);
                if (error) {
                    console.error(`Error fetching ${table} for recovery:`, error);
                    snapshot[table] = [];
                } else {
                    snapshot[table] = data || [];
                }
            }
            return snapshot;
        }

        function generateDataSQL() {
            const snapshot = recoverySnapshot || {};

            // Helper to escape single quotes in SQL strings
            const esc = (str) => str ? String(str).replace(/'/g, "''") : '';
            const sqlValue = (value) => {
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'number') return String(value);
                if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
                return `'${esc(value)}'`;
            };
            const insertRows = (title, table, columns) => {
                const rows = snapshot[table] || [];
                if (rows.length === 0) return '';
                let out = `\n-- Insert ${title}\n`;
                rows.forEach(row => {
                    out += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(c => sqlValue(row[c])).join(', ')});\n`;
                });
                return out;
            };

            let sql = '';
            sql += insertRows('seasons', 'seasons', ['year']);
            sql += insertRows('matches (all years)', 'matches', ['id', 'year', 'round', 'date', 'time', 'team1', 'team2', 'actual_score1', 'actual_score2', 'actual_tries1', 'actual_tries2', 'joker_eligible']);
            sql += insertRows('users', 'users', ['id', 'username', 'nickname', 'supported_teams']);
            sql += insertRows('tournament tries per year', 'user_tries', ['user_id', 'year', 'total_tries']);
            sql += insertRows('predictions (all years)', 'predictions', ['user_id', 'match_id', 'team1_score', 'team2_score']);
            sql += insertRows('user joker selections', 'user_joker_selections', ['user_id', 'match_id']);
            sql += insertRows('admin usernames', 'admin_usernames', ['username']);
            sql += insertRows('settings (including per-year prediction locks)', 'settings', ['key', 'value']);
            sql += insertRows('scoring rules (one row per year)', 'scoring_rules', ['id', 'year', 'correct_result_points', 'perfect_score_bonus', 'draw_bonus', 'max_jokers_per_user', 'entry_fee_amount', 'payout_first_pct', 'payout_second_pct', 'payout_third_pct', 'payout_closest_tries_pct']);
            sql += insertRows('scoring close tiers', 'scoring_close_tiers', ['year', 'tier_order', 'within_points', 'bonus_points']);

            // Reset sequences so new rows get fresh ids.
            if ((snapshot.users || []).length > 0) {
                sql += '\n-- Reset sequences\n';
                sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n`;
                sql += `SELECT setval('predictions_id_seq', (SELECT MAX(id) FROM predictions));\n`;
                sql += `SELECT setval('admin_usernames_id_seq', (SELECT MAX(id) FROM admin_usernames));\n`;
                sql += `SELECT setval('settings_id_seq', (SELECT MAX(id) FROM settings));\n`;
                sql += `SELECT setval('scoring_close_tiers_id_seq', (SELECT MAX(id) FROM scoring_close_tiers));\n`;
                sql += `SELECT setval('user_joker_selections_id_seq', (SELECT MAX(id) FROM user_joker_selections));\n`;
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
                    <li>The list of years, with fixtures and results for every year</li>
                    <li>All competitors (usernames, display names; sign-in account links are re-created by an admin)</li>
                    <li>All predictions and tournament tries predictions, for every year</li>
                    <li>Scoring rules, prize settings and close-score tiers, for every year</li>
                    <li>User joker selections</li>
                    <li>Admin usernames list</li>
                    <li>App settings (including the prediction lock for each year)</li>
                `;
            } else {
                description.textContent = 'This SQL will recreate empty tables only:';
                list.innerHTML = `
                    <li>Empty seasons and matches tables</li>
                    <li>Empty users table</li>
                    <li>Empty predictions and user_tries tables</li>
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
            recoverySnapshot = await fetchRecoverySnapshot();
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

        function renderUsageReportTable() {
            const container = document.getElementById('usageReportContainer');
            if (!container) return;

            if (!usageReportEvents.length) {
                container.innerHTML = '<p style="opacity:0.8;">No usage events found.</p>';
                return;
            }

            const visibleEvents = usageReportHideLogins
                ? usageReportEvents.filter(evt => !String(evt.action || '').toLowerCase().includes('logs in'))
                : usageReportEvents;

            const filterControlsHtml = `
                <div style="display:flex; justify-content:flex-end; margin-bottom:0.75rem;">
                    <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.9rem; opacity:0.9;">
                        <input type="checkbox" id="usageHideLoginsToggle" ${usageReportHideLogins ? 'checked' : ''}>
                        Hide login events
                    </label>
                </div>
            `;

            if (!visibleEvents.length) {
                container.innerHTML = `
                    ${filterControlsHtml}
                    <p style="opacity:0.8;">No usage events match the current filter.</p>
                `;
                const emptyToggle = document.getElementById('usageHideLoginsToggle');
                if (emptyToggle) {
                    emptyToggle.onchange = (event) => {
                        usageReportHideLogins = !!event.target.checked;
                        renderUsageReportTable();
                    };
                }
                return;
            }

            const rowsHtml = visibleEvents.map(evt => `
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
                ${filterControlsHtml}
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
            const toggle = document.getElementById('usageHideLoginsToggle');
            if (toggle) {
                toggle.onchange = (event) => {
                    usageReportHideLogins = !!event.target.checked;
                    renderUsageReportTable();
                };
            }
        }

        async function renderUsageReport() {
            const container = document.getElementById('usageReportContainer');
            if (!container) return;

            container.innerHTML = '<p style="opacity:0.8;">Loading usage events...</p>';
            usageReportEvents = await Storage.getUsageEvents(100);
            renderUsageReportTable();
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
