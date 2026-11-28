// The "Classic" (Excel-styled) view of the Match Summary: the table drawn in HTML exactly like the PDF export (same layout, rules and colours),
// in a light scheme (identical to the PDF) and a dark scheme. Both colour sets are written into each cell as CSS variables,
// so switching the app between light and dark needs no redraw.
// Classic script (shared global scope); load order is set in js/load-order.txt.

const PDF_SCHEMES = {
    light: {
        P: {
            border: [84, 84, 84], text: [17, 17, 17], red: [200, 44, 44], blue: [34, 121, 196], green: [52, 137, 75],
            homeBg: [204, 234, 210], awayBg: [238, 201, 206],
            predWinBg: [198, 230, 206], predWinFg: [26, 110, 57], predLoseBg: [244, 199, 199], predLoseFg: [153, 27, 27],
            predDrawBg: [233, 233, 233], predDrawFg: [72, 72, 72],
            pointsBg: [236, 228, 202], jokerBg: [157, 190, 221], gameTotalBg: [163, 197, 142], triesBg: [234, 223, 205],
            rankTopBg: [40, 176, 96], rankMidBg: [238, 214, 128], rankLowBg: [239, 205, 182], neutralBg: [234, 234, 234],
            moverUp: [40, 176, 96], moverDown: [255, 49, 49]
        },
        team: { England: [34, 34, 34], France: [41, 143, 224], Ireland: [28, 148, 88], Italy: [0, 163, 224], Scotland: [120, 78, 185], Wales: [210, 44, 44] },
        sheet: [255, 255, 255], head: [246, 246, 246], white: [255, 255, 255], sub: [95, 95, 95],
        altBase: [220, 220, 220], altBlendTo: [255, 255, 255], pointsText: [58, 50, 26], jokerText: [35, 43, 56], tryLabel: [33, 107, 165]
    },
    dark: {
        P: {
            border: [74, 104, 88], text: [234, 243, 238], red: [255, 124, 124], blue: [108, 182, 255], green: [112, 214, 152],
            homeBg: [30, 70, 46], awayBg: [90, 40, 40],
            predWinBg: [28, 78, 48], predWinFg: [140, 232, 170], predLoseBg: [96, 36, 36], predLoseFg: [255, 172, 172],
            predDrawBg: [58, 64, 60], predDrawFg: [214, 220, 216],
            pointsBg: [74, 66, 36], jokerBg: [38, 68, 102], gameTotalBg: [50, 82, 44], triesBg: [70, 60, 44],
            rankTopBg: [30, 128, 72], rankMidBg: [122, 102, 32], rankLowBg: [112, 72, 46], neutralBg: [40, 56, 48],
            moverUp: [40, 176, 96], moverDown: [255, 49, 49]
        },
        team: { England: [236, 236, 236], France: [96, 172, 240], Ireland: [64, 200, 132], Italy: [46, 190, 240], Scotland: [172, 132, 236], Wales: [255, 104, 104] },
        sheet: [11, 26, 20], head: [27, 53, 38], white: [18, 38, 28], sub: [157, 180, 167],
        altBase: [28, 52, 39], altBlendTo: [18, 38, 28], pointsText: [245, 230, 170], jokerText: [205, 228, 250], tryLabel: [120, 190, 240]
    }
};

const PDFV_MM = 3.7795;            // one millimetre of the A4 sheet, in pixels
const PDFV_SHEET_W = 297 * PDFV_MM;  // the sheet is drawn at A4 landscape size, then scaled to fit the screen

