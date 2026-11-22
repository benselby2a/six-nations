// A small, dependency-free reader for the old binary Excel format (.xls, BIFF8 inside an OLE2 "compound file"), plus the two other
// things Excel and other tools often save with an .xls name: SpreadsheetML 2003 (XML) and an HTML table.
// Every reader returns the same shape as readXlsx() in js/xlsx-lite.js: an array of rows, each an array of strings.
// It reads only the first worksheet (or the one called "Predictions") and only the cell values the template needs
// (text, numbers, formula results); styles, dates, merged cells and everything else are ignored.

const XLS_OLE_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

function xlsIsOle(bytes) {
    return bytes.length >= 8 && XLS_OLE_SIGNATURE.every((b, i) => bytes[i] === b);
}

// ---- the OLE2 container: find a stream by name ----
function xlsReadOleStream(bytes, wanted) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (o) => view.getUint16(o, true);
    const u32 = (o) => view.getUint32(o, true);
    if (bytes.length < 512 || !xlsIsOle(bytes)) throw new Error('Not an OLE file');
    const sectorSize = 1 << u16(0x1E);
    const miniSectorSize = 1 << u16(0x20);
    if (sectorSize !== 512 && sectorSize !== 4096) throw new Error('Unsupported sector size');
    const fatCount = u32(0x2C);
    const dirStart = u32(0x30);
    const miniCutoff = u32(0x38);
    const miniFatStart = u32(0x3C);
    let difatStart = u32(0x44);
    const difatCount = u32(0x48);
    const END = 0xFFFFFFFE;
    const maxSectors = Math.ceil(bytes.length / sectorSize) + 2;
    const sectorOffset = (n) => (n + 1) * sectorSize;
    const sectorOk = (n) => n < maxSectors && sectorOffset(n) + sectorSize <= bytes.length + sectorSize;

    // the list of sectors that hold the FAT: 109 in the header, then any DIFAT sectors
    const fatSectors = [];
    for (let i = 0; i < 109 && fatSectors.length < fatCount; i++) { const s = u32(0x4C + i * 4); if (s < END) fatSectors.push(s); }
    for (let d = 0; d < difatCount && difatStart < END && fatSectors.length < fatCount; d++) {
        if (!sectorOk(difatStart)) throw new Error('Bad DIFAT');
        const base = sectorOffset(difatStart);
        const perSector = sectorSize / 4 - 1;
        for (let i = 0; i < perSector && fatSectors.length < fatCount; i++) { const s = u32(base + i * 4); if (s < END) fatSectors.push(s); }
        difatStart = u32(base + perSector * 4);
    }
    const fat = [];
    fatSectors.forEach(s => {
        if (!sectorOk(s)) throw new Error('Bad FAT sector');
        const base = sectorOffset(s);
        for (let i = 0; i < sectorSize / 4; i++) fat.push(u32(base + i * 4));
    });
    const chain = (start, table) => {
        const list = [];
        let s = start;
        while (s < END && list.length <= maxSectors * 8) {
            if (s >= table.length) throw new Error('Bad sector chain');
            list.push(s);
            s = table[s];
        }
        return list;
    };
    const readChain = (start, size) => {
        const sectors = chain(start, fat);
        const out = new Uint8Array(sectors.length * sectorSize);
        sectors.forEach((s, i) => { if (!sectorOk(s)) throw new Error('Bad sector'); out.set(bytes.subarray(sectorOffset(s), sectorOffset(s) + sectorSize), i * sectorSize); });
        return size === null ? out : out.subarray(0, size);
    };

    // the directory: 128-byte entries
    const dir = readChain(dirStart, null);
    const dview = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    const entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
        const nameLen = dview.getUint16(o + 64, true);
        const type = dir[o + 66];
        if (!type) continue;
        let name = '';
        for (let i = 0; i + 1 < Math.min(nameLen, 64); i += 2) { const c = dview.getUint16(o + i, true); if (c) name += String.fromCharCode(c); }
        entries.push({ name, type, start: dview.getUint32(o + 116, true), size: dview.getUint32(o + 120, true) });
    }
    const root = entries.find(e => e.type === 5);
    const found = entries.find(e => e.type === 2 && wanted.includes(e.name));
    if (!found) throw new Error('No workbook stream');
    if (found.size >= miniCutoff) return readChain(found.start, found.size);

    // small streams live in the "mini stream" (inside the root entry's chain)
    if (!root) throw new Error('No root entry');
    const miniStream = readChain(root.start, root.size);
    const miniFatBytes = readChain(miniFatStart, null);
    const mview = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
    const miniFat = [];
    for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) miniFat.push(mview.getUint32(i, true));
    const sectors = chain(found.start, miniFat);
    const out = new Uint8Array(sectors.length * miniSectorSize);
    sectors.forEach((s, i) => { out.set(miniStream.subarray(s * miniSectorSize, (s + 1) * miniSectorSize), i * miniSectorSize); });
    return out.subarray(0, found.size);
}

