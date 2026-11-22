// A very small .xlsx / .csv reader and writer, with no library. Used by the admin Predictions screen (js/admin-prediction-upload.js).
//   writeXlsx(options)  -> Uint8Array of a one-sheet workbook (a zip with STORED entries: no compression is needed to write)
//   readXlsx(bytes)     -> Promise of an array of rows (arrays of strings), the first sheet; reads Excel's own files (DEFLATE entries are
//                          inflated with the browser's DecompressionStream, shared strings and inline strings are both understood)
//   parseCsv(text)      -> array of rows (arrays of strings); comma, semicolon or tab separated, quotes and a BOM are handled
//   toCsv(rows)         -> text with a leading BOM so Excel opens it as UTF-8
// A grid is always an array of rows, each row an array of cell values (strings or numbers; null/undefined/'' are empty cells).

const XLSX_TEXT = new TextEncoder();

let xlsxCrcTable = null;
function xlsxCrc32(bytes) {
    if (!xlsxCrcTable) {
        xlsxCrcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            xlsxCrcTable[n] = c >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = xlsxCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// A zip with every file STORED (method 0)
function xlsxZip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
    files.forEach(file => {
        const name = XLSX_TEXT.encode(file.name);
        const data = typeof file.data === 'string' ? XLSX_TEXT.encode(file.data) : file.data;
        const crc = xlsxCrc32(data);
        const header = new Uint8Array([
            0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),   // version, UTF-8 names, stored, time, date (1980-01-01)
            ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)
        ]);
        parts.push(header, name, data);
        central.push({ name, crc, size: data.length, offset });
        offset += header.length + name.length + data.length;
    });
    const centralStart = offset;
    central.forEach(entry => {
        const header = new Uint8Array([
            0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
            ...u32(entry.crc), ...u32(entry.size), ...u32(entry.size), ...u16(entry.name.length), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0), ...u32(0), ...u32(entry.offset)
        ]);
        parts.push(header, entry.name);
        offset += header.length + entry.name.length;
    });
    const end = new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(offset - centralStart), ...u32(centralStart), ...u16(0)]);
    parts.push(end);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    parts.forEach(part => { out.set(part, at); at += part.length; });
    return out;
}

