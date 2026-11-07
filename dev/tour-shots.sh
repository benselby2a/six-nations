#!/bin/bash
# Regenerates the tour pictures (tour-images/*.jpg) and js/tour-images.js from the app running on example data.
# Run after changing a screen the tour shows. Needs Playwright (the one already installed globally is fine).
cd "$(dirname "$0")/.."
MARK=$(grep -n "const st = () => page.evaluate" dev/tests/browser/admin-collapse.js | tail -1 | cut -d: -f1)
OUT=$(mktemp /tmp/tour-shots-XXXX.js)
head -$((MARK-1)) dev/tests/browser/admin-collapse.js \
  | sed "s#require('path').resolve(__dirname, '../../../index.html')#'$PWD/index.html'#; s#const page = await browser.newPage();#const page = await browser.newPage({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2 });#" > "$OUT"
sed "s#__REPO__#$PWD#g" dev/tour-shots-body.js >> "$OUT"
NODE_PATH="$(npm root -g)" node "$OUT"
rm -f "$OUT"
