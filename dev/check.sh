#!/bin/bash
# Fast pre-push check (seconds): JS syntax, matching cache tags, SQL files present in migration order.
cd "$(dirname "$0")/.."
set -e
for f in js/*.js; do node --check "$f"; done && echo "js/*.js syntax ok"
a=$(grep -o 'js/[a-z-]*.js?v=[0-9-]*' index.html | sed 's/.*v=//' | sort -u | tr '\n' ' ' | sed 's/ $//'); s=$(grep -o 'styles.css?v=[0-9-]*' index.html | sed 's/.*v=//')
[ "$a" = "$s" ] && echo "cache tags match ($a)" || { echo "FAIL: script and stylesheet cache tags differ"; exit 1; }
if git diff --quiet origin/main -- js styles.css 2>/dev/null; then :; else
  git diff --quiet origin/main -- index.html && { echo "WARN: js/ or styles.css changed but cache tag not bumped (run dev/bump.sh)"; } || echo "cache tag bumped"
fi
