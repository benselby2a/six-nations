// Summary screen
// Classic script (shared global scope); load order is set in index.html.

        // Show comprehensive summary with matches as columns
        // What the summary shows depends on all of this; if none of it changed since the last render, a refresh need not redraw it
        let lastSummarySignature = null;
        function summarySignature() {
            try {
                return JSON.stringify([selectedYear, matches, users, appSettings, userJokerSelections, activeScoringRules, currentFilter, selectedRound, currentUsername, isGuest, summaryViewMode, [...matchHighlightsFor(summaryViewMode)]]);
            } catch (e) { return null; }
        }
        function showSummary() {
            renderSummaryNow();
            lastSummarySignature = summarySignature();
        }
        // Redraw only when something changed (no flicker, no lost scroll position on a refresh that found nothing new)
        function showSummaryIfChanged() {
            const sig = summarySignature();
            if (sig !== null && sig === lastSummarySignature && document.querySelector('#summaryContainer .summary-table, #summaryContainer .signed-up-panel')) return false;
            showSummary();
            return true;
        }

        // As time passes the match in play / next match changes by itself: once a minute, and when the app comes back to the front,
        // redraw (keeping the reader's place) if that moved. The signature includes the highlighted match, so nothing else redraws.
        function refreshMatchHighlight() {
            if (document.visibilityState !== 'visible') return;
            if (typeof summaryTabIsShowing === 'function' && !summaryTabIsShowing()) return;
            if (summaryViewMode !== 'compact' && summaryViewMode !== 'simple') return;
            const box = document.querySelector('.summary-container');
            const left = box ? box.scrollLeft : 0;
            const top = window.scrollY;
            if (!showSummaryIfChanged()) return;
            const newBox = document.querySelector('.summary-container');
            if (newBox) newBox.scrollLeft = left;
            window.scrollTo(window.scrollX, top);
        }
        setInterval(refreshMatchHighlight, 60 * 1000);
        document.addEventListener('visibilitychange', refreshMatchHighlight);

        // Focus view: a team abbreviation in the same colour Classic uses for that team's name (PDF_SCHEMES in js/pdf-view.js is the single source of
        // the colours: light and dark are both written as CSS variables, so switching the theme needs no redraw). A team with no colour, such as one
        // from another tournament, keeps the plain heading colour.
        // Jumbo's light-theme header bar is green, where Classic's team colours are too dark to read: each team uses a lighter shade of its own colour there (contrast on the bar: England 6.7, France 4.1, Ireland 5.1, Italy 4.7, Scotland 4.7, Wales 4.3). The dark theme keeps Classic's colours.
        const JUMBO_LIGHT_BAR_TEAMS = { England: [255, 255, 255], France: [170, 205, 255], Ireland: [165, 240, 190], Italy: [140, 228, 250], Scotland: [225, 208, 255], Wales: [255, 190, 190] };
        function simpleTeamSpan(team) {
            const abbr = getTeamAbbr(team);
            const light = typeof PDF_SCHEMES !== 'undefined' && (JUMBO_LIGHT_BAR_TEAMS[team] || PDF_SCHEMES.light.team[team]);
            const dark = typeof PDF_SCHEMES !== 'undefined' && PDF_SCHEMES.dark.team[team];
            if (!light || !dark) return `<span>${abbr}</span>`;
            return `<span class="team-tint" style="--team-l: ${pdfvRgb(light)}; --team-d: ${pdfvRgb(dark)}">${abbr}</span>`;
        }

        function renderSummaryNow() {
            const container = document.getElementById('summaryContainer');
            const allUsers = getParticipantUsernames();

            // Until predictions lock (or a result is in) nobody's guesses are shown, so the summary is just who has signed up
            if (!predictionsRevealed()) {
                const names = getActiveUsernames().map(u => ({ username: u, name: getDisplayName(u) }))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                const list = names.length
                    ? `<ul class="signed-up-list">${names.map(n => `<li>${escapeHtml(n.name)}${n.username === currentUsername ? ' <span class="signed-up-you">(you)</span>' : ''}</li>`).join('')}</ul>`
                    : '<p class="signed-up-empty">Nobody has signed up for this year yet.</p>';
                container.innerHTML = `<div class="signed-up-panel"><h3>Signed up for ${selectedYear}${names.length ? ` (${names.length})` : ''}</h3><p class="signed-up-note">🔒 Predictions will be revealed after all guesses are in.</p>${list}</div>`;
                renderPrizeMoneyPanel([]);
                renderWormChart([]);
                updateLeaderboard();
                return;
            }

            if (matches.length === 0 || allUsers.length === 0) {
                const emptyMessage = matches.length === 0
                    ? `Predictions will be revealed after all guesses are in.`
                    : `No competitors have made predictions for ${selectedYear} yet.`;
                container.innerHTML = `<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">${emptyMessage}</p>`;
                renderPrizeMoneyPanel([]);
                renderWormChart([]);
                updateLeaderboard();
                return;
            }

            const filteredMatches = getFilteredMatches();
            
            if (filteredMatches.length === 0) {
                container.innerHTML = '<p style="text-align: center; font-size: 1.2rem; opacity: 0.7;">No matches match the current filter.</p>';
                const sortedUsersForPrizeOnly = allUsers
                    .map(username => ({
                        username: username,
                        nickname: toTitleCase(users[username].nickname || username),
                        totalPoints: calculatePoints(username)
                    }))
                    .sort((a, b) => b.totalPoints - a.totalPoints);
                renderPrizeMoneyPanel(sortedUsersForPrizeOnly);
                renderWormChart(sortedUsersForPrizeOnly);
                updateLeaderboard();
                return;
            }

            // Classic view: the same table, drawn like the PDF export (always the whole tournament; no match filter)
            if (summaryViewMode === 'classic') {
                const sortedForPdf = pdfvSortedUsers();
                container.innerHTML = buildPdfStyleViewHtml(matches, sortedForPdf);
                fitPdfView();
                renderPrizeMoneyPanel(sortedForPdf);
                renderWormChart(sortedForPdf);
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

            // Simple view: plain words only (no flags, cards, padlocks); a Joker is shown by colour
            const simple = summaryViewMode === 'simple';
            // The match in play, or else the next one, gets a faint column tint in Compact and Jumbo
            const highlights = matchHighlightsFor(summaryViewMode);
            const hlClass = (match) => highlights.has(match.id) ? ` match-col-${highlights.get(match.id)}` : '';
            let html =predictionsRevealed() ? '' : `<div class="predictions-hidden-note" role="status">${simple ? '' : '🔒 '}Other players' predictions are hidden until predictions are locked, so nobody is influenced by them. You can still see your own.</div>`;
            html += scrollHintMarkup;
            html += '<div class="summary-table-wrap"><div class="summary-sticky-zone"><div class="summary-sticky-head"><div class="summary-sticky-inner"></div></div></div>';
            html += '<div class="summary-container">';
            html += '<table class="summary-table">';
            
            // Header row: Rank | Competitor | Score | Match 1 | Match 2 | ... | Predicted Tries
            html += '<thead><tr>';
            html += '<th class="rank-col">#</th>';
            // Compact: the score sits under the name, so the column is "Competitor & Score" (the "& Score" part drops to a second line on phones); Jumbo keeps "Competitor"
            html += `<th class="competitor-col"><span class="th-angled">Competitor${simple ? '' : ' <span class="th-amp">&amp; Score</span>'}</span></th>`;
            html += '<th class="pts-col"><span class="th-angled">Score</span></th>';
            filteredMatches.forEach((match, colIndex) => {
                const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                const hasTries = match.actualTries1 !== null && match.actualTries2 !== null;
                const totalMatchTries = hasTries ? match.actualTries1 + match.actualTries2 : null;
                html += `<th class="match-header-cell ${match.jokerEligible ? 'joker-eligible-header' : ''}${hlClass(match)}" data-match-col="${colIndex}" data-chat-match="${match.id}"${chatHeaderAttrs(match)}>
                    <div class="match-header-cell-inner">
                        <div class="match-header-top">
                            ${highlights.has(match.id) ? `<span class="sr-only">${highlights.get(match.id) === 'now' ? 'In play now. ' : 'Next match. '}</span>` : ''}<div class="match-teams">${simple ? `${simpleTeamSpan(match.team1)}${simpleTeamSpan(match.team2)}` : `<span>${getFlag(match.team1)} ${getTeamAbbr(match.team1)}</span><span>${getFlag(match.team2)} ${getTeamAbbr(match.team2)}</span>`}</div>
                            <div class="match-date">${match.date} - ${match.time}</div>
                        </div>
                        <div class="match-header-bottom">
                            <div class="match-result-row">${hasResult ? `<div class="match-result">${match.actualScore1}${simple ? '-' : ' - '}${match.actualScore2}</div>` : '<div class="no-result">-</div>'}${match.jokerEligible ? (simple ? '<span class="sr-only">Joker</span>' : '<span class="joker-inline" aria-hidden="true">🃏</span>') : ''}</div>
                            <div class="match-tries${hasTries ? '' : ' match-tries-empty'}">${hasTries ? `(${totalMatchTries} tries)` : '&nbsp;'}</div>
                            <div class="match-extras">${match.jokerEligible && !simple ? '<span class="joker-indicator joker-eligible-icon" title="Joker eligible" role="img" aria-label="Joker eligible">🃏</span>' : ''}</div>
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
            const sortedUsers = allUsers
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
                
                html += `<tr class="${rowClass}" data-player="${escapeHtml(user.username)}">`;
                html += `<td class="rank-col">${rank}</td>`;
                html += `<td class="competitor-name"><div class="comp-name"><span class="comp-nick">${user.nickname}</span><div class="comp-sub">${simple ? '' : getUserFlags(user.username)}<span class="comp-score">${user.totalPoints}</span></div></div></td>`;
                html += `<td class="pts-col">${user.totalPoints}</td>`;

                // Column for each match
                filteredMatches.forEach(match => {
                    if (!canSeePredictionsOf(user.username)) {
                        // Hidden until predictions are locked: same slots as a normal cell, so rows still line up
                        html += '<td class="prediction-cell hidden-prediction' + hlClass(match) + '" title="Hidden until predictions are locked"><div class="cell-score"><span aria-label="Hidden until predictions are locked">' + (simple ? 'Hidden' : '🔒') + '</span></div><span class="points-earned points-placeholder">&nbsp;</span><div class="cell-extras"></div></td>';
                        return;
                    }
                    const pred = users[user.username].predictions[match.id];
                    const hasResult = match.actualScore1 !== null && match.actualScore2 !== null;
                    
                    if (!pred) {
                        html += `<td class="${hlClass(match).trim()}">-</td>`;
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

                    const jokerIndicator = isJoker && !simple ? '<span class="joker-indicator">🃏</span>' : '';
                    const jokerScoreClass = isJoker ? 'joker-score' : '';
                    const jokerCellClass = isJoker ? (simple ? 'prediction-cell joker-cell simple-joker' : 'prediction-cell joker-cell') : 'prediction-cell';
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
                    const tipClass = tooltipContent.replace(/<[^>]*>/g, '').trim() ? 'tooltip' : 'tooltip tooltip-empty';

                    // Every cell has the same slots, so rows line up: the score, the points pill, then one line holding the Joker and the top emoji
                    const scoreLine = `<div class="cell-score"><span class="${score1Class}">${score1}</span>${simple ? '-' : ' - '}<span class="${score2Class}">${score2}</span>${isJoker ? (simple ? '<span class="sr-only">Joker</span>' : '<span class="joker-inline" aria-hidden="true">🃏</span>') : ''}</div>`;
                    const pointsLine = hasResult
                        ? `<span class="points-earned ${pointsClass}">${pointsEarned} pts</span>`
                        : '<span class="points-earned points-placeholder">&nbsp;</span>';
                    const extrasLine = `<div class="cell-extras">${jokerIndicator}</div>`;
                    // Tapping or clicking a prediction shows the detail in the pop-up, so no hover tooltip
                    const showTooltip = false;
                    html += `<td class="${jokerCellClass}${hlClass(match)}"${chatCellAttrs(user.username, match.id)}>
                        ${showTooltip
                            ? `<div class="tooltip-container">${scoreLine}${pointsLine}<div class="${tipClass}">${tooltipContent}</div></div>`
                            : `${scoreLine}${pointsLine}`}
                        ${extrasLine}
                    </td>`;
                });
                
                // Predicted tries column (only when not filtering by round): just the number, no tooltip
                if (currentFilter !== 'round') {
                    const userTries = users[user.username].totalTries;
                    html += `<td class="tries-col">${!canSeePredictionsOf(user.username) ? (simple ? 'Hidden' : '🔒') : (userTries !== null && userTries !== undefined ? userTries : '-')}</td>`;
                }
                
                html += '</tr>';
            });
            
            html += '</tbody>';
            html += '</table>';
            html += '</div></div>';

            container.innerHTML = html;
            fitFocusNameColumn();
            fitSummaryDensity();
            buildSummaryStickyHead();
            renderPrizeMoneyPanel(sortedUsers);
            renderWormChart(sortedUsers);
            updateLeaderboard();
            checkTableOverflow();

            // In default view, auto-scroll to show the relevant matches
            if (currentFilter === 'default') {
                scrollToDefaultMatches();
            }
        }


        // Jumbo view: a name may wrap at SPACES onto up to two lines (never inside a word), so the Name column is sized for the longest single WORD plus its score
        // (between 64px and 100px, --focus-name-w on the body; in a round of three matches or fewer it also gives up whatever the table is wider than its box, down to the minimum). If a name still needs
        // more than two lines the column grows a little (up to the maximum), then the name shrinks, and only a single word that is still too long is cut with an ellipsis (the full name is in its title).
        // Experiment: to go back to one-line names, git revert the commit that introduced this (this function and the `.comp-nick` rules in styles.css).
        const FOCUS_NAME_MIN = 64, FOCUS_NAME_MAX = 100, FOCUS_NAME_MIN_NARROW = 58;
        function fitFocusNameColumn() {
            const root = document.body;
            if (summaryViewMode !== 'simple') { root.style.removeProperty('--focus-name-w'); root.classList.remove('jumbo-tight'); return; }
            if (summaryIsWideDesktop()) { root.style.removeProperty('--focus-name-w'); root.classList.remove('jumbo-tight'); return; }   // the desktop layout sizes the Name column itself (fitSummaryDensity)
            const cells = [...document.querySelectorAll('.summary-container .summary-table td.competitor-name')];
            if (!cells.length) return;
            root.classList.remove('jumbo-tight');
            root.style.setProperty('--focus-name-w', FOCUS_NAME_MIN + 'px');
            const nicks = cells.map(td => td.querySelector('.comp-nick')).filter(Boolean);
            nicks.forEach(nick => { nick.classList.remove('nick-shrink', 'nick-trunc'); nick.title = nick.textContent.trim(); });
            // widest single word of any name (measured with the name's own font), plus the score and the cell padding
            // the Name column width the names need: the widest single word (or hyphenated part) of any name, plus the score, the gap and the cell padding
            const probe = document.createElement('span');
            probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
            document.body.appendChild(probe);
            const computeNeed = () => {
                let need = 0;
                cells.forEach(td => {
                    const nick = td.querySelector('.comp-nick'), score = td.querySelector('.comp-score');
                    if (!nick || !score) return;
                    const ns = getComputedStyle(nick);
                    probe.style.font = ns.font; probe.style.letterSpacing = ns.letterSpacing;
                    let longest = 0;
                    nick.textContent.trim().split(/(?<=-)|\s+/).forEach(word => { probe.textContent = word; longest = Math.max(longest, probe.getBoundingClientRect().width); });
                    const cs = getComputedStyle(td);
                    const padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
                    const gap = parseFloat(getComputedStyle(nick.parentElement).columnGap) || 0;
                    need = Math.max(need, Math.ceil(longest + score.offsetWidth + gap + padding + 2));
                });
                return need;
            };
            const overflowing = () => nicks.some(n => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 0.5);
            const setWidth = (w) => { root.style.setProperty('--focus-name-w', w + 'px'); return w; };
            let width = setWidth(Math.min(FOCUS_NAME_MAX, Math.max(FOCUS_NAME_MIN, computeNeed())));
            // a name that needs more than two lines: widen the column a little, up to the maximum
            while (width < FOCUS_NAME_MAX && overflowing()) width = setWidth(Math.min(FOCUS_NAME_MAX, width + 4));
            // A round (three matches or fewer) must fit the screen with no sideways scrolling. First the scores and result boxes go one size smaller (that keeps the names whole); only if the table is still wider than its box does the Name column give up the difference (down to the minimum; longer names then shrink and, last of all, are cut).
            const box = document.querySelector('.summary-container');
            if (box && box.querySelectorAll('thead th.match-header-cell').length <= 3 && box.scrollWidth - box.clientWidth > 0) {
                root.classList.add('jumbo-tight');
                width = setWidth(Math.min(FOCUS_NAME_MAX, Math.max(FOCUS_NAME_MIN, computeNeed())));
                while (width < FOCUS_NAME_MAX && overflowing() && box.scrollWidth - box.clientWidth <= 0) width = setWidth(Math.min(FOCUS_NAME_MAX, width + 4));
                const over = box.scrollWidth - box.clientWidth;
                if (over > 0) {
                    // on the very narrowest phones (about 320px) the column may go a little below the usual minimum
                    const floor = box.clientWidth < 330 ? FOCUS_NAME_MIN_NARROW : FOCUS_NAME_MIN;
                    width = setWidth(Math.max(floor, width - over));
                }
            }
            probe.remove();
            // anything still too long shrinks first; a single word that is still too wide is cut with an ellipsis (one line) as the very last resort
            nicks.forEach(nick => { if (nick.scrollHeight > nick.clientHeight + 1 || nick.scrollWidth > nick.clientWidth + 0.5) nick.classList.add('nick-shrink'); });
            nicks.forEach(nick => { if (nick.scrollHeight > nick.clientHeight + 1 || nick.scrollWidth > nick.clientWidth + 0.5) nick.classList.add('nick-trunc'); });
        }
        // ---- Wide desktops (a mouse, 1100px or more): short rows, so the whole table fits the screen without scrolling down ----
        // Compact and Jumbo only (Classic is its own page). Phones, tablets and narrow windows are never touched.
        // fitSummaryDensity() sizes the Name column to the longest name on ONE line, then tries three levels on the table wrap, from the roomiest
        // (density-comfortable: score over points, about 55px a row) to density-tight (about 45px) and density-tightest (about 37px, smaller type),
        // and keeps the first one whose bottom edge is on screen.
        // With more players than fit even at the tightest level it stays there and the page scrolls as before.
        const DENSITY_LEVELS = ['density-comfortable', 'density-tight', 'density-tightest'];
        function summaryIsWideDesktop() {
            if (typeof window === 'undefined' || typeof summaryViewMode === 'undefined' || summaryViewMode === 'classic') return false;
            try { return window.innerWidth >= 1100 && window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (error) { return false; }
        }
        function fitSummaryDensity() {
            const wrap = document.querySelector('.summary-table-wrap');
            if (!wrap) return;
            const root = document.body;
            const clear = () => { DENSITY_LEVELS.forEach(c => wrap.classList.remove(c)); root.style.removeProperty('--desk-name-w'); };
            const box = wrap.querySelector('.summary-container');
            const table = box && box.querySelector('table.summary-table');
            if (!table || !summaryIsWideDesktop()) { clear(); return; }
            const bottomOf = () => table.getBoundingClientRect().bottom + window.scrollY;
            const fits = () => bottomOf() <= window.innerHeight - 8;
            // the Name column: the widest name + flags + total on one line (between 130px and 260px)
            const fitName = () => {
                root.style.setProperty('--desk-name-w', '420px');
                let need = 0;
                table.querySelectorAll('tbody td.competitor-name').forEach(td => {
                    const nick = td.querySelector('.comp-nick'), sub = td.querySelector('.comp-sub');
                    if (!nick) return;
                    const cs = getComputedStyle(td);
                    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
                    need = Math.max(need, Math.ceil(nick.getBoundingClientRect().width + (sub ? sub.getBoundingClientRect().width : 0) + 14 + pad + 2));
                });
                root.style.setProperty('--desk-name-w', Math.min(260, Math.max(130, need)) + 'px');
            };
            table.querySelectorAll('.comp-nick').forEach(n => n.classList.remove('nick-shrink', 'nick-trunc'));
            wrap.classList.remove('density-tight', 'density-tightest');
            wrap.classList.add('density-comfortable');
            fitName();
            if (fits()) return;
            for (const level of ['density-tight', 'density-tightest']) {
                wrap.classList.remove('density-comfortable', 'density-tight', 'density-tightest');
                wrap.classList.add(level);
                fitName();
                if (fits()) return;
            }
        }
        let densityResizeTimer = null;
        function refitSummaryDensity() {
            clearTimeout(densityResizeTimer);
            densityResizeTimer = setTimeout(() => {
                if (!document.querySelector('.summary-table-wrap .summary-table')) return;
                fitSummaryDensity();
                if (summaryViewMode === 'simple') fitFocusNameColumn();
                if (typeof sizeSummaryStickyHead === 'function') sizeSummaryStickyHead();
                if (typeof layoutSummarySticky === 'function') layoutSummarySticky();
            }, 120);
        }
        if (typeof window !== 'undefined') window.addEventListener('resize', refitSummaryDensity);

        // Fonts that arrive after the first draw change the text widths: fit again, then re-pin the header
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                if (!document.querySelector('.summary-container .summary-table')) return;
                if (summaryIsWideDesktop()) { fitSummaryDensity(); if (typeof sizeSummaryStickyHead === 'function') sizeSummaryStickyHead(); if (typeof layoutSummarySticky === 'function') layoutSummarySticky(); return; }
                if (summaryViewMode !== 'simple') return;
                fitFocusNameColumn();
                if (typeof layoutSummarySticky === 'function') layoutSummarySticky();
            }).catch(() => {});
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
            // the right edge of the pinned columns (the Score column is hidden in Compact, where the score sits beside the flags)
            const pinnedEdge = ['.pts-col', '.competitor-name'].map(sel => targetCell.closest('table').querySelector(sel)).find(el => el && el.offsetParent !== null);
            const stickyWidth = pinnedEdge ? pinnedEdge.offsetLeft + pinnedEdge.offsetWidth : 0;
            const scrollTarget = targetCell.offsetLeft - stickyWidth;
            container.scrollLeft = Math.max(0, scrollTarget);
        }

        // A table that is only a pixel or two wider than its box (a round of three games on a phone) must not scroll at all:
        // on iPhone that sliver let the box bounce from side to side. Locked, it simply stays put.
        function syncSummaryScrollLock() {
            const box = document.querySelector('.summary-container');
            if (!box) return;
            box.classList.remove('no-scroll');
            box.classList.toggle('no-scroll', box.scrollWidth - box.clientWidth <= 3);
            // Sideways scrolling snaps to whole match columns, lined up against the pinned Rank/Name columns, so no sliver of a
            // column (a cut-off score chip) is left showing right beside the pinned columns when the table comes to rest
            const pinned = box.querySelector('.summary-table:not(.summary-table-clone) td.competitor-name, .summary-table:not(.summary-table-clone) th.competitor-col');
            if (pinned) {
                const pts = box.querySelector('.summary-table:not(.summary-table-clone) td.pts-col');
                const last = pts && pts.offsetParent !== null ? pts : pinned;
                const edge = last.getBoundingClientRect().right - box.getBoundingClientRect().left - (parseFloat(getComputedStyle(box).borderLeftWidth) || 0);
                box.style.scrollPaddingLeft = Math.max(0, Math.round(edge)) + 'px';
            }
        }

        // The "scroll left and right" hint goes away for good once the user has scrolled the table sideways themselves
        const SCROLL_HINT_DISMISSED_KEY = 'summaryScrollHintDismissed';
        function scrollHintDismissed() {
            try { return localStorage.getItem(SCROLL_HINT_DISMISSED_KEY) === '1'; } catch (error) { return false; }
        }
        function dismissScrollHint() {
            try { localStorage.setItem(SCROLL_HINT_DISMISSED_KEY, '1'); } catch (error) { /* not remembered */ }
            const hint = document.getElementById('scrollHint');
            if (hint) hint.remove();
        }
        // A scroll counts only if the user just touched, dragged or wheeled the table (the app also scrolls it by itself when it draws)
        function watchScrollHint(box) {
            if (!box || box.dataset.hintWatch || scrollHintDismissed()) return;
            box.dataset.hintWatch = '1';
            let lastInput = 0;
            const note = () => { lastInput = Date.now(); };
            ['touchstart', 'touchmove', 'wheel', 'mousedown', 'keydown'].forEach(type => box.addEventListener(type, note, { passive: true }));
            let startLeft = box.scrollLeft;
            box.addEventListener('scroll', () => {
                if (Math.abs(box.scrollLeft - startLeft) < 4) return;
                if (Date.now() - lastInput < 1500) dismissScrollHint();
                else startLeft = box.scrollLeft;   // moved by the app, not the user
            }, { passive: true });
        }

        function checkTableOverflow() {
            const container = document.querySelector('.summary-container');
            const scrollHint = document.getElementById('scrollHint');
            if (!container || !scrollHint) return;

            // Show hint if table is wider than container (and the user has not already learned to scroll it)
            if (scrollHintDismissed()) {
                scrollHint.remove();
            } else if (container.scrollWidth > container.clientWidth) {
                scrollHint.classList.remove('hidden');
                watchScrollHint(container);
            } else {
                scrollHint.classList.add('hidden');
            }
            syncSummaryScrollLock();

            // Enable touch tooltips for mobile
            initTouchTooltips();
        }
