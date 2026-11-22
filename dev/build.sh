#!/bin/bash
# Builds what the page loads: dist/app.min.js (js/*.js in the order of js/load-order.txt, minified), dist/app.min.css
# (styles.css, minified), the ?v= tags in index.html (a hash of the built files), and sw.js (service worker, from dev/sw.template.js).
# Run after changing anything in js/ or styles.css (dev/bump.sh and dev/ship.sh do it). The sources stay readable in js/ and styles.css.
# Needs node; esbuild is fetched by npx the first time (pinned version).
cd "$(dirname "$0")/.."
set -e
OUT="${BUILD_OUT:-dist}"
mkdir -p "$OUT"
: > "$OUT/app.js"
while read -r f; do [ -n "$f" ] && { cat "js/$f"; printf '\n;\n'; } >> "$OUT/app.js"; done < js/load-order.txt
ESB="npx --yes esbuild@0.25.5 --log-level=warning"
$ESB "$OUT/app.js" --minify --target=safari14,chrome90 --legal-comments=none --outfile="$OUT/app.min.js"
$ESB styles.css --minify --target=safari14,chrome90 --outfile="$OUT/app.min.css"
rm "$OUT/app.js"
HASH=$(cat "$OUT/app.min.js" "$OUT/app.min.css" icons/icon-192.png icons/apple-touch-icon.png favicon.ico | md5sum | cut -c1-8)   # the precached icons are part of the version, so a new icon makes the service worker refresh its cache
if [ -z "$BUILD_OUT" ]; then
  sed -i -E "s#dist/app\.min\.(js|css)\?v=[0-9a-f]+#dist/app.min.\1?v=$HASH#g" index.html
  # Copies of the page cached before the bundle existed look for this exact text to learn that a new version is out
  sed -i -E "s#src=\"js/connectivity\.js\?v=[0-9a-zA-Z-]+\"#src=\"js/connectivity.js?v=$HASH\"#" index.html
  CORE="[\"./\", \"index.html\", \"dist/app.min.js?v=$HASH\", \"dist/app.min.css?v=$HASH\", \"manifest.json\", \"icons/icon-192.png\", \"icons/apple-touch-icon.png\", \"favicon.ico\"]"
  sed -e "s#__VERSION__#$HASH#" -e "s#__CORE__#$CORE#" dev/sw.template.js > sw.js
fi
echo "built $OUT/app.min.js ($(wc -c < "$OUT/app.min.js") bytes) and app.min.css ($(wc -c < "$OUT/app.min.css") bytes), version $HASH"