// ---- BIFF8 records ----
function xlsRecords(stream) {
    const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
    const list = [];
    let pos = 0;
    while (pos + 4 <= stream.length) {
        const id = view.getUint16(pos, true);
        const len = view.getUint16(pos + 2, true);
        if (pos + 4 + len > stream.length) break;
        list.push({ id, pos, data: stream.subarray(pos + 4, pos + 4 + len) });
        pos += 4 + len;
    }
    return list;
}

function xlsNumberText(n) {
    if (!Number.isFinite(n)) return '';
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1e10) / 1e10);
}

function xlsRk(rk) {
    let value;
    if (rk & 2) value = rk >> 2;
    else {
        const b = new DataView(new ArrayBuffer(8));
        b.setUint32(4, (rk & 0xFFFFFFFC) >>> 0, true);
        value = b.getFloat64(0, true);
    }
    return (rk & 1) ? value / 100 : value;
}

// the text of a BIFF8 string with a 1-byte flags field already at data[offset] (no length): returns { text, end }
function xlsString(data, offset, length) {
    const flags = data[offset];
    const high = !!(flags & 1), ext = !!(flags & 4), rich = !!(flags & 8);
    let o = offset + 1;
    let runs = 0, extSize = 0;
    if (rich) { runs = data[o] | (data[o + 1] << 8); o += 2; }
    if (ext) { extSize = (data[o] | (data[o + 1] << 8) | (data[o + 2] << 16) | (data[o + 3] << 24)) >>> 0; o += 4; }
    let text = '';
    if (high) { for (let i = 0; i < length && o + 1 < data.length; i++, o += 2) text += String.fromCharCode(data[o] | (data[o + 1] << 8)); }
    else { for (let i = 0; i < length && o < data.length; i++, o++) text += String.fromCharCode(data[o]); }
    return { text, end: o + runs * 4 + extSize };
}

// The shared string table can run on into CONTINUE records; a string cut by the end of a record restarts with a fresh flags byte.
function xlsSharedStrings(records, startIndex) {
    const chunks = [records[startIndex].data];
    for (let i = startIndex + 1; i < records.length && records[i].id === 0x003C; i++) chunks.push(records[i].data);
    let c = 0, o = 8;   // after the two counts
    const total = new DataView(chunks[0].buffer, chunks[0].byteOffset, chunks[0].byteLength).getUint32(4, true);
    const strings = [];
    const next = () => { c++; o = 0; };
    const byte = () => { while (c < chunks.length && o >= chunks[c].length) next(); if (c >= chunks.length) throw new Error('Shared strings ended early'); return chunks[c][o++]; };
    const skip = (n) => { while (n > 0) { while (c < chunks.length && o >= chunks[c].length) next(); if (c >= chunks.length) return; const take = Math.min(n, chunks[c].length - o); o += take; n -= take; } };
    while (strings.length < total && c < chunks.length) {
        if (c === chunks.length - 1 && o >= chunks[c].length) break;
        const length = byte() | (byte() << 8);
        const flags = byte();
        let high = !!(flags & 1);
        const rich = !!(flags & 8), ext = !!(flags & 4);
        let runs = 0, extSize = 0;
        if (rich) runs = byte() | (byte() << 8);
        if (ext) extSize = (byte() | (byte() << 8) | (byte() << 16) | (byte() << 24)) >>> 0;
        let text = '';
        let left = length;
        while (left > 0) {
            if (o >= chunks[c].length) {
                next();
                if (c >= chunks.length) throw new Error('Shared strings ended early');
                high = !!(chunks[c][o] & 1); o++;   // the flags byte that opens a continued string
                continue;
            }
            if (high) { if (o + 1 >= chunks[c].length) { o = chunks[c].length; continue; } text += String.fromCharCode(chunks[c][o] | (chunks[c][o + 1] << 8)); o += 2; }
            else { text += String.fromCharCode(chunks[c][o]); o += 1; }
            left--;
        }
        skip(runs * 4 + extSize);
        strings.push(text);
    }
    return strings;
}

