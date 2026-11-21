// PDF export and touch tooltips
// Classic script (shared global scope); load order is set in index.html.

        // jsPDF and its table plugin (about 400 KB) are only needed for the PDF, so they are fetched on demand;
        // a few seconds after start-up they are also fetched quietly in the background so the first tap is instant.
        const PDF_LIB_URLS = [
            'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
            'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
        ];
        let pdfLibsPromise = null;
        function loadPdfLibs() {
            if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
            if (!pdfLibsPromise) {
                const load = (src) => new Promise((resolve, reject) => {
                    const el = document.createElement('script');
                    el.src = src; el.onload = resolve; el.onerror = () => reject(new Error('Could not load ' + src));
                    document.head.appendChild(el);
                });
                pdfLibsPromise = PDF_LIB_URLS.reduce((chain, src) => chain.then(() => load(src)), Promise.resolve())
                    .catch(error => { pdfLibsPromise = null; throw error; });   // allow another try after a failure
            }
            return pdfLibsPromise;
        }
        setTimeout(() => { (window.requestIdleCallback || setTimeout)(() => { loadPdfLibs().catch(() => {}); }); }, 6000);

        async function exportToPDF(options = {}) {
            const { openInBrowser = false } = options;
            try {
                await loadPdfLibs();
            } catch (error) {
                alert('Could not load the PDF tools. Check your connection and try again.');
                return;
            }
            const allMatches = matches;

            const sortedUsers = getParticipantUsernames()
                .map(username => ({
                    username,
                    nickname: toTitleCase(users[username].nickname || username),
                    totalPoints: calculatePoints(username)
                }))
                .sort((a, b) => b.totalPoints - a.totalPoints);

            function getMatchPoints(username, match) {
                const pred = getViewablePrediction(username, match.id);
                return calculateMatchPoints(pred, match, canSeePredictionsOf(username) && isUserJokerForMatch(username, match.id));
            }

            const P = PDF_SCHEMES.light.P;   // the colours live in js/pdf-view.js, shared with the on-screen PDF view

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const now = new Date();
            const exportDate = now.toLocaleDateString('en-GB', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const exportTime = now.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(17, 17, 17);
            doc.text(`${selectedYear || now.getFullYear()} Six Nations Guesser`, 3, 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(95, 95, 95);
            doc.text(`Exported ${exportDate} at ${exportTime}`, 3, 12);
            doc.setTextColor(17, 17, 17);

            const teamColors = PDF_SCHEMES.light.team;
            const verticalTeamName = teamName => String(teamName || '').split('').join('\n');
            const blendTowardWhite = (rgb, amount = 0.12) => {
                if (!Array.isArray(rgb) || rgb.length < 3) return [255, 255, 255];
                return rgb.slice(0, 3).map(channel => {
                    const numeric = Number(channel);
                    if (!Number.isFinite(numeric)) return 255;
                    return Math.max(0, Math.min(255, Math.round(numeric + (255 - numeric) * amount)));
                });
            };

            const fixedLeftCols = 1; // Name only (remove first rank column)
            const matchSchemas = allMatches.map(match => {
                const cols = ['home', 'away', 'pts'];
                if (match.jokerEligible) cols.push('joker');
                return { match, cols };
            });
            const matchColsCount = matchSchemas.reduce((sum, schema) => sum + schema.cols.length, 0);
            const summaryColsCount = 3; // Game Total, Total Tries, Final Rank
            const summaryStartIndex = fixedLeftCols + matchColsCount;
            const gameTotalCol = summaryStartIndex;
            const totalTriesCol = summaryStartIndex + 1;
            const finalRankCol = summaryStartIndex + 2;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const marginLR = 3;
            const tableStartY = 15;
            const tableBottomMargin = 3;
            // Reserve space for headers plus Result/Try Count rows so user rows can scale safely.
            const nonUserRowsReservedHeight = 34;
            const estimatedUserRowHeight = (pageHeight - tableStartY - tableBottomMargin - nonUserRowsReservedHeight) / Math.max(1, sortedUsers.length);
            const userRowMinHeight = Math.min(6.8, Math.max(3.6, estimatedUserRowHeight));
            const bodyFontSize = Math.min(8.2, Math.max(6.8, userRowMinHeight * 1.55));
            const headFontSize = Math.max(6.6, bodyFontSize - 0.4);
            const roundHeaderFontSize = Math.max(6.4, headFontSize - 0.1);
            const teamHeaderFontSize = Math.max(5.9, bodyFontSize - 1.2);

            const colMetaByIndex = {};
            let rollingMatchCol = fixedLeftCols;
            matchSchemas.forEach(schema => {
                schema.cols.forEach((kind, offset) => {
                    colMetaByIndex[rollingMatchCol + offset] = { kind, match: schema.match, offset, size: schema.cols.length };
                });
                rollingMatchCol += schema.cols.length;
            });

            const headerRowTop = [
                { content: 'Date /\nKO', styles: { halign: 'center', textColor: P.red, fontStyle: 'bold' } },
                ...matchSchemas.map(({ match, cols }) => ({
                    content: `R${match.round}\n${match.date}\n${match.time}`,
                    colSpan: cols.length,
                    styles: { halign: 'center', textColor: P.red, fontStyle: 'bold', fontSize: roundHeaderFontSize }
                })),
                { content: '', colSpan: 3, styles: { halign: 'center' } }
            ];

            const headerRowBottom = [
                { content: 'Name', styles: { halign: 'left', fontStyle: 'bold' } },
                ...matchSchemas.flatMap(({ match, cols }) => {
                    return cols.map(kind => {
                        if (kind === 'home') {
                            return {
                                content: verticalTeamName(match.team1),
                                styles: { halign: 'center', valign: 'middle', textColor: teamColors[match.team1] || P.blue, fontStyle: 'bold', fontSize: teamHeaderFontSize }
                            };
                        }
                        if (kind === 'away') {
                            return {
                                content: verticalTeamName(match.team2),
                                styles: { halign: 'center', valign: 'middle', textColor: teamColors[match.team2] || P.red, fontStyle: 'bold', fontSize: teamHeaderFontSize }
                            };
                        }
                        if (kind === 'pts') return { content: '', styles: { halign: 'center', fontStyle: 'bold' } };
                        return { content: '', styles: { halign: 'center', fontStyle: 'bold' } };
                    });
                }),
                { content: 'Game\nTotal', styles: { halign: 'center', fontStyle: 'bold' } },
                { content: 'Total\nTries', styles: { halign: 'center', fontStyle: 'bold', textColor: P.blue } },
                { content: 'Final\nRank', styles: { halign: 'center', fontStyle: 'bold' } }
            ];

            const totalActualTries = getTotalActualTries();
            const resultRow = [
                { content: 'Result', styles: { fontStyle: 'bold', halign: 'left', textColor: P.red } },
                ...matchSchemas.flatMap(({ match, cols }) => cols.map(kind => {
                    if (kind === 'home') return { content: match.actualScore1 !== null ? String(match.actualScore1) : '', styles: { fontStyle: 'bold' } };
                    if (kind === 'away') return { content: match.actualScore2 !== null ? String(match.actualScore2) : '', styles: { fontStyle: 'bold' } };
                    return { content: '', styles: {} };
                })),
                { content: '', styles: {} },
                { content: String(totalActualTries || ''), styles: { fontStyle: 'bold', textColor: P.blue } },
                { content: '', styles: {} }
            ];

            const tryCountRow = [
                { content: 'Try Count', styles: { fontStyle: 'bold', halign: 'left', textColor: [33, 107, 165] } },
                ...matchSchemas.flatMap(({ match, cols }) => {
                    const sum = match.actualTries1 !== null && match.actualTries2 !== null
                        ? match.actualTries1 + match.actualTries2
                        : null;
                    const cells = [
                        {
                            content: sum !== null ? String(sum) : '',
                            colSpan: 2,
                            styles: { fontStyle: 'bold', halign: 'center', textColor: P.green }
                        },
                        { content: 'Pts', styles: { fontStyle: 'bold', halign: 'center' } }
                    ];
                    if (cols.includes('joker')) cells.push({ content: 'Jkr', styles: { fontStyle: 'bold', halign: 'center' } });
                    return cells;
                }),
                { content: '', styles: {} },
                { content: '', styles: {} },
                { content: '', styles: {} }
            ];

            const userRows = sortedUsers.map((user, index) => {
                let rank = index + 1;
                if (index > 0 && sortedUsers[index - 1].totalPoints === user.totalPoints) {
                    rank = userRowsRankForTie(sortedUsers, index);
                }

                const row = [
                    { content: user.nickname, styles: { halign: 'left', fontStyle: 'bold' } }
                ];

                matchSchemas.forEach(({ match, cols }) => {
                    const pred = getViewablePrediction(user.username, match.id);
                    const isJoker = canSeePredictionsOf(user.username) && isUserJokerForMatch(user.username, match.id);
                    const pts = getMatchPoints(user.username, match);

                    if (!pred) {
                        cols.forEach(kind => {
                            if (kind === 'joker') row.push({ content: '', styles: {} });
                            else row.push({ content: '\u2014', styles: {} });
                        });
                        return;
                    }

                    cols.forEach(kind => {
                        if (kind === 'home') {
                            row.push({ content: String(pred.team1), styles: { fontStyle: 'bold' } });
                            return;
                        }
                        if (kind === 'away') {
                            row.push({ content: String(pred.team2), styles: { fontStyle: 'bold' } });
                            return;
                        }
                        if (kind === 'pts') {
                            row.push({ content: pts === null ? '' : String(pts), styles: { fontStyle: pts > 3 ? 'bold' : 'normal' } });
                            return;
                        }
                        row.push({ content: isJoker ? 'x' : '', styles: { fontStyle: 'bold' } });
                    });
                });

                row.push({ content: String(user.totalPoints), styles: { fontStyle: 'bold' } });
                row.push({ content: users[user.username].totalTries != null ? String(users[user.username].totalTries) : '\u2014', styles: { fontStyle: 'bold', textColor: P.blue } });
                row.push({ content: String(rank), styles: { fontStyle: 'bold' } });

                return row;
            });

            function userRowsRankForTie(sorted, idx) {
                for (let i = idx - 1; i >= 0; i--) {
                    if (sorted[i].totalPoints === sorted[idx].totalPoints) continue;
                    return i + 2;
                }
                return 1;
            }

            const tableWidth = pageWidth - marginLR * 2;
            const fixedWidth = 22 + 9 + 9 + 9;
            const matchColWidth = Math.max(4.2, (tableWidth - fixedWidth) / Math.max(1, matchColsCount));
            const colStyles = {
                0: { cellWidth: 22 }
            };
            for (let i = fixedLeftCols; i < summaryStartIndex; i++) colStyles[i] = { cellWidth: matchColWidth };
            colStyles[gameTotalCol] = { cellWidth: 9 };
            colStyles[totalTriesCol] = { cellWidth: 9 };
            colStyles[finalRankCol] = { cellWidth: 9 };

            doc.autoTable({
                head: [headerRowTop, headerRowBottom],
                body: [resultRow, tryCountRow, ...userRows],
                startY: tableStartY,
                theme: 'grid',
                pageBreak: 'avoid',
                rowPageBreak: 'avoid',
                tableWidth,
                styles: {
                    fontSize: bodyFontSize,
                    cellPadding: 0.25,
                    lineColor: P.border,
                    lineWidth: 0.35,
                    halign: 'center',
                    valign: 'middle',
                    overflow: 'hidden',
                    font: 'helvetica',
                    textColor: P.text
                },
                headStyles: {
                    fillColor: [246, 246, 246],
                    textColor: P.text,
                    fontStyle: 'bold',
                    fontSize: headFontSize,
                    cellPadding: 0.28,
                    lineColor: P.border,
                    lineWidth: 0.45
                },
                columnStyles: colStyles,
                didParseCell: function(data) {
                    const col = data.column.index;
                    const isUserRow = data.section === 'body' && data.row.index >= 2;
                    const isMetaRow = data.section === 'body' && data.row.index <= 1;
                    const colMeta = colMetaByIndex[col];
                    const isBody = data.section === 'body';
                    const userIndex = isUserRow ? data.row.index - 2 : -1;
                    const rowUser = userIndex >= 0 ? sortedUsers[userIndex] : null;
                    const shouldLightenAltRow = isUserRow && (userIndex % 2 === 1);

                    if (colMeta) {
                        if (isBody) {
                            if (colMeta.kind === 'home') data.cell.styles.fillColor = [255, 255, 255];
                            if (colMeta.kind === 'away') data.cell.styles.fillColor = [255, 255, 255];
                            if (colMeta.kind === 'pts') data.cell.styles.fillColor = P.pointsBg;
                            if (colMeta.kind === 'joker') data.cell.styles.fillColor = P.jokerBg;
                        } else {
                            data.cell.styles.fillColor = [246, 246, 246];
                        }

                        // Try Count row should be plain black text on white background.
                        if (isBody && data.row.index === 1) {
                            data.cell.styles.fillColor = [255, 255, 255];
                            data.cell.styles.textColor = P.text;
                        }

                        if (colMeta.kind === 'home' || colMeta.kind === 'away') data.cell.styles.fontStyle = 'bold';
                        if (colMeta.kind === 'pts' && isUserRow) data.cell.styles.textColor = [58, 50, 26];
                        if (colMeta.kind === 'joker') data.cell.styles.textColor = [35, 43, 56];
                        if (isBody && (colMeta.kind === 'home' || colMeta.kind === 'away' || colMeta.kind === 'pts')) {
                            data.cell.styles.fontSize = Math.min(bodyFontSize + 0.8, 10.6);
                        }

                        // Result row: color by winning/losing actual score, like prediction color coding.
                        if (isBody && data.row.index === 0 && (colMeta.kind === 'home' || colMeta.kind === 'away')) {
                            const match = colMeta.match;
                            if (match.actualScore1 !== null && match.actualScore2 !== null) {
                                const isDraw = match.actualScore1 === match.actualScore2;
                                const homeWins = match.actualScore1 > match.actualScore2;
                                const winningKind = homeWins ? 'home' : 'away';
                                const cellIsWinner = !isDraw && colMeta.kind === winningKind;
                                if (isDraw) {
                                    data.cell.styles.fillColor = P.predDrawBg;
                                    data.cell.styles.textColor = P.predDrawFg;
                                } else if (cellIsWinner) {
                                    data.cell.styles.fillColor = P.predWinBg;
                                    data.cell.styles.textColor = P.predWinFg;
                                } else {
                                    data.cell.styles.fillColor = P.predLoseBg;
                                    data.cell.styles.textColor = P.predLoseFg;
                                }
                            }
                        }

                        if (isUserRow && rowUser && (colMeta.kind === 'home' || colMeta.kind === 'away')) {
                            const pred = getViewablePrediction(rowUser.username, colMeta.match.id) || null;
                            if (pred) {
                                const isDraw = pred.team1 === pred.team2;
                                const isHomeWin = pred.team1 > pred.team2;
                                const winningKind = isHomeWin ? 'home' : 'away';
                                const cellIsWinner = !isDraw && colMeta.kind === winningKind;
                                if (isDraw) {
                                    data.cell.styles.fillColor = P.predDrawBg;
                                    data.cell.styles.textColor = P.predDrawFg;
                                } else if (cellIsWinner) {
                                    data.cell.styles.fillColor = P.predWinBg;
                                    data.cell.styles.textColor = P.predWinFg;
                                } else {
                                    data.cell.styles.fillColor = P.predLoseBg;
                                    data.cell.styles.textColor = P.predLoseFg;
                                }
                            }
                        }

                        const lw = typeof data.cell.styles.lineWidth === 'object'
                            ? data.cell.styles.lineWidth
                            : { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 };
                        if (colMeta.offset === 0) lw.left = 0.9;
                        if (colMeta.offset === colMeta.size - 1) lw.right = 0.9;
                        data.cell.styles.lineWidth = lw;
                    }

                    if (data.section === 'head' && data.row.index === 1 && colMeta && (colMeta.kind === 'home' || colMeta.kind === 'away')) {
                        data.cell.styles.minCellHeight = 12.5;
                    }

                    if (isUserRow) {
                        data.cell.styles.minCellHeight = userRowMinHeight;
                    }

                    // Use a bold divider line between Try Count and first player row.
                    if (isBody && data.row.index === 2) {
                        const lw = typeof data.cell.styles.lineWidth === 'object'
                            ? data.cell.styles.lineWidth
                            : { top: data.cell.styles.lineWidth || 0.35, bottom: data.cell.styles.lineWidth || 0.35, left: data.cell.styles.lineWidth || 0.35, right: data.cell.styles.lineWidth || 0.35 };
                        lw.top = Math.max(lw.top || 0.35, 0.9);
                        data.cell.styles.lineWidth = lw;
                    }

                    if (col === gameTotalCol && isBody) {
                        data.cell.styles.fillColor = P.gameTotalBg;
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (col === totalTriesCol && isBody) {
                        data.cell.styles.fillColor = P.triesBg;
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = P.blue;
                    }
                    if (col === finalRankCol) {
                        if (isUserRow) {
                            const rankValue = Number(data.cell.raw && data.cell.raw.content ? data.cell.raw.content : data.cell.text && data.cell.text[0]);
                            if (rankValue <= 3) data.cell.styles.fillColor = P.rankTopBg;
                            else if (rankValue <= 8) data.cell.styles.fillColor = P.rankMidBg;
                            else data.cell.styles.fillColor = P.rankLowBg;
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.fillColor = P.neutralBg;
                        }
                    }

                    if (shouldLightenAltRow) {
                        const currentFill = Array.isArray(data.cell.styles.fillColor)
                            ? data.cell.styles.fillColor
                            : [255, 255, 255];
                        const isNearWhite = currentFill.every(channel => Number(channel) >= 248);
                        const isWinCell = currentFill.length >= 3
                            && Number(currentFill[0]) === P.predWinBg[0]
                            && Number(currentFill[1]) === P.predWinBg[1]
                            && Number(currentFill[2]) === P.predWinBg[2];
                        const isLoseCell = currentFill.length >= 3
                            && Number(currentFill[0]) === P.predLoseBg[0]
                            && Number(currentFill[1]) === P.predLoseBg[1]
                            && Number(currentFill[2]) === P.predLoseBg[2];
                        data.cell.styles.fillColor = isNearWhite
                            ? [220, 220, 220]
                            : blendTowardWhite(currentFill, (isWinCell || isLoseCell) ? 0.58 : 0.45);
                    }

                    if (isMetaRow) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                margin: { top: 6, left: marginLR, right: marginLR, bottom: tableBottomMargin }
            });

            const filename = 'SixNations_Summary_' + now.toISOString().slice(0, 10) + '.pdf';
            if (openInBrowser) {
                const blobUrl = doc.output('bloburl');
                window.location.href = blobUrl;
                return;
            }
            // Desktop browsers tend to download the file straight away, so show it in a pop-up first with Print and Save.
            // Phones keep the usual behaviour (their own viewer / share sheet).
            if (isDesktopPointer()) {
                showPdfModal(doc, filename);
            } else {
                doc.save(filename);
            }
        }

        function isDesktopPointer() {
            return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
        }

        // PDF preview pop-up (desktop): the page in a frame, with Print and Save
        let pdfModalState = null;   // { doc, filename, url }

        function showPdfModal(doc, filename) {
            const modal = document.getElementById('pdfModal');
            const frame = document.getElementById('pdfPreviewFrame');
            if (!modal || !frame) { doc.save(filename); return; }
            closePdfModal();
            const url = URL.createObjectURL(doc.output('blob'));
            pdfModalState = { doc, filename, url };
            frame.src = url + '#toolbar=0&navpanes=0&view=FitH';
            modal.classList.remove('hidden');
            const printBtn = document.getElementById('pdfPrintBtn');
            if (printBtn) printBtn.focus();
        }

        function closePdfModal() {
            const modal = document.getElementById('pdfModal');
            const frame = document.getElementById('pdfPreviewFrame');
            if (modal) modal.classList.add('hidden');
            if (frame) frame.src = 'about:blank';
            if (pdfModalState) { URL.revokeObjectURL(pdfModalState.url); pdfModalState = null; }
        }

        function printPdfPreview() {
            if (!pdfModalState) return;
            const frame = document.getElementById('pdfPreviewFrame');
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } catch (error) {
                // The browser would not print from the frame: open the PDF in a tab, where Print works
                window.open(pdfModalState.url, '_blank');
            }
        }

        function savePdfPreview() {
            if (!pdfModalState) return;
            pdfModalState.doc.save(pdfModalState.filename);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && pdfModalState) closePdfModal();
        });

        function initTouchTooltips() {
            // Add click/touch handlers for tooltip containers
            document.querySelectorAll('.summary-container .tooltip-container').forEach(container => {
                container.addEventListener('click', function(e) {
                    // With chat on, tapping a prediction opens its chat sheet (which carries the points breakdown)
                    if (fixtureChat.available && container.closest('td[data-chat-user]')) return;
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
