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

        function renderWormChart(sortedUsers) {
            const container = document.getElementById('wormChartContainer');
            if (!container) return;

            const usersForChart = Array.isArray(sortedUsers) ? sortedUsers : [];
            const completedMatches = matches
                .filter(m => m.actualScore1 !== null && m.actualScore2 !== null)
                .sort((a, b) => Number(a.id) - Number(b.id));

            if (usersForChart.length === 0) {
                container.innerHTML = `
                    <div class="worm-chart-title">Points Progression</div>
                    <div class="worm-chart-empty">No competitor data yet.</div>
                `;
                return;
            }

            if (completedMatches.length === 0) {
                container.innerHTML = `
                    <div class="worm-chart-title">Points Progression</div>
                    <div class="worm-chart-empty">Add match results to show the game-by-game points chart.</div>
                `;
                return;
            }

            const series = usersForChart.map((user, index) => {
                let runningTotal = 0;
                const points = completedMatches.map(match => {
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

            const marginLeft = 56;
            const marginRight = 24;
            const marginTop = 16;
            const marginBottom = 88;
            const plotWidth = Math.max(980, completedMatches.length * 86);
            const plotHeight = 720;
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
                    <text class="worm-axis-label worm-axis-match-label" x="${x}" y="${marginTop + plotHeight + 28}" text-anchor="end" transform="rotate(-32 ${x} ${marginTop + plotHeight + 28})">${escapeHtml(matchLabel)}</text>
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
                <div class="worm-chart-title">Points Progression</div>
                <div class="worm-chart-hover-hint">Mouse over or tap a player, line, or point to highlight and view details.</div>
                <div class="worm-chart-wrap">
                    <svg class="worm-chart-svg" width="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Line chart showing each player's cumulative points per game">
                        <line class="worm-axis-line" x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + plotHeight}"></line>
                        <line class="worm-axis-line" x1="${marginLeft}" y1="${marginTop + plotHeight}" x2="${marginLeft + plotWidth}" y2="${marginTop + plotHeight}"></line>
                        ${gridAndLabels}
                        ${xAxisLabels}
                        ${linePaths}
                        <text class="worm-axis-title" x="${marginLeft + (plotWidth / 2)}" y="${svgHeight - 8}" text-anchor="middle">Game</text>
                        <text class="worm-axis-title" x="16" y="${marginTop + (plotHeight / 2)}" text-anchor="middle" transform="rotate(-90 16 ${marginTop + (plotHeight / 2)})">Total Points</text>
                    </svg>
                    <div id="wormPointTooltip" class="worm-point-tooltip hidden"></div>
                </div>
                <div class="worm-legend">${legend}</div>
            `;

            bindWormChartInteractions();
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
            const tooltip = container.querySelector('#wormPointTooltip');

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
                    if (tooltip) tooltip.classList.add('hidden');
                    return;
                }
                activate(username);
            };
            const getClientPosition = (event, pointElement = null) => {
                if (event && event.touches && event.touches.length > 0) {
                    return {
                        clientX: event.touches[0].clientX,
                        clientY: event.touches[0].clientY
                    };
                }
                if (event && event.changedTouches && event.changedTouches.length > 0) {
                    return {
                        clientX: event.changedTouches[0].clientX,
                        clientY: event.changedTouches[0].clientY
                    };
                }
                if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
                    return {
                        clientX: event.clientX,
                        clientY: event.clientY
                    };
                }
                if (pointElement && typeof pointElement.getBoundingClientRect === 'function') {
                    const rect = pointElement.getBoundingClientRect();
                    return {
                        clientX: rect.left + (rect.width / 2),
                        clientY: rect.top + (rect.height / 2)
                    };
                }
                return { clientX: 0, clientY: 0 };
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

            if (!wrap || !tooltip) return;

            const showPointTooltip = (event, point) => {
                tooltip.innerHTML = `
                    <div class="worm-point-tooltip-player">${escapeHtml(point.dataset.playerName || '')}</div>
                    <div>${escapeHtml(point.dataset.match || '')}</div>
                    <div>Result: ${escapeHtml(point.dataset.result || '')}</div>
                    <div>Prediction: ${escapeHtml(point.dataset.prediction || '')}</div>
                    <div>Points this game: ${escapeHtml(point.dataset.pointsGame || '0')}</div>
                    <div>Total points: ${escapeHtml(point.dataset.total || '0')}</div>
                `;
                tooltip.classList.remove('hidden');

                const wrapRect = wrap.getBoundingClientRect();
                const pointer = getClientPosition(event, point);
                const left = pointer.clientX - wrapRect.left + 12;
                const top = pointer.clientY - wrapRect.top + 12;
                const maxLeft = Math.max(8, wrap.clientWidth - tooltip.offsetWidth - 8);
                const maxTop = Math.max(8, wrap.clientHeight - tooltip.offsetHeight - 8);

                tooltip.style.left = `${Math.min(Math.max(8, left), maxLeft)}px`;
                tooltip.style.top = `${Math.min(Math.max(8, top), maxTop)}px`;
            };

            const hidePointTooltip = () => {
                tooltip.classList.add('hidden');
            };

            container.querySelectorAll('.worm-point').forEach(point => {
                point.addEventListener('mouseenter', event => showPointTooltip(event, point));
                point.addEventListener('mousemove', event => showPointTooltip(event, point));
                point.addEventListener('mouseleave', hidePointTooltip);
                point.addEventListener('click', event => {
                    event.stopPropagation();
                    activate(point.dataset.username || '');
                    showPointTooltip(event, point);
                });
                point.addEventListener('touchstart', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    activate(point.dataset.username || '');
                    showPointTooltip(event, point);
                }, { passive: false });
            });

            wrap.addEventListener('click', event => {
                if (event.target && event.target.classList && event.target.classList.contains('worm-point')) return;
                hidePointTooltip();
                clear();
            });
            wrap.addEventListener('touchstart', event => {
                const target = event.target;
                if (target && target.classList && target.classList.contains('worm-point')) return;
                hidePointTooltip();
                clear();
            }, { passive: true });
        }
