# Test fixtures

Binary `.xls` files for `dev/tests/browser/admin-prediction-upload.js` (the legacy Excel reader, `js/xls-lite.js`).

- `predictions-xlwt.xls`: the predictions template filled in (blank Player/Username, total tries 52, three scores, a Joker), written with xlwt.
- `predictions-libreoffice.xls`: the same content written as .xlsx by openpyxl and converted to .xls by LibreOffice (`soffice --headless --convert-to "xls:MS Excel 97"`), a realistic Excel-style file.
- `long-strings.xls` / `long-strings.json`: more than 8 KB of long and non-Latin shared strings (the table continues over CONTINUE records) and the rows it must read back as.
- `formulas.xls`: LibreOffice-converted cells that are formulas (cached number and text results).

Regenerate with `pip install xlwt openpyxl` and `python3 dev/tests/fixtures/make_xls_fixtures.py` (needs `soffice`). Quick check outside the browser: `node dev/tests/fixtures/check_xls_node.js`.
