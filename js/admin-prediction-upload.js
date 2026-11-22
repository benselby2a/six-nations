// Admin > Predictions: download a spreadsheet template for one competitor and upload it back, so an admin can enter a player's
// scores, Joker and total tries on their behalf. The file is checked first and shown as a preview; nothing is saved until the admin
// confirms. Saving goes through the same path as the Edit button on the same screen (Storage.savePredictions / saveUserJokerSelections).
// File reading and writing (.xlsx and .csv) is in js/xlsx-lite.js.

let adminUploadPlan = null;   // the checked upload waiting for the admin to confirm

const ADMIN_TEMPLATE_HEADER = ['Match id', 'Round', 'Date', 'Time', 'Home team', 'Away team', 'Home score', 'Away score', 'Joker'];

function syncAdminTemplateTools() {
    const box = document.getElementById('adminTemplateTools');
    if (!box) return;
    const username = adminPredictionUsername;
    const show = !!username && !!users[username];
    box.classList.toggle('hidden', !show);
    if (!show) { adminUploadPlan = null; clearAdminUploadPreview(); }
}

function clearAdminUploadPreview() {
    adminUploadPlan = null;
    const preview = document.getElementById('adminUploadPreview');
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
    const input = document.getElementById('adminUploadFile');
    if (input) input.value = '';
}

function setAdminUploadStatus(text, isError) {
    const el = document.getElementById('adminUploadStatus');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
}

// ---- the template ----
function buildAdminTemplate(username) {
    const user = users[username];
    const required = getRequiredJokerCount();
    const selected = new Set(getUserSelectedJokerMatchIds(username));
    const predictions = user.predictions || {};
    const rows = [];
    rows.push(['Six Nations Guesser - predictions template']);
    rows.push(['Season', Number(selectedYear)]);
    rows.push(['Player', getDisplayName(username)]);
    rows.push(['Username', username]);
    rows.push(['Total tries', user.totalTries === null || user.totalTries === undefined ? '' : user.totalTries]);
    rows.push(['Jokers allowed', required, required === 0 ? 'Jokers are switched off in the current rules.' : 'Only on fixtures marked Yes/No in the Joker column.']);
    rows.push(['Fill in the shaded cells: Total tries, Home score, Away score and (where the fixture allows it) Joker = Yes or No. Leave a cell blank to keep what is already saved.']);
    rows.push(['Do not change the Season, Username or Match id cells. Save the file as .xlsx or .csv and upload it on the same screen.']);
    rows.push([]);
    const headerRow = rows.length;
    rows.push(ADMIN_TEMPLATE_HEADER.slice());
    const inputCells = [{ row: 4, col: 1 }];
    const validations = [];
    const jokerCells = [];
    matches.forEach(match => {
        const prediction = predictions[match.id];
        const r = rows.length;
        const eligible = !!match.jokerEligible && required > 0;
        rows.push([
            match.id, match.round || '', match.date || '', match.time || '', match.team1, match.team2,
            prediction ? prediction.team1 : '', prediction ? prediction.team2 : '',
            eligible ? (selected.has(match.id) ? 'Yes' : 'No') : 'n/a'
        ]);
        inputCells.push({ row: r, col: 6 }, { row: r, col: 7 });
        if (eligible) { inputCells.push({ row: r, col: 8 }); jokerCells.push('I' + (r + 1)); }
    });
    const last = rows.length;
    if (matches.length) validations.push({ type: 'whole', sqref: `G${headerRow + 2}:H${last}`, formula: '0', title: 'Score', message: 'Enter a whole number of 0 or more, or leave blank.' });
    validations.push({ type: 'whole', sqref: 'B5', formula: '0', title: 'Total tries', message: 'Enter a whole number of 0 or more, or leave blank.' });
    if (jokerCells.length) validations.push({ type: 'list', sqref: jokerCells.join(' '), formula: '"Yes,No"', title: 'Joker', message: 'Choose Yes or No.' });
    return { rows, boldRows: [0, headerRow], inputCells, validations, headerRow, widths: [10, 7, 14, 8, 18, 18, 12, 12, 9] };
}

function downloadAdminBlob(bytes, type, filename) {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadPredictionTemplate(format) {
    const username = adminPredictionUsername;
    if (!username || !users[username]) { setAdminUploadStatus('Select a competitor first.', true); return; }
    const template = buildAdminTemplate(username);
    const base = `predictions-template-${selectedYear}-${username.replace(/[^a-z0-9_-]+/gi, '_')}`;
    if (format === 'csv') {
        downloadAdminBlob(toCsv(template.rows), 'text/csv;charset=utf-8', base + '.csv');
    } else {
        const bytes = writeXlsx({ sheetName: 'Predictions', rows: template.rows, boldRows: template.boldRows, inputCells: template.inputCells, validations: template.validations, widths: template.widths });
        downloadAdminBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base + '.xlsx');
    }
    setAdminUploadStatus(`Template for ${getDisplayName(username)} downloaded.`, false);
}