function xlsxEscape(value) {
    return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function xlsxColumnName(index) {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
}

// options: { sheetName, rows (grid), widths: [chars per column], boldRows: [row index], inputCells: [{ row, col }] (shaded: the cells to fill in),
//            validations: [{ type: 'whole'|'list', sqref: 'G10:H20', formula: '0' | '"Yes,No"', title, message }] }
function writeXlsx(options) {
    const rows = options.rows || [];
    const bold = new Set(options.boldRows || []);
    const inputs = new Set((options.inputCells || []).map(c => c.row + ':' + c.col));
    let sheetData = '';
    rows.forEach((row, r) => {
        let cells = '';
        row.forEach((value, c) => {
            if (value === null || value === undefined || value === '') {
                if (inputs.has(r + ':' + c)) cells += `<c r="${xlsxColumnName(c)}${r + 1}" s="2"/>`;
                return;
            }
            const ref = xlsxColumnName(c) + (r + 1);
            const style = inputs.has(r + ':' + c) ? 2 : (bold.has(r) ? 1 : 0);
            if (typeof value === 'number' && Number.isFinite(value)) cells += `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
            else cells += `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xlsxEscape(value)}</t></is></c>`;
        });
        sheetData += `<row r="${r + 1}">${cells}</row>`;
    });
    const cols = (options.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const validations = (options.validations || []).length
        ? `<dataValidations count="${options.validations.length}">` + options.validations.map(v =>
            `<dataValidation type="${v.type}"${v.type === 'whole' ? ' operator="greaterThanOrEqual"' : ''} allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="${xlsxEscape(v.title || 'Check this cell')}" error="${xlsxEscape(v.message || '')}" sqref="${v.sqref}"><formula1>${xlsxEscape(v.formula)}</formula1></dataValidation>`).join('') + '</dataValidations>'
        : '';
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + (cols ? `<cols>${cols}</cols>` : '') + `<sheetData>${sheetData}</sheetData>${validations}</worksheet>`;
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>'
        + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        + '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs>'
        + '</styleSheet>';
    const name = xlsxEscape((options.sheetName || 'Sheet1').slice(0, 31));
    return xlsxZip([
        { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
        { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
        { name: 'xl/styles.xml', data: styles },
        { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ]);
}

// ---- reading ----
async function xlsxInflate(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed .xlsx files. Save the sheet as CSV and upload that instead.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Every file in a zip, by name: { name: Uint8Array }. Reads the central directory, so entries with data descriptors work too.
async function xlsxUnzip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This does not look like an .xlsx file.');
    const count = view.getUint16(eocd + 10, true);
    let at = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const files = {};
    for (let n = 0; n < count; n++) {
        if (view.getUint32(at, true) !== 0x02014B50) throw new Error('The .xlsx file is damaged.');
        const method = view.getUint16(at + 10, true);
        const compressedSize = view.getUint32(at + 20, true);
        const nameLength = view.getUint16(at + 28, true);
        const extraLength = view.getUint16(at + 30, true);
        const commentLength = view.getUint16(at + 32, true);
        const localOffset = view.getUint32(at + 42, true);
        const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const raw = bytes.subarray(start, start + compressedSize);
        if (/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(name)) {
            files[name] = method === 0 ? raw : (method === 8 ? await xlsxInflate(raw) : null);
            if (!files[name]) throw new Error('The .xlsx file uses a compression this app cannot read. Save the sheet as CSV and upload that instead.');
        }
        at += 46 + nameLength + extraLength + commentLength;
    }
    return files;
}

function xlsxColumnIndex(ref) {
    const letters = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase();
    let index = 0;
    for (let i = 0; i < letters.length; i++) index = index * 26 + (letters.charCodeAt(i) - 64);
    return index - 1;
}

async function readXlsx(bytes) {
    const files = await xlsxUnzip(bytes);
    const decoder = new TextDecoder();
    const parse = (data) => new DOMParser().parseFromString(decoder.decode(data), 'application/xml');
    let sheetName = 'xl/worksheets/sheet1.xml';
    if (!files[sheetName]) sheetName = Object.keys(files).filter(n => /worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
    if (!sheetName) throw new Error('No sheet was found in the .xlsx file.');
    const shared = [];
    if (files['xl/sharedStrings.xml']) {
        const doc = parse(files['xl/sharedStrings.xml']);
        doc.querySelectorAll('si').forEach(si => { shared.push([...si.querySelectorAll('t')].map(t => t.textContent).join('')); });
    }
    const doc = parse(files[sheetName]);
    if (doc.querySelector('parsererror')) throw new Error('The sheet in the .xlsx file could not be read.');
    const rows = [];
    doc.querySelectorAll('sheetData > row').forEach(rowEl => {
        const rowIndex = (parseInt(rowEl.getAttribute('r'), 10) || (rows.length + 1)) - 1;
        const row = [];
        rowEl.querySelectorAll('c').forEach(cell => {
            const col = xlsxColumnIndex(cell.getAttribute('r'));
            const type = cell.getAttribute('t');
            let value = '';
            if (type === 's') value = shared[parseInt((cell.querySelector('v') || {}).textContent, 10)] || '';
            else if (type === 'inlineStr') value = [...cell.querySelectorAll('t')].map(t => t.textContent).join('');
            else { const v = cell.querySelector('v'); value = v ? v.textContent : ''; }
            if (col >= 0) row[col] = value;
        });
        while (rows.length < rowIndex) rows.push([]);
        rows[rowIndex] = Array.from(row, v => v === undefined ? '' : v);
    });
    return rows;
}

// ---- csv ----
function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    // The separator is whichever of comma, semicolon or tab (outside quotes) is most common in the first lines
    const counts = { ',': 0, ';': 0, '\t': 0 };
    text.split(/\r?\n/).slice(0, 20).forEach(line => {
        let quoted = false;
        for (const ch of line) { if (ch === '"') quoted = !quoted; else if (!quoted && counts[ch] !== undefined) counts[ch]++; }
    });
    const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
            else cell += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === delimiter) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

function toCsv(rows) {
    const cell = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
