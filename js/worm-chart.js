// Worm chart
// Classic script (shared global scope); load order is set in index.html.

        function getWormChartColor(index) {
            const palette = [
                '#f4d35e',
                '#4fc3f7',
                '#81c784',
                '#ff8a65',
                '#ba68c8',
                '#ffd54f',
                '#4db6ac',
                '#9575cd',
                '#90a4ae',
                '#ffb74d',
                '#64b5f6',
                '#aed581'
            ];
            if (index < palette.length) return palette[index];
            const hue = (index * 47) % 360;
            return `hsl(${hue} 70% 58%)`;
        }

        // Phones get a narrower, taller chart with bigger text, so it can be read without zooming
        function wormChartIsPhone() { return window.innerWidth <= 600; }
        let wormChartLastUsers = null;
        let wormChartRenderedPhone = null;

        // Called when the screen is rotated or resized: redraw if it crossed the phone/desktop size
        function refreshWormChartLayout() {
            if (wormChartLastUsers && wormChartRenderedPhone !== null && wormChartRenderedPhone !== wormChartIsPhone()) renderWormChart(wormChartLastUsers);
        }

        function renderWormChart(sortedUsers) {
            const container = document.getElementById('wormChartContainer');
            if (!container) return;
            const phone = wormChartIsPhone();
            wormChartRenderedPhone = phone;
            wormChartLastUsers = sortedUsers;

            const usersForChart = Array.isArray(sortedUsers) ? sortedUsers : [];
            const allCompletedMatches = matches
                .filter(m => m.actualScore1 !== null && m.actualScore2 !== null)
                .sort((a, b) => Number(a.id) - Number(b.id));
            // Same games as the table: all of them, or just the selected round (the running totals still carry on from earlier rounds)
            const roundOnly = currentFilter === 'round';
            const completedMatches = roundOnly ? allCompletedMatches.filter(m => m.round === selectedRound) : allCompletedMatches;

            if (usersForChart.length === 0) {
                container.innerHTML = `
                    <div class="worm-chart-title">Points Progression</div>
                    <div class="worm-chart-empty">No competitor data yet.</div>
                `;
                return;
            }

            if (completedMatches.length === 0) {
                container.innerHTML = `
                    <div class="worm-chart-title">Points Progression${roundOnly ? ` (Round ${selectedRound})` : ''}</div>
                    <div class="worm-chart-empty">${roundOnly ? 'No results in this round yet.' : 'Add match results to show the game-by-game points chart.'}</div>
                `;
                return;
            }

            const series = usersForChart.map((user, index) => {
                let runningTotal = 0;
                const points = completedMatches.map(match => {
                    if (roundOnly && completedMatches.indexOf(match) === 0) {
                        // totals before this round
                        runningTotal = allCompletedMatches.filter(m => m.round < selectedRound).reduce((sum, earlier) => {
                            const earlierPrediction = users[user.username] && users[user.username].predictions ? users[user.username].predictions[earlier.id] : null;
                            return sum + calculateMatchPoints(earlierPrediction, earlier, isUserJokerForMatch(user.username, earlier.id));
                        }, 0);
                    }
                    const prediction = users[user.username] && users[user.username].predictions
                        ? users[user.username].predictions[match.id]
                        : null;
                    const isJoker = isUserJokerForMatch(user.username, match.id);
                    const pointsThisGame = calculateMatchPoints(prediction, match, isJoker);
                    runningTotal += pointsThisGame;
                    return {
                        total: runningTotal,
                        matchLabel: `${getTeamAbbr(match.team1)} v ${getTeamAbbr(match.team2)}`,
                        resultLabel: `${match.actualScore1} - ${match.actualScore2}`,
                        predictionLabel: prediction ? `${prediction.team1} - ${prediction.team2}` : 'No prediction',
                        pointsThisGame
                    };
                });
                return {
                    username: user.username,
                    nickname: user.nickname,
                    color: getWormChartColor(index),
                    points
                };
            });

            const maxPoints = Math.max(0, ...series.flatMap(line => line.points.map(point => point.total)));
            const yMax = maxPoints <= 10 ? 10 : Math.ceil(maxPoints / 5) * 5;
            const tickCount = 5;

            const marginLeft = phone ? 52 : 56;
            const marginRight = phone ? 16 : 24;
            const marginTop = 16;
            const marginBottom = phone ? 110 : 88;
            const plotWidth = phone ? Math.max(420, completedMatches.length * 64) : Math.max(980, completedMatches.length * 86);
            const plotHeight = phone ? 420 : 280;
            const labelDrop = phone ? 36 : 28;
            const svgWidth = marginLeft + plotWidth + marginRight;
            const svgHeight = marginTop + plotHeight + marginBottom;

            const getX = index => {
                if (completedMatches.length === 1) return marginLeft + (plotWidth / 2);
                return marginLeft + (index * plotWidth) / (completedMatches.length - 1);
            };
            const getY = value => marginTop + plotHeight - (value / yMax) * plotHeight;

            let gridAndLabels = '';
            for (let tick = 0; tick <= tickCount; tick++) {
                const value = (yMax / tickCount) * tick;
                const y = getY(value);
                gridAndLabels += `
                    <line class="worm-grid-line" x1="${marginLeft}" y1="${y}" x2="${marginLeft + plotWidth}" y2="${y}"></line>
                    <text class="worm-axis-label" x="${marginLeft - 8}" y="${y + 4}" text-anchor="end">${Math.round(value)}</text>
                `;
            }

            let xAxisLabels = '';
            completedMatches.forEach((match, index) => {
                const x = getX(index);
                const matchLabel = `${getTeamAbbr(match.team1)} v ${getTeamAbbr(match.team2)}`;
                xAxisLabels += `
                    <line class="worm-tick-line" x1="${x}" y1="${marginTop + plotHeight}" x2="${x}" y2="${marginTop + plotHeight + 6}"></line>
                    <text class="worm-axis-label worm-axis-match-label" x="${x}" y="${marginTop + plotHeight + labelDrop}" text-anchor="end" transform="rotate(-32 ${x} ${marginTop + plotHeight + labelDrop})">${escapeHtml(matchLabel)}</text>
                `;
            });

            const linePaths = series.map(line => {
                const pathData = line.points
                    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index).toFixed(2)} ${getY(point.total).toFixed(2)}`)
                    .join(' ');
                const pointsMarkup = line.points
                    .map((point, index) => {
                        return `<circle
                            class="worm-point"
                            cx="${getX(index).toFixed(2)}"
                            cy="${getY(point.total).toFixed(2)}"
                            r="7"
                            fill="${line.color}"
                            data-username="${escapeHtml(line.username)}"
                            data-player-name="${escapeHtml(line.nickname)}"
                            data-match="${escapeHtml(point.matchLabel)}"
                            data-result="${escapeHtml(point.resultLabel)}"
                            data-prediction="${escapeHtml(point.predictionLabel)}"
                            data-points-game="${point.pointsThisGame}"
                            data-total="${point.total}"
                        ></circle>`;
                    })
                    .join('');
                return `
                    <g class="worm-series" data-player="${escapeHtml(line.username)}">
                        <path class="worm-series-line" d="${pathData}" fill="none" stroke="${line.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                        ${pointsMarkup}
                    </g>
                `;
            }).join('');

            const legend = series.map(line => `
                <div class="worm-legend-item ${line.username === currentUsername ? 'worm-legend-item-current' : ''}" data-player="${escapeHtml(line.username)}">
                    <span class="worm-legend-swatch" style="background:${line.color};"></span>
                    <span>${escapeHtml(line.nickname)}</span>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="worm-chart-title">Points Progression${roundOnly ? ` (Round ${selectedRound})` : ''}</div>
                <div class="worm-chart-tools"><span class="worm-chart-hover-hint">Hover or tap a player or line to highlight them; click or tap a point for that game's details. Pinch to zoom, drag to move.</span><span class="pdfv-zoom worm-zoom"><button type="button" onclick="zoomWormChart(1 / 1.3)" aria-label="Zoom the chart out">−</button><button type="button" onclick="zoomWormChart(0)" aria-label="Fit the chart to the screen">Fit</button><button type="button" onclick="zoomWormChart(1.3)" aria-label="Zoom the chart in">+</button></span></div>
                <div class="worm-chart-wrap">
                    <svg class="worm-chart-svg${phone ? ' phone' : ''}" width="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Line chart showing each player's cumulative points per game">
                        <line class="worm-axis-line" x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + plotHeight}"></line>
                        <line class="worm-axis-line" x1="${marginLeft}" y1="${marginTop + plotHeight}" x2="${marginLeft + plotWidth}" y2="${marginTop + plotHeight}"></line>
                        ${gridAndLabels}
                        ${xAxisLabels}
                        ${linePaths}
                        <text class="worm-axis-title" x="${marginLeft + (plotWidth / 2)}" y="${svgHeight - 8}" text-anchor="middle">Game</text>
                        <text class="worm-axis-title" x="16" y="${marginTop + (plotHeight / 2)}" text-anchor="middle" transform="rotate(-90 16 ${marginTop + (plotHeight / 2)})">Total Points</text>
                    </svg>
                </div>
                <div class="worm-legend">${legend}</div>
            `;

            bindWormChartInteractions();
            applyWormZoom(currentWormZoom());
            enableWormPinch(container.querySelector('.worm-chart-wrap'));
        }

        function setActiveWormPlayer(username) {
            const container = document.getElementById('wormChartContainer');
            if (!container) return;

            const activeUsername = username || null;
            const hasActive = !!activeUsername;
            container.querySelectorAll('.worm-series').forEach(series => {
                const isActive = hasActive && series.dataset.player === activeUsername;
                series.classList.toggle('is-active', isActive);
                series.classList.toggle('is-dimmed', hasActive && !isActive);
            });
            container.querySelectorAll('.worm-legend-item').forEach(item => {
                const isActive = hasActive && item.dataset.player === activeUsername;
                item.classList.toggle('is-active', isActive);
                item.classList.toggle('is-dimmed', hasActive && !isActive);
            });
        }

        function bindWormChartInteractions() {
            const container = document.getElementById('wormChartContainer');
            if (!container) return;
            const wrap = container.querySelector('.worm-chart-wrap');

            const activate = username => setActiveWormPlayer(username);
            const clear = () => setActiveWormPlayer(null);
            const getActiveUsername = () => {
                const activeSeries = container.querySelector('.worm-series.is-active');
                return activeSeries ? activeSeries.dataset.player : null;
            };
            const togglePlayer = username => {
                if (!username) return;
                if (getActiveUsername() === username) {
                    clear();
                    return;
                }
                activate(username);
            };
            container.querySelectorAll('.worm-legend-item').forEach(item => {
                const isActive = hasActive && item.dataset.player === activeUsername;
                item.classList.toggle('is-active', isActive);
                item.classList.toggle('is-dimmed', hasActive && !isActive);
            });
        }

        function bindWormChartInteractions() {
            const container = document.getElementById('wormChartContainer');
            if (!container) return;
            const wrap = container.querySelector('.worm-chart-wrap');

            const activate = username => setActiveWormPlayer(username);
            const clear = () => setActiveWormPlayer(null);
            const getActiveUsername = () => {
                const activeSeries = container.querySelector('.worm-series.is-active');
                return activeSeries ? activeSeries.dataset.player : null;
            };
            const togglePlayer = username => {
                if (!username) return;
                if (getActiveUsername() === username) {
                    clear();
                    return;
                }
                activate(username);
            };
            container.querySelectorAll('.worm-legend-item').forEach(item => {
                const username = item.dataset.player;
                item.addEventListener('mouseenter', () => activate(username));
                item.addEventListener('mouseleave', clear);
                item.addEventListener('click', () => togglePlayer(username));
                item.addEventListener('touchstart', event => {
                    event.preventDefault();
                    togglePlayer(username);
                }, { passive: false });
            });

            container.querySelectorAll('.worm-series').forEach(series => {
                const username = series.dataset.player;
                series.addEventListener('mouseenter', () => activate(username));
                series.addEventListener('mouseleave', clear);
                series.addEventListener('click', () => togglePlayer(username));
                series.addEventListener('touchstart', event => {
                    event.preventDefault();
                    togglePlayer(username);
                }, { passive: false });
            });

            document.querySelectorAll('.summary-table tbody tr[data-player]').forEach(row => {
                const username = row.dataset.player;
                row.addEventListener('mouseenter', () => activate(username));
                row.addEventListener('mouseleave', clear);
            });

            if (!wrap) return;

            container.querySelectorAll('.worm-point').forEach(point => {
                point.addEventListener('mouseenter', () => activate(point.dataset.username || ''));
                point.addEventListener('click', event => {
                    event.stopPropagation();
                    activate(point.dataset.username || '');
                    openWormPointDetail(point);
                });
                point.addEventListener('touchstart', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    activate(point.dataset.username || '');
                    openWormPointDetail(point);
                }, { passive: false });
            });

            wrap.addEventListener('click', event => {
                if (event.target && event.target.classList && event.target.classList.contains('worm-point')) return;
                clear();
            });
            wrap.addEventListener('touchstart', event => {
                const target = event.target;
                if (target && target.classList && target.classList.contains('worm-point')) return;
                clear();
            }, { passive: true });
        }


// ---- Zoom: the chart starts fitted to the screen width; +/- and Fit (above the chart) or a two-finger pinch zoom it, and the chart box scrolls sideways
let wormZoom = null;   // null = fitted
const WORM_MAX_ZOOM = 4;
function currentWormZoom() { return Math.max(1, Math.min(WORM_MAX_ZOOM, wormZoom || 1)); }
function applyWormZoom(k) {
    const svg = document.querySelector('#wormChartContainer .worm-chart-svg');
    const wrap = document.querySelector('#wormChartContainer .worm-chart-wrap');
    if (!svg || !wrap) return;
    svg.style.width = (k * 100) + '%';
    wrap.dataset.zoomed = k > 1.01 ? '1' : '';
}
function zoomWormChart(factor) {
    const wrap = document.querySelector('#wormChartContainer .worm-chart-wrap');
    if (!wrap) return;
    const before = currentWormZoom();
    wormZoom = factor === 0 ? null : Math.max(1, Math.min(WORM_MAX_ZOOM, before * factor));
    const k = currentWormZoom();
    const centre = (wrap.scrollLeft + wrap.clientWidth / 2) / before;   // keep what is in the middle in the middle
    applyWormZoom(k);
    wrap.scrollLeft = Math.max(0, centre * k - wrap.clientWidth / 2);
}
function enableWormPinch(wrap) {
    if (!wrap || wrap.dataset.pinch) return;
    wrap.dataset.pinch = '1';
    let start = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) { start = null; return; }
        const rect = wrap.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const k0 = currentWormZoom();
        start = { d0: dist(e.touches), k0, cx, contentX: (wrap.scrollLeft + cx) / k0 };
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
        if (!start || e.touches.length !== 2) return;
        e.preventDefault();
        const k = Math.max(1, Math.min(WORM_MAX_ZOOM, start.k0 * dist(e.touches) / start.d0));
        wormZoom = k;
        applyWormZoom(k);
        wrap.scrollLeft = Math.max(0, start.contentX * k - start.cx);
    }, { passive: false });
    const end = (e) => { if (e.touches.length < 2) start = null; };
    wrap.addEventListener('touchend', end, { passive: true });
    wrap.addEventListener('touchcancel', end, { passive: true });
}
