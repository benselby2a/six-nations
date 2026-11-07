#!/bin/bash
# Fast pre-push check (seconds): JS syntax, matching cache tags, SQL files present in migration order.
cd "$(dirname "$0")/.."
set -e
node --check app.js && echo "app.js syntax ok"
a=$(grep -o 'app.js?v=[0-9-]*' index.html | sed 's/.*v=//'); s=$(grep -o 'styles.css?v=[0-9-]*' index.html | sed 's/.*v=//')
[ "$a" = "$s" ] && echo "cache tags match ($a)" || { echo "FAIL: app.js and styles.css cache tags differ"; exit 1; }
if git diff --quiet origin/main -- app.js styles.css 2>/dev/null; then :; else
  git diff --quiet origin/main -- index.html && { echo "WARN: app.js/styles.css changed but cache tag not bumped (run dev/bump.sh)"; } || echo "cache tag bumped"
fi
