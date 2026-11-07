// Fixtures, flags and team helpers
// Classic script (shared global scope); load order is set in index.html.
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
        const DEFAULT_FIXTURES = matches.map(m => ({ ...m, year: 2026 }));
        let stattoFactIndex = null;
        let trevsTipsLoadout = null;

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

        function getAiCrowdAside() {
            return pickRandomItem([
                'boo, hiss!',
                'down with the robot overlords!',
                'not in my clubhouse!'
            ]);
        }

        function formatAiDisplayName(displayName, aside = '') {
            const chosenAside = aside || getAiCrowdAside();
            return `${displayName} (${chosenAside})`;
        }

        function boldPlayerName(displayName) {
            return `<strong>${displayName}</strong>`;
        }

        function getStattoDisplayName(username) {
            const displayName = getDisplayName(username);
            const narrativeName = isAiPlayer(username) ? formatAiDisplayName(displayName) : displayName;
            return boldPlayerName(narrativeName);
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
