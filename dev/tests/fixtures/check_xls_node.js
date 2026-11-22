// Quick check outside the browser: node dev/tests/fixtures/check_xls_node.js  (reads the .xls fixtures with js/xls-lite.js)
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..', '..', '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'xls-lite.js'), 'utf8') + '\nthis.readXls = readXls;', ctx);
for (const name of ['predictions-xlwt.xls', 'predictions-libreoffice.xls']) {
  const rows = ctx.readXls(new Uint8Array(fs.readFileSync(path.join(__dirname, name))));
  console.log(name, JSON.stringify(rows.slice(0, 6)), JSON.stringify(rows.slice(9)));
}
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'long-strings.json'), 'utf8'));
const got = ctx.readXls(new Uint8Array(fs.readFileSync(path.join(__dirname, 'long-strings.xls'))));
console.log('long strings equal:', JSON.stringify(got) === JSON.stringify(expected), got.length, expected.length);
const f = ctx.readXls(new Uint8Array(fs.readFileSync(path.join(__dirname, 'formulas.xls'))));
console.log('formulas:', JSON.stringify(f), JSON.stringify(f) === JSON.stringify([['52', 'Yes', '0.5'], ['Season', '2026']]));