function readXls(bytes) {
    let stream;
    try { stream = xlsReadOleStream(bytes, ['Workbook', 'Book']); }
    catch (error) { throw new Error('Could not read this .xls file; save it as .xlsx or .csv and try again'); }
    try {
        const records = xlsRecords(stream);
        if (!records.length || records[0].id !== 0x0809) throw new Error('Not a BIFF workbook');
        if (records.some(r => r.id === 0x002F)) throw new Error('This .xls file is password protected; save it without a password as .xlsx or .csv and try again');
        // workbook globals: the sheets and the shared strings
        const sheets = [];
        let shared = [];
        let globalsEnd = records.findIndex((r, i) => i > 0 && r.id === 0x000A);
        if (globalsEnd < 0) globalsEnd = records.length;
        for (let i = 0; i < globalsEnd; i++) {
            const r = records[i];
            if (r.id === 0x0085 && r.data.length >= 8) {
                const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
                const nameLen = r.data[6];
                const name = xlsString(r.data, 7, nameLen).text;
                sheets.push({ offset: dv.getUint32(0, true), visible: r.data[4] === 0, type: r.data[5], name });
            } else if (r.id === 0x00FC) shared = xlsSharedStrings(records, i);
        }
        const worksheets = sheets.filter(s => s.type === 0);
        const sheet = worksheets.find(s => s.name.toLowerCase() === 'predictions') || worksheets.find(s => s.visible) || worksheets[0];
        if (!sheet) throw new Error('No worksheet');
        let index = records.findIndex(r => r.pos === sheet.offset);
        if (index < 0) throw new Error('Worksheet not found');
        const rows = [];
        const put = (row, col, value) => {
            if (row > 5000 || col > 255) return;
            while (rows.length <= row) rows.push([]);
            const cells = rows[row];
            while (cells.length <= col) cells.push('');
            cells[col] = value;
        };
        let formula = null;
        for (let i = index + 1; i < records.length; i++) {
            const r = records[i], d = r.data;
            if (r.id === 0x000A) break;
            if (d.length < 4) continue;
            const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
            const row = dv.getUint16(0, true), col = dv.getUint16(2, true);
            if (r.id === 0x00FD && d.length >= 10) put(row, col, shared[dv.getUint32(6, true)] || '');                       // LABELSST
            else if (r.id === 0x0204 && d.length >= 9) { put(row, col, xlsString(d, 8, dv.getUint16(6, true)).text); }       // LABEL
            else if (r.id === 0x0203 && d.length >= 14) put(row, col, xlsNumberText(dv.getFloat64(6, true)));               // NUMBER
            else if (r.id === 0x027E && d.length >= 10) put(row, col, xlsNumberText(xlsRk(dv.getUint32(6, true))));          // RK
            else if (r.id === 0x00BD && d.length >= 6) {                                                                    // MULRK
                const last = dv.getUint16(d.length - 2, true);
                for (let c = col, o = 4; c <= last && o + 6 <= d.length - 2; c++, o += 6) put(row, c, xlsNumberText(xlsRk(dv.getUint32(o + 2, true))));
            } else if (r.id === 0x0006 && d.length >= 14) {                                                                 // FORMULA
                formula = null;
                if (d[12] === 0xFF && d[13] === 0xFF) {
                    if (d[6] === 0) formula = { row, col };                       // a text result follows in a STRING record
                    else if (d[6] === 1) put(row, col, d[8] ? 'TRUE' : 'FALSE');
                } else put(row, col, xlsNumberText(dv.getFloat64(6, true)));
            } else if (r.id === 0x0207 && formula) {                                                                        // STRING (a formula's text result)
                put(formula.row, formula.col, xlsString(d, 2, dv.getUint16(0, true)).text);
                formula = null;
            }
        }
        return rows.map(cells => Array.from(cells, v => v === undefined ? '' : v));
    } catch (error) {
        if (/password/.test(error.message)) throw error;
        throw new Error('Could not read this .xls file; save it as .xlsx or .csv and try again');
    }
}

// ---- SpreadsheetML 2003 (XML) ----
function readSpreadsheetMl(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Could not read this .xls file; save it as .xlsx or .csv and try again');
    const local = (el) => el.localName || String(el.tagName).replace(/^.*:/, '');
    const children = (el, name) => [...el.children].filter(c => local(c) === name);
    const worksheets = [...doc.getElementsByTagName('*')].filter(e => local(e) === 'Worksheet');
    const sheet = worksheets.find(w => String(w.getAttribute('ss:Name') || w.getAttribute('Name') || '').toLowerCase() === 'predictions') || worksheets[0];
    if (!sheet) throw new Error('Could not read this .xls file; save it as .xlsx or .csv and try again');
    const table = children(sheet, 'Table')[0];
    if (!table) return [];
    const rows = [];
    let rowIndex = 0;
    children(table, 'Row').forEach(rowEl => {
        const indexAttr = parseInt(rowEl.getAttribute('ss:Index') || rowEl.getAttribute('Index'), 10);
        if (indexAttr) rowIndex = indexAttr - 1;
        const cells = [];
        let col = 0;
        children(rowEl, 'Cell').forEach(cellEl => {
            const colAttr = parseInt(cellEl.getAttribute('ss:Index') || cellEl.getAttribute('Index'), 10);
            if (colAttr) col = colAttr - 1;
            const data = children(cellEl, 'Data')[0];
            let value = data ? data.textContent : '';
            if (data && /number/i.test(data.getAttribute('ss:Type') || data.getAttribute('Type') || '')) value = xlsNumberText(Number(value));
            cells[col] = value;
            col += 1 + (parseInt(cellEl.getAttribute('ss:MergeAcross') || '0', 10) || 0);
        });
        while (rows.length < rowIndex) rows.push([]);
        rows[rowIndex] = Array.from(cells, v => v === undefined ? '' : v);
        rowIndex++;
    });
    return rows;
}

// ---- an HTML table saved as .xls ----
function readHtmlTable(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const table = doc.querySelector('table');
    if (!table) throw new Error('Could not read this .xls file; save it as .xlsx or .csv and try again');
    return [...table.querySelectorAll('tr')].map(tr => [...tr.children].filter(c => /^(td|th)$/i.test(c.tagName)).map(c => c.textContent.replace(/\s+/g, ' ').trim()));
}
