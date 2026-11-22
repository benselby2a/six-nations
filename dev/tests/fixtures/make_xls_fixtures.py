#!/usr/bin/env python3
"""Makes the binary .xls fixtures used by dev/tests/browser/admin-prediction-upload.js.

  predictions-xlwt.xls         the template layout filled in for the test's mock season 2026, written with xlwt
  predictions-libreoffice.xls  the same content as an .xlsx (openpyxl) converted to .xls by LibreOffice (soffice --headless)
  long-strings.xls             xlwt file whose shared string table runs over several CONTINUE records (long and non-Latin strings)
  long-strings.json            the rows long-strings.xls must read back as
  formulas.xls                 LibreOffice-converted workbook whose cells are formulas (cached numeric and text results)

Needs: pip install xlwt openpyxl, and (for the LibreOffice one) soffice on the PATH. Run: python3 dev/tests/fixtures/make_xls_fixtures.py
"""
import json, os, shutil, subprocess, tempfile
import xlwt, openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))

HEADER = ['Match id', 'Round', 'Date', 'Time', 'Home team', 'Away team', 'Home score', 'Away score', 'Joker']
# the mock fixtures of the test (season 2026): id, round, date, time, home, away, home score, away score, joker
FIXTURES = [
    (1, 1, 'Thu, Feb 5', '20:10', 'France', 'Ireland', 30, 20, 'n/a'),
    (2, 1, 'Sat, Feb 7', '14:10', 'Italy', 'Scotland', None, None, 'n/a'),
    (4, 2, 'Sat, Feb 14', '14:10', 'England', 'Wales', 21, 14, 'Yes'),
    (5, 2, 'Sun, Feb 15', '15:10', 'Wales', 'Italy', 7, 3, 'No'),
]


def grid():
    rows = [
        ['Six Nations Guesser - predictions template'],
        ['Season', 2026],
        ['Player', '', 'Fill in the player name, or leave blank and choose the player in the app when you upload.'],
        ['Username', ''],
        ['Total tries', 52],
        ['Jokers allowed', 1, 'Only on fixtures marked Yes/No in the Joker column.'],
        ['Fill in the shaded cells: Total tries, Home score, Away score and (where the fixture allows it) Joker = Yes or No.'],
        ['Do not change the Season or Match id cells.'],
        [],
        HEADER,
    ]
    for f in FIXTURES:
        rows.append(list(f))
    return rows


def write_xlwt(path, rows, sheet='Predictions'):
    wb = xlwt.Workbook(encoding='utf-8')
    ws = wb.add_sheet(sheet)
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            if v is None or v == '':
                continue
            ws.write(r, c, v)
    wb.save(path)


def main():
    rows = grid()
    write_xlwt(os.path.join(HERE, 'predictions-xlwt.xls'), rows)

    tmp = tempfile.mkdtemp()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Predictions'
    for row in rows:
        ws.append([None if v is None or v == '' else v for v in row])
    xlsx = os.path.join(tmp, 'predictions-libreoffice.xlsx')
    wb.save(xlsx)
    subprocess.run(['soffice', '--headless', '--convert-to', 'xls:MS Excel 97', '--outdir', tmp, xlsx], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.copy(os.path.join(tmp, 'predictions-libreoffice.xls'), os.path.join(HERE, 'predictions-libreoffice.xls'))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Predictions'
    ws.append(['=40+12', '=CONCATENATE("Ye","s")', '=2/4'])
    ws.append(['Season', 2026])
    fx = os.path.join(tmp, 'formulas.xlsx')
    wb.save(fx)
    subprocess.run(['soffice', '--headless', '--convert-to', 'xls:MS Excel 97', '--outdir', tmp, fx], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.copy(os.path.join(tmp, 'formulas.xls'), os.path.join(HERE, 'formulas.xls'))

    # long and non-Latin strings: more than 8 KB of shared strings, so the table continues in later records
    long_rows = [['Season', 2026]]
    for i in range(60):
        long_rows.append(['Row %d ' % i + 'x' * (150 + i), 'Zażółć gęślą jaźń %d' % i, i, i + 0.5])
    long_rows.append(['Total tries', 99, 'Café – “quoted” 日本語'])
    write_xlwt(os.path.join(HERE, 'long-strings.xls'), long_rows)
    expected = [[(str(int(v)) if isinstance(v, (int, float)) and float(v).is_integer() else str(v)) for v in row] for row in long_rows]
    with open(os.path.join(HERE, 'long-strings.json'), 'w', encoding='utf-8') as f:
        json.dump(expected, f, ensure_ascii=False)


if __name__ == '__main__':
    main()