// ---- reading and checking an upload ----
const cellText = (value) => (value === null || value === undefined) ? '' : String(value).trim();

function parseWholeNumber(raw) {
    const text = cellText(raw);
    if (text === '') return { blank: true };
    const n = Number(text);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 999) return { error: true };
    return { value: n };
}

function parseJokerCell(raw) {
    const text = cellText(raw).toLowerCase();
    if (['yes', 'y', 'true', '1', 'x', 'joker'].includes(text)) return { value: true };
    if (['', 'no', 'n', 'false', '0', 'n/a', 'na', '-'].includes(text)) return { value: false };
    return { error: true };
}

// Turns the rows of a file into a checked plan: what would be saved, plus errors (block the save) and warnings.
function buildAdminUploadPlan(grid, username) {
    const plan = { username, errors: [], warnings: [], notes: [], rows: [], predictions: null, jokers: null, totalTries: undefined, triesChange: null, changed: 0, nameMismatch: false };
    const user = users[username];
    const currentPredictions = user.predictions || {};
    const required = getRequiredJokerCount();
    const labelRow = (label) => grid.find(row => cellText(row[0]).toLowerCase() === label);

    const seasonRow = labelRow('season');
    if (seasonRow) {
        const season = Number(cellText(seasonRow[1]));
        if (Number.isFinite(season) && season !== Number(selectedYear)) plan.errors.push(`This template is for the ${season} season but ${selectedYear} is selected. Nothing was read from it.`);
    }
    const nameRow = labelRow('username');
    if (nameRow && cellText(nameRow[1]) && cellText(nameRow[1]).toLowerCase() !== username) {
        plan.nameMismatch = true;
        plan.warnings.push(`This template was made for "${cellText(nameRow[1])}" but you are saving it for ${getDisplayName(username)}.`);
    }

    const headerIndex = grid.findIndex(row => cellText(row[0]).toLowerCase() === 'match id');
    if (headerIndex < 0) {
        plan.errors.push('The "Match id" header row was not found. Use the template downloaded from this screen.');
        return plan;
    }
    const header = grid[headerIndex].map(cell => cellText(cell).toLowerCase());
    const col = (name) => header.findIndex(h => h === name);
    const cMatch = col('match id'), cHome = col('home score'), cAway = col('away score'), cJoker = col('joker');
    const cTeam1 = col('home team'), cTeam2 = col('away team');
    if (cHome < 0 || cAway < 0) {
        plan.errors.push('The "Home score" and "Away score" columns were not found. Use the template downloaded from this screen.');
        return plan;
    }

    // total tries
    const triesRow = labelRow('total tries');
    if (triesRow) {
        const raw = triesRow.slice(1).map(cellText).find(v => v !== '');
        if (raw === undefined) plan.totalTries = undefined;
        else {
            const parsed = parseWholeNumber(raw);
            if (parsed.error) plan.errors.push(`Total tries "${raw}" must be a whole number of 0 or more.`);
            else plan.totalTries = parsed.value;
        }
    }
    const oldTries = (user.totalTries === null || user.totalTries === undefined) ? null : user.totalTries;
    if (plan.totalTries !== undefined && plan.totalTries !== oldTries) plan.triesChange = { from: oldTries, to: plan.totalTries };

    const byId = new Map(matches.map(m => [m.id, m]));
    const seen = new Set();
    const newPredictions = { ...currentPredictions };
    const jokerYes = new Set();
    const jokerRowsSeen = new Set();

    for (let i = headerIndex + 1; i < grid.length; i++) {
        const row = grid[i] || [];
        const excelRow = i + 1;
        const idText = cellText(row[cMatch]);
        const cells = [row[cHome], row[cAway], cJoker >= 0 ? row[cJoker] : ''].map(cellText);
        if (idText === '' && cells.every(v => v === '' || v.toLowerCase() === 'n/a')) continue;
        const id = Number(idText);
        if (idText === '' || !Number.isInteger(id)) { plan.errors.push(`Row ${excelRow}: the Match id is missing or not a number.`); continue; }
        const match = byId.get(id);
        if (!match) { plan.errors.push(`Row ${excelRow}: match id ${id} is not one of the ${selectedYear} fixtures.`); continue; }
        if (seen.has(id)) { plan.errors.push(`Row ${excelRow}: match id ${id} appears more than once.`); continue; }
        seen.add(id);
        const label = `${match.team1} v ${match.team2}`;
        if (cTeam1 >= 0 && cTeam2 >= 0) {
            const t1 = cellText(row[cTeam1]).toLowerCase(), t2 = cellText(row[cTeam2]).toLowerCase();
            if ((t1 && t1 !== String(match.team1).toLowerCase()) || (t2 && t2 !== String(match.team2).toLowerCase())) plan.warnings.push(`Row ${excelRow}: the teams in the file (${cellText(row[cTeam1])} v ${cellText(row[cTeam2])}) differ from the fixture (${label}). The Match id is used.`);
        }
        const s1 = parseWholeNumber(row[cHome]), s2 = parseWholeNumber(row[cAway]);
        const old = currentPredictions[id];
        const item = { matchId: id, label, round: match.round, oldText: old ? `${old.team1}-${old.team2}` : '--', newText: '', joker: null, status: 'same', completed: match.actualScore1 !== null && match.actualScore1 !== undefined && match.actualScore2 !== null && match.actualScore2 !== undefined };
        if (s1.error || s2.error) {
            plan.errors.push(`Row ${excelRow} (${label}): scores must be whole numbers of 0 or more (up to 999).`);
        } else if (s1.blank !== s2.blank) {
            plan.errors.push(`Row ${excelRow} (${label}): enter both scores, or leave both blank to keep the saved prediction.`);
        } else if (!s1.blank) {
            item.newText = `${s1.value}-${s2.value}`;
            newPredictions[id] = { team1: s1.value, team2: s2.value };
            item.status = !old ? 'new' : (old.team1 === s1.value && old.team2 === s2.value ? 'same' : 'changed');
            if (item.status !== 'same' && item.completed) plan.warnings.push(`${label} already has a result, so this changes ${getDisplayName(username)}'s points for it.`);
        } else {
            item.newText = old ? 'no change' : '--';
        }
        if (cJoker >= 0) {
            const joker = parseJokerCell(row[cJoker]);
            if (joker.error) plan.errors.push(`Row ${excelRow} (${label}): Joker must be Yes or No.`);
            else {
                jokerRowsSeen.add(id);
                if (joker.value) {
                    if (!match.jokerEligible) plan.errors.push(`Row ${excelRow} (${label}): this fixture is not Joker-eligible.`);
                    else if (required === 0) plan.errors.push(`Row ${excelRow} (${label}): Jokers are switched off in the current rules.`);
                    else jokerYes.add(id);
                }
                item.joker = joker.value;
            }
        }
        plan.rows.push(item);
    }
    if (plan.rows.length === 0 && plan.errors.length === 0) plan.errors.push('No fixture rows were found in the file.');

    // The file decides the Joker on every fixture it lists; Jokers on fixtures it does not list stay as they are.
    const before = getUserSelectedJokerMatchIds(username);
    const kept = before.filter(id => !jokerRowsSeen.has(id));
    const jokers = [...new Set([...kept, ...jokerYes])].sort((a, b) => a - b);
    if (jokers.length > required) plan.errors.push(`Too many Jokers: ${jokers.length} selected but only ${required} ${required === 1 ? 'is' : 'are'} allowed.`);
    jokers.forEach(id => { if (!newPredictions[id]) { const m = byId.get(id); plan.errors.push(`The Joker on ${m ? m.team1 + ' v ' + m.team2 : 'match ' + id} needs a prediction for that fixture.`); } });
    const jokersChanged = jokers.length !== before.length || jokers.some((id, k) => id !== before[k]);
    plan.jokers = { list: jokers, before, changed: jokersChanged };
    plan.predictions = newPredictions;
    plan.changed = plan.rows.filter(r => r.status === 'new' || r.status === 'changed').length + (plan.triesChange ? 1 : 0) + (jokersChanged ? 1 : 0);
    if (appSettings && appSettings.predictionsLocked) plan.notes.push('Predictions are locked for competitors. Admin entry still works.');
    return plan;
}

