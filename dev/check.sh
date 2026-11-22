#!/bin/bash
# Fast pre-push check (seconds): JS syntax, built files up to date with the sources, matching cache tags.
cd "$(dirname "$0")/.."
set -e
for f in js/*.js; do node --check "$f"; done && echo "js/*.js syntax ok"
tmp=$(mktemp -d); BUILD_OUT="$tmp" dev/build.sh >/dev/null
if cmp -s "$tmp/app.min.js" dist/app.min.js && cmp -s "$tmp/app.min.css" dist/app.min.css; then echo "dist/ is up to date"; else echo "FAIL: dist/ is out of date with js/ and styles.css (run dev/build.sh)"; rm -rf "$tmp"; exit 1; fi
HASH=$(cat "$tmp/app.min.js" "$tmp/app.min.css" icons/icon-192.png icons/apple-touch-icon.png favicon.ico | md5sum | cut -c1-8); rm -rf "$tmp"
grep -q "dist/app.min.js?v=$HASH" index.html && grep -q "dist/app.min.css?v=$HASH" index.html && grep -q "const VERSION = '$HASH'" sw.js && echo "cache tags and service worker match ($HASH)" || { echo "FAIL: index.html or sw.js tags do not match the built files (run dev/build.sh)"; exit 1; }