function pdfvRgb(c) { return `rgb(${c[0]}, ${c[1]}, ${c[2]})`; }
function pdfvSame(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function pdfvBlend(rgb, to, amount) { return rgb.map((ch, i) => Math.max(0, Math.min(255, Math.round(ch + (to[i] - ch) * amount)))); }

// The summary rows, in the order and with the ties the PDF uses
function pdfvSortedUsers() {
    return getParticipantUsernames()
        .map(username => ({ username, nickname: toTitleCase(users[username].nickname || username), totalPoints: calculatePoints(username) }))
        .sort((a, b) => b.totalPoints - a.totalPoints);
}

function buildPdfStyleViewHtml(matchList, sortedUsers) {
    const schemes = [['', PDF_SCHEMES.light], ['-d', PDF_SCHEMES.dark]];
    // Every length is written as calc(<px at full size> * --pdfv-k) so that the whole sheet scales with one variable (see applyPdfvScale)
    const px = (v) => `calc(${v.toFixed(2)}px * var(--pdfv-k, 1))`;
    const mm = (v) => px(v * PDFV_MM);
    const pt = (v) => px(v * 1.3333);

    const matchSchemas = matchList.map(match => ({ match, cols: match.jokerEligible ? ['home', 'away', 'pts', 'joker'] : ['home', 'away', 'pts'] }));
    const matchColsCount = matchSchemas.reduce((sum, schema) => sum + schema.cols.length, 0);
    // Sizes follow the PDF's own formulas (A4 landscape, in mm and pt)
    const pageHeight = 210, tableStartY = 15, tableBottomMargin = 3, nonUserRowsReservedHeight = 34;
    const estimatedUserRowHeight = (pageHeight - tableStartY - tableBottomMargin - nonUserRowsReservedHeight) / Math.max(1, sortedUsers.length);
    const userRowMinHeight = Math.min(6.8, Math.max(3.6, estimatedUserRowHeight));
    const bodyFont = Math.min(8.2, Math.max(6.8, userRowMinHeight * 1.55));
    const headFont = Math.max(6.6, bodyFont - 0.4);
    const roundHeaderFont = Math.max(6.4, headFont - 0.1);
    const teamHeaderFont = Math.max(5.9, bodyFont - 1.2);
    const scoreFont = Math.min(bodyFont + 0.8, 10.6);
    const tableWidth = 297 - 3 * 2;
    const matchColWidth = Math.max(4.2, (tableWidth - (22 + 9 + 9 + 9)) / Math.max(1, matchColsCount));
    const totalActualTries = getTotalActualTries();

    // One cell. paint(scheme) gives its fill and text colour in that scheme; both are written out as variables.
    const cell = ({ content = '', colspan = 1, paint, bold = false, size = bodyFont, align = 'center', valign = 'middle', borders = '', stack = false, pin = false, data = '' }) => {
        const vars = schemes.map(([suffix, S]) => { const c = paint(S); return `--bg${suffix}:${pdfvRgb(c.fill)};--fg${suffix}:${pdfvRgb(c.text)}`; }).join(';');
        const inner = stack
            ? String(content).split('').map(ch => `<span>${escapeHtml(ch)}</span>`).join('')
            : escapeHtml(String(content)).replace(/\n/g, '<br>');
        // The grid lines are not CSS borders (a border is never drawn thinner than 1 CSS pixel, which made the small fitted sheet heavy and squashed);
        // they are inset shadows, so they stay true hairlines at any scale. Each cell draws half of each of its four lines (--bt/--br/--bb/--bl), so
        // two neighbours together draw one line. The border-width declarations in `borders` are turned into those variables here.
        const sideVar = { '': ['--bt', '--br', '--bb', '--bl'], '-top': ['--bt'], '-right': ['--br'], '-bottom': ['--bb'], '-left': ['--bl'] };
        const lineVars = [];
        const rest = String(borders).replace(/border(-top|-right|-bottom|-left)?-width:([^;]+);/g, (m, side, width) => { (sideVar[side || ''] || []).forEach(v => lineVars.push(`${v}:${width.trim()}`)); return ''; });
        return `<td${colspan > 1 ? ` colspan="${colspan}"` : ''} class="pdfv-c${stack ? ' pdfv-stack' : ''}${pin ? ' pdfv-pinned' : ''}${data ? ' pdfv-click' : ''}"${data ? ' ' + data : ''} style="${vars};${lineVars.join(';')}${lineVars.length ? ';' : ''}font-size:${pt(size)};font-weight:${bold ? 700 : 400};text-align:${align};vertical-align:${valign};${rest}">${inner}</td>`;
    };
    const THIN = mm(0.35), HEAD = mm(0.45), BOLD = mm(0.9);
    // The heavier lines at the left and right edge of each match group
    const edge = (colMeta, head) => {
        let b = '';
        if (colMeta && colMeta.offset === 0) b += `border-left-width:${BOLD};`;
        if (colMeta && colMeta.offset === colMeta.size - 1) b += `border-right-width:${BOLD};`;
        return b + (head ? `border-top-width:${HEAD};border-bottom-width:${HEAD};` : '');
    };

    // ---- header rows
    let head1 = cell({ pin: true, content: 'Date /\nKO', bold: true, size: headFont, paint: (S) => ({ fill: S.head, text: S.P.red }), borders: `border-width:${HEAD};` });
    matchSchemas.forEach(({ match, cols }) => {
        head1 += cell({ content: `R${match.round}\n${match.date}\n${match.time}`, colspan: cols.length, bold: true, size: roundHeaderFont, paint: (S) => ({ fill: S.head, text: S.P.red }), borders: `border-width:${HEAD};border-left-width:${BOLD};border-right-width:${BOLD};` });
    });
    head1 += cell({ colspan: 3, paint: (S) => ({ fill: S.head, text: S.P.text }), borders: `border-width:${HEAD};` });

    let head2 = cell({ pin: true, content: 'Name', bold: true, size: headFont, align: 'left', paint: (S) => ({ fill: S.head, text: S.P.text }), borders: `border-width:${HEAD};` });
    matchSchemas.forEach(({ match, cols }) => {
        cols.forEach((kind, offset) => {
            const colMeta = { kind, offset, size: cols.length };
            if (kind === 'home' || kind === 'away') {
                const team = kind === 'home' ? match.team1 : match.team2;
                head2 += cell({ content: team, stack: true, bold: true, size: teamHeaderFont, paint: (S) => ({ fill: S.head, text: S.team[team] || (kind === 'home' ? S.P.blue : S.P.red) }), borders: `border-width:${HEAD};${edge(colMeta, false)}height:${mm(9)};` });
            } else {
                head2 += cell({ bold: true, size: headFont, paint: (S) => ({ fill: S.head, text: S.P.text }), borders: `border-width:${HEAD};${edge(colMeta, false)}` });
            }
        });
    });
    head2 += cell({ content: 'Game\nTotal', bold: true, size: headFont, paint: (S) => ({ fill: S.head, text: S.P.text }), borders: `border-width:${HEAD};` });
    head2 += cell({ content: 'Total\nTries', bold: true, size: headFont, paint: (S) => ({ fill: S.head, text: S.P.blue }), borders: `border-width:${HEAD};` });
    head2 += cell({ content: 'Final\nRank', bold: true, size: headFont, paint: (S) => ({ fill: S.head, text: S.P.text }), borders: `border-width:${HEAD};` });

    // ---- Result and Try Count rows
    const resultPaint = (score1, score2, kind) => (S) => {
        if (score1 === null || score2 === null) return { fill: S.white, text: S.P.text };
        if (score1 === score2) return { fill: S.P.predDrawBg, text: S.P.predDrawFg };
        const winner = score1 > score2 ? 'home' : 'away';
        return kind === winner ? { fill: S.P.predWinBg, text: S.P.predWinFg } : { fill: S.P.predLoseBg, text: S.P.predLoseFg };
    };
    const tail = (rowKind) => {
        const gt = cell({ paint: (S) => ({ fill: S.P.gameTotalBg, text: S.P.text }), bold: true });
        const tr = cell({ content: rowKind === 'result' ? String(totalActualTries || '') : '', paint: (S) => ({ fill: S.P.triesBg, text: S.P.blue }), bold: true });
        const rk = cell({ paint: (S) => ({ fill: S.P.neutralBg, text: S.P.text }), bold: true });
        return gt + tr + rk;
    };
    let resultRow = cell({ pin: true, content: 'Result', bold: true, align: 'left', paint: (S) => ({ fill: S.white, text: S.P.red }) });
    matchSchemas.forEach(({ match, cols }) => cols.forEach((kind, offset) => {
        const colMeta = { kind, offset, size: cols.length };
        if (kind === 'home' || kind === 'away') {
            const score = kind === 'home' ? match.actualScore1 : match.actualScore2;
            resultRow += cell({ content: score !== null ? String(score) : '', bold: true, size: scoreFont, paint: resultPaint(match.actualScore1, match.actualScore2, kind), borders: edge(colMeta) });
        } else if (kind === 'pts') {
            resultRow += cell({ bold: true, size: scoreFont, paint: (S) => ({ fill: S.P.pointsBg, text: S.P.text }), borders: edge(colMeta) });
        } else {
            resultRow += cell({ bold: true, paint: (S) => ({ fill: S.P.jokerBg, text: S.P.text }), borders: edge(colMeta) });
        }
    }));
    resultRow += tail('result');

    let tryRow = cell({ pin: true, content: 'Try Count', bold: true, align: 'left', paint: (S) => ({ fill: S.white, text: S.tryLabel }) });
    matchSchemas.forEach(({ match, cols }) => {
        const sum = match.actualTries1 !== null && match.actualTries2 !== null ? match.actualTries1 + match.actualTries2 : null;
        tryRow += cell({ content: sum !== null ? String(sum) : '', colspan: 2, bold: true, paint: (S) => ({ fill: S.white, text: S.P.green }), borders: `border-left-width:${BOLD};` });
        tryRow += cell({ content: 'Pts', bold: true, paint: (S) => ({ fill: S.white, text: S.P.text }), borders: cols.includes('joker') ? '' : `border-right-width:${BOLD};` });
        if (cols.includes('joker')) tryRow += cell({ content: 'Jkr', bold: true, paint: (S) => ({ fill: S.white, text: S.P.text }), borders: `border-right-width:${BOLD};` });
    });
    tryRow += tail('try');

    // ---- player rows
    const rankFor = (idx) => {
        let rank = idx + 1;
        if (idx > 0 && sortedUsers[idx - 1].totalPoints === sortedUsers[idx].totalPoints) {
            rank = 1;
            for (let i = idx - 1; i >= 0; i--) { if (sortedUsers[i].totalPoints === sortedUsers[idx].totalPoints) continue; rank = i + 2; break; }
        }
        return rank;
    };
    const userHtml = sortedUsers.map((user, index) => {
        const alt = index % 2 === 1;
        const rank = rankFor(index);
        const topBorder = index === 0 ? `border-top-width:${BOLD};` : '';
        const minH = `height:${mm(userRowMinHeight)};`;
        // Every other row is lightened, exactly as the PDF does it
        const tone = (paintFn) => (S) => {
            const c = paintFn(S);
            if (!alt) return c;
            const isWin = pdfvSame(c.fill, S.P.predWinBg), isLose = pdfvSame(c.fill, S.P.predLoseBg);
            return { fill: pdfvSame(c.fill, S.white) ? S.altBase : pdfvBlend(c.fill, S.altBlendTo, (isWin || isLose) ? 0.58 : 0.45), text: c.text };
        };
        let row = cell({ pin: true, content: user.nickname, bold: true, align: 'left', paint: tone((S) => ({ fill: S.white, text: S.P.text })), borders: topBorder + minH });
        matchSchemas.forEach(({ match, cols }) => {
            const pred = getViewablePrediction(user.username, match.id);
            const isJoker = canSeePredictionsOf(user.username) && isUserJokerForMatch(user.username, match.id);
            // a player's prediction cells open the Excel-style detail window (only where their prediction may be seen: never before the lock for others)
            const clickData = canSeePredictionsOf(user.username) ? `data-pred-user="${escapeHtml(user.username)}" data-pred-match="${match.id}"` : '';
            cols.forEach((kind, offset) => {
                const colMeta = { kind, offset, size: cols.length };
                const borders = topBorder + minH + edge(colMeta);
                if (kind === 'home' || kind === 'away') {
                    const paintFn = (S) => {
                        if (!pred) return { fill: S.white, text: S.P.text };
                        const isDraw = pred.team1 === pred.team2;
                        const winner = pred.team1 > pred.team2 ? 'home' : 'away';
                        if (isDraw) return { fill: S.P.predDrawBg, text: S.P.predDrawFg };
                        return kind === winner ? { fill: S.P.predWinBg, text: S.P.predWinFg } : { fill: S.P.predLoseBg, text: S.P.predLoseFg };
                    };
                    row += cell({ content: pred ? String(kind === 'home' ? pred.team1 : pred.team2) : '—', bold: true, size: scoreFont, paint: tone(paintFn), borders, data: clickData });
                } else if (kind === 'pts') {
                    const pts = pred ? calculateMatchPoints(pred, match, isJoker) : null;
                    row += cell({ content: !pred ? '—' : (pts === null ? '' : String(pts)), bold: pts > 3, size: scoreFont, paint: tone((S) => ({ fill: S.P.pointsBg, text: S.pointsText })), borders, data: clickData });
                } else {
                    row += cell({ content: pred && isJoker ? 'x' : '', bold: true, paint: tone((S) => ({ fill: S.P.jokerBg, text: S.jokerText })), borders, data: clickData });
                }
            });
        });
        const tries = users[user.username].totalTries;
        row += cell({ content: String(user.totalPoints), bold: true, paint: tone((S) => ({ fill: S.P.gameTotalBg, text: S.P.text })), borders: topBorder + minH });
        row += cell({ content: tries != null ? String(tries) : '—', bold: true, paint: tone((S) => ({ fill: S.P.triesBg, text: S.P.blue })), borders: topBorder + minH });
        row += cell({ content: String(rank), bold: true, paint: tone((S) => ({ fill: rank <= 3 ? S.P.rankTopBg : (rank <= 8 ? S.P.rankMidBg : S.P.rankLowBg), text: S.P.text })), borders: topBorder + minH });
        return `<tr>${row}</tr>`;
    }).join('');

    // The Pts column is about 2px wider so 'Pts' never touches the heavy line on its right; the two team columns give up the same width between them
    const ptsExtra = 0.55;
    const colWidth = (kind, cols) => kind === 'pts' ? matchColWidth + ptsExtra : (kind === 'home' || kind === 'away') ? matchColWidth - ptsExtra / 2 : matchColWidth;
    const colgroup = `<col style="width:${mm(22)}">` + matchSchemas.map(({ cols }) => cols.map(kind => `<col style="width:${mm(colWidth(kind, cols))}">`).join('')).join('') + `<col style="width:${mm(9)}"><col style="width:${mm(9)}"><col style="width:${mm(9)}">`;
    // "Updated Sat, 21 Nov 2026 at 07:26": the day and time the data was last fetched, worded like the export's "Exported ... at ..."
    const stamp = new Date(typeof lastDataRefreshAt === 'number' ? lastDataRefreshAt : Date.now());
    const updated = `${stamp.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} at ${stamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    return `<div class="pdfv-wrap" id="pdfViewWrap"><div class="pdfv-stage" id="pdfViewStage"><div class="pdfv-sheet" id="pdfViewSheet" style="width:${px(PDFV_SHEET_W)};padding:${mm(3)}">`
        + `<div class="pdfv-title">${escapeHtml(String(selectedYear || stamp.getFullYear()))} Six Nations Guesser</div>`
        + `<div class="pdfv-sub">Updated ${updated}</div>`
        + `<table class="pdfv-table" style="width:${mm(tableWidth)}"><colgroup>${colgroup}</colgroup>`
        + `<thead><tr>${head1}</tr><tr>${head2}</tr></thead><tbody><tr>${resultRow}</tr><tr>${tryRow}</tr>${userHtml}</tbody></table></div></div></div>`;
}

// The sheet starts fitted to the width of its box. Pinch (two fingers) or the +/- buttons zoom it; drag to move around it.
// The box scrolls sideways by itself when zoomed in (the browser's own page zoom cannot pan a transformed sheet reliably on iPhone).
let pdfvZoom = null;   // null = fitted; otherwise the chosen scale
const PDFV_MAX_ZOOM = 4;
function pdfvFitScale(wrap) { return Math.min(1.6, wrap.clientWidth / PDFV_SHEET_W); }
// The sheet is scaled by one CSS variable (--pdfv-k) that every length in it is multiplied by, not by CSS zoom or a transform. It takes up its real
// scaled size, so the box scrolls sideways natively and the first column (Date / KO, Name, Result, Try Count) stays at the left edge with plain
// `position: sticky` (no scroll-event syncing). CSS zoom was tried and looked squashed: browsers keep every border at least 1 CSS pixel thick under
// zoom, so at the small fit scale the hairlines became heavy and ate the cells. With calc() the borders stay true hairlines, as in the PDF.
function applyPdfvScale(k) {
    const wrap = document.getElementById('pdfViewWrap');
    const sheet = document.getElementById('pdfViewSheet');
    if (!wrap || !sheet) return;
    sheet.style.setProperty('--pdfv-k', k.toFixed(4));
    wrap.dataset.zoomed = k > pdfvFitScale(wrap) + 0.01 ? '1' : '';
}
function currentPdfvScale() {
    const wrap = document.getElementById('pdfViewWrap');
    const fit = wrap && wrap.clientWidth ? pdfvFitScale(wrap) : 1;
    return Math.max(fit, Math.min(PDFV_MAX_ZOOM, pdfvZoom || fit));
}
function fitPdfView() {
    const wrap = document.getElementById('pdfViewWrap');
    const sheet = document.getElementById('pdfViewSheet');
    if (!wrap || !sheet) return;
    if (!wrap.dataset.watched) {
        wrap.dataset.watched = '1';
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitPdfView()).observe(wrap);   // also when the tab is shown or the window changes
        enablePdfvPinch(wrap);
        enablePdfvCellClicks(wrap);
    }
    if (!wrap.clientWidth) return;   // not visible yet
    applyPdfvScale(currentPdfvScale());
}
// +/- buttons (factor), and Fit (0)
function zoomPdfView(factor) {
    const wrap = document.getElementById('pdfViewWrap');
    if (!wrap || !wrap.clientWidth) return;
    const before = currentPdfvScale();
    pdfvZoom = factor === 0 ? null : Math.max(pdfvFitScale(wrap), Math.min(PDFV_MAX_ZOOM, before * factor));
    const k = currentPdfvScale();
    const centre = (wrap.scrollLeft + wrap.clientWidth / 2) / before;   // keep what is in the middle in the middle
    applyPdfvScale(k);
    wrap.scrollLeft = Math.max(0, centre * k - wrap.clientWidth / 2);
}
// Two-finger pinch on the sheet: zoom around the point between the fingers
function enablePdfvPinch(wrap) {
    let start = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) { start = null; return; }
        const rect = wrap.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const k0 = currentPdfvScale();
        start = { d0: dist(e.touches), k0, cx, contentX: (wrap.scrollLeft + cx) / k0 };
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
        if (!start || e.touches.length !== 2) return;
        e.preventDefault();   // our zoom, not the page's
        const fit = pdfvFitScale(wrap);
        const k = Math.max(fit, Math.min(PDFV_MAX_ZOOM, start.k0 * dist(e.touches) / start.d0));
        pdfvZoom = k;
        applyPdfvScale(k);
        wrap.scrollLeft = Math.max(0, start.contentX * k - start.cx);
    }, { passive: false });
    const end = (e) => { if (e.touches.length < 2) start = null; };
    wrap.addEventListener('touchend', end, { passive: true });
    wrap.addEventListener('touchcancel', end, { passive: true });
}
window.addEventListener('resize', fitPdfView);


// ---- Click a player's prediction: an Excel-style window with how the points were made (the same numbers as the summary's scoring) ----
// The window is drawn at the top level of the page (outside the scaled sheet), at normal size, in the sheet's own colours.
function enablePdfvCellClicks(wrap) {
    let down = null, pinched = false;
    wrap.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; });
    wrap.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true; });
    wrap.addEventListener('touchstart', (e) => { if (e.touches.length > 1) pinched = true; }, { passive: true });
    wrap.addEventListener('touchend', (e) => { if (e.touches.length === 0) setTimeout(() => { pinched = false; }, 350); }, { passive: true });
    wrap.addEventListener('click', (e) => {
        const cell = e.target.closest && e.target.closest('td[data-pred-user]');
        if (!cell || !wrap.contains(cell)) return;
        if ((down && down.moved) || pinched) { down = null; return; }   // a scroll, drag or pinch is not a click
        down = null;
        pdfvOpenCellWindow(cell.dataset.predUser, Number(cell.dataset.predMatch), cell);
    });
}

let pdfvWindowOpener = null, pdfvWindowPrevOverflow = '';
function pdfvCloseCellWindow() {
    const box = document.getElementById('pdfvCellWindow');
    if (!box) return;
    box.remove();
    document.removeEventListener('keydown', pdfvWindowKeys, true);
    if (!document.body.classList.contains('tour-open')) document.body.style.overflow = pdfvWindowPrevOverflow;
    document.querySelectorAll('.pdfv-selected').forEach(el => el.classList.remove('pdfv-selected'));
    if (pdfvWindowOpener && document.contains(pdfvWindowOpener)) { try { pdfvWindowOpener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    pdfvWindowOpener = null;
}
function pdfvWindowKeys(e) {
    const box = document.getElementById('pdfvCellWindow');
    if (!box) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pdfvCloseCellWindow(); return; }
    if (e.key === 'Tab') { e.preventDefault(); const btn = box.querySelector('.xl-close'); if (btn) btn.focus(); }   // the close button is the only control: keep focus inside the window
}

function pdfvCellWindowData(username, matchId) {
    const match = matches.find(m => m.id === matchId);
    const user = users[username];
    if (!match || !user) return null;
    const pred = getViewablePrediction(username, matchId);
    const played = match.actualScore1 !== null && match.actualScore2 !== null;
    const joker = isUserJokerForMatch(username, matchId);
    const rules = getEffectiveScoringRules();
    const b = pred ? getMatchPointsBreakdown(pred, match, joker) : null;
    const rows = [];
    const yn = (v) => v ? 'Yes' : 'No';
    if (played && pred && b) {
        const close = (b.team1CloseBonus || 0) + (b.team2CloseBonus || 0);
        const draw = getResult(match.actualScore1, match.actualScore2) === 'draw';
        rows.push(['Correct result', yn(b.correctResult), b.correctResult ? rules.correctResultPoints : 0]);
        rows.push(['Perfect score bonus', yn(b.perfectScore), b.perfectScore ? rules.perfectScoreBonus : 0]);
        rows.push(['Draw bonus', draw ? yn(b.correctResult) : 'n/a', b.drawBonus || 0]);
        const closeNames = [b.team1CloseBonus ? match.team1 : '', b.team2CloseBonus ? match.team2 : ''].filter(Boolean).join(' + ');
        rows.push(['Close score bonus', closeNames || 'No', close]);
        rows.push(['Joker', joker ? (b.jokerApplied ? 'x2' : 'x2 (nothing to double)') : 'Not played', b.jokerApplied ? b.basePoints : 0]);
    }
    return { match, user, pred, played, joker, b, rows };
}

function pdfvOpenCellWindow(username, matchId, opener) {
    const d = pdfvCellWindowData(username, matchId);
    if (!d) return;
    pdfvCloseCellWindow();
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const S = dark ? PDF_SCHEMES.dark : PDF_SCHEMES.light, P = S.P;
    const { match, user, pred, played, joker, b, rows } = d;
    const name = toTitleCase(user.nickname || username);
    const predText = pred ? `${pred.team1} - ${pred.team2}` : 'No prediction';
    const resultText = played ? `${match.actualScore1} - ${match.actualScore2}` : 'Not played yet';
    let fill = S.white;
    if (pred) {
        if (pred.team1 === pred.team2) fill = P.predDrawBg;
        else if (!played) fill = P.pointsBg;
        else fill = (pred.team1 > pred.team2) === (match.actualScore1 > match.actualScore2) && match.actualScore1 !== match.actualScore2 ? P.predWinBg : P.predLoseBg;
    }
    const vars = [['--xl-border', P.border], ['--xl-text', P.text], ['--xl-red', P.red], ['--xl-blue', P.blue], ['--xl-head', S.head], ['--xl-sheet', S.white], ['--xl-total', P.gameTotalBg], ['--xl-pred', fill], ['--xl-sub', S.sub]]
        .map(([k, c]) => `${k}:${pdfvRgb(c)}`).join(';');
    const total = b ? b.points : 0;
    const gridRows = [
        ['Match', `${match.team1} v ${match.team2}`, ''],
        ['Player', name, ''],
        ['Prediction', predText, '', 'pred'],
        ['Result', resultText, '']
    ].concat(rows.map(r => [r[0], r[1], String(r[2])]))
        .concat(played && pred ? [['Total points', '', String(total), 'total']] : [])
        .concat(match.actualTries1 !== null && match.actualTries2 !== null ? [['Tries in match', String(match.actualTries1 + match.actualTries2), '']] : [])
        .concat(user.totalTries != null ? [['Tries guess (season)', String(user.totalTries), '']] : []);
    const cells = gridRows.map((r, i) => `<tr class="${r[3] ? 'xl-' + r[3] : ''}"><td class="xl-label">${escapeHtml(r[0])}</td><td class="xl-value">${escapeHtml(r[1])}</td><td class="xl-pts">${escapeHtml(r[2])}</td></tr>`).join('');
    const box = document.createElement('div');
    box.id = 'pdfvCellWindow';
    box.className = 'xl-backdrop';
    box.setAttribute('style', vars);
    box.innerHTML = `<div class="xl-window" role="dialog" aria-modal="true" aria-labelledby="xlTitle" tabindex="-1">
        <div class="xl-titlebar"><span class="xl-title" id="xlTitle">${escapeHtml(name)} - ${escapeHtml(match.team1)} v ${escapeHtml(match.team2)}</span><button type="button" class="xl-close" aria-label="Close">x</button></div>
        <div class="xl-scroll"><table class="xl-grid"><tbody>${cells}</tbody></table></div>
    </div>`;
    document.body.appendChild(box);
    pdfvWindowPrevOverflow = document.body.style.overflow;
    if (!document.body.classList.contains('tour-open')) document.body.style.overflow = 'hidden';
    pdfvWindowOpener = opener;
    if (opener) { opener.setAttribute('tabindex', '-1'); opener.classList.add('pdfv-selected'); }
    document.addEventListener('keydown', pdfvWindowKeys, true);
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.xl-close')) pdfvCloseCellWindow(); });
    const btn = box.querySelector('.xl-close');
    if (btn) btn.focus({ preventScroll: true });
}