// ---- upload flow ----
async function readAdminUploadFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 4 * 1024 * 1024) throw new Error('That file is too large to be a prediction template.');
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) return await readXlsx(bytes);
    let text = new TextDecoder('utf-8').decode(bytes);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(bytes);
    return parseCsv(text);
}

async function onAdminUploadFileChosen(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const username = adminPredictionUsername;
    if (!username || !users[username]) { setAdminUploadStatus('Select a competitor first.', true); return; }
    setAdminUploadStatus('Reading the file...', false);
    try {
        const grid = await readAdminUploadFile(file);
        adminUploadPlan = buildAdminUploadPlan(grid, username);
        setAdminUploadStatus('', false);
        renderAdminUploadPreview();
    } catch (error) {
        adminUploadPlan = null;
        const preview = document.getElementById('adminUploadPreview');
        if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
        setAdminUploadStatus((error && error.message) || 'That file could not be read. Use the template downloaded from this screen.', true);
    }
}

function renderAdminUploadPreview() {
    const preview = document.getElementById('adminUploadPreview');
    const plan = adminUploadPlan;
    if (!preview || !plan) return;
    const name = escapeHtml(getDisplayName(plan.username));
    let html = `<h4 class="admin-upload-title">Check before saving for ${name}</h4>`;
    if (plan.errors.length) html += `<ul class="admin-upload-list admin-upload-errors" role="alert">${plan.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    if (plan.warnings.length) html += `<ul class="admin-upload-list admin-upload-warnings">${plan.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    if (plan.notes.length) html += `<ul class="admin-upload-list">${plan.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`;
    if (plan.rows.length) {
        html += '<div class="results-table-container"><table class="results-table admin-upload-table"><thead><tr><th>Fixture</th><th>Now</th><th>New</th><th>Joker</th></tr></thead><tbody>';
        plan.rows.forEach(row => {
            const isJoker = plan.jokers && plan.jokers.list.includes(row.matchId);
            html += `<tr class="admin-upload-${row.status}"><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.oldText)}</td><td>${escapeHtml(row.newText)}${row.status === 'new' ? ' (new)' : row.status === 'changed' ? ' (changed)' : ''}</td><td>${isJoker ? 'Yes' : ''}</td></tr>`;
        });
        html += '</tbody></table></div>';
    }
    if (plan.triesChange) html += `<p class="admin-upload-line">Total tries: ${plan.triesChange.from === null ? 'not set' : escapeHtml(plan.triesChange.from)} to <strong>${escapeHtml(plan.triesChange.to)}</strong></p>`;
    const canSave = plan.errors.length === 0 && plan.changed > 0;
    if (plan.errors.length === 0 && plan.changed === 0) html += '<p class="admin-upload-line">Nothing in this file differs from what is saved.</p>';
    if (plan.nameMismatch) html += '<label class="admin-upload-ack"><input type="checkbox" id="adminUploadAck" onchange="syncAdminUploadConfirm()"> Save it for this competitor anyway</label>';
    html += `<div class="admin-upload-actions"><button type="button" class="btn-small btn-success" id="adminUploadConfirm" onclick="confirmAdminUpload()" ${canSave && !plan.nameMismatch ? '' : 'disabled'}>Save${plan.changed ? ' ' + plan.changed + ' change' + (plan.changed === 1 ? '' : 's') : ''}</button><button type="button" class="btn-cancel" onclick="clearAdminUploadPreview()">Cancel</button></div>`;
    preview.innerHTML = html;
    preview.classList.remove('hidden');
}

function syncAdminUploadConfirm() {
    const plan = adminUploadPlan;
    const button = document.getElementById('adminUploadConfirm');
    const ack = document.getElementById('adminUploadAck');
    if (!plan || !button) return;
    button.disabled = !(plan.errors.length === 0 && plan.changed > 0 && (!plan.nameMismatch || (ack && ack.checked)));
}

async function confirmAdminUpload() {
    const plan = adminUploadPlan;
    if (!plan || plan.errors.length || !plan.changed) return;
    const username = plan.username;
    if (username !== adminPredictionUsername || !users[username]) { setAdminUploadStatus('The selected competitor changed. Upload the file again.', true); clearAdminUploadPreview(); return; }
    const button = document.getElementById('adminUploadConfirm');
    if (button) button.disabled = true;
    try {
        const tries = plan.totalTries !== undefined ? plan.totalTries : (users[username].totalTries === undefined ? null : users[username].totalTries);
        users[username].predictions = plan.predictions;
        users[username].totalTries = tries;
        await Storage.savePredictions(username, plan.predictions, tries);
        if (plan.jokers && plan.jokers.changed) {
            setUserSelectedJokerMatchIds(username, plan.jokers.list);
            await Storage.saveUserJokerSelections(username, plan.jokers.list);
        }
        const count = plan.changed;
        clearAdminUploadPreview();
        renderAdminScoreCorrections();
        setAdminUploadStatus(`Saved ${count} change${count === 1 ? '' : 's'} for ${getDisplayName(username)}.`, false);
    } catch (error) {
        console.error('Admin prediction upload failed:', error);
        setAdminUploadStatus('The predictions could not be saved. Check the connection and try again.', true);
        if (button) button.disabled = false;
    }
}
