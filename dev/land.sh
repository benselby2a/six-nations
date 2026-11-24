#!/bin/bash
# Usage: dev/land.sh <sha> "commit message" [test names...]   bring an engineer's commit onto fresh main, rebuild, run the named tests in parallel, ship
#        dev/land.sh --sync                                     after the PR is squash-merged: reset the branch to main and push it
# Generated files (dist/, sw.js, the ?v= tags in index.html) are resolved by rebuilding, never by hand.
cd "$(dirname "$0")/.."
if [ "$1" = "--sync" ]; then
  git fetch -q origin main && git reset -q --hard origin/main && git merge -s ours -q -m "Sync branch with main" "origin/$(git branch --show-current)" && git push -q origin "$(git branch --show-current)" && git log --oneline -1 origin/main
  exit $?
fi
sha="$1"; msg="$2"; shift 2
git fetch -q origin main && git reset -q --hard origin/main || exit 1
git cherry-pick -n "$sha" >/dev/null 2>&1
git checkout --ours dist sw.js >/dev/null 2>&1
python3 - <<'PY'
import re
s=open('index.html').read()
s=re.sub(r'<<<<<<< [^\n]*\n(.*?)=======\n.*?>>>>>>> [^\n]*\n',r'\1',s,flags=re.S)
open('index.html','w').write(s)
PY
left=$(git diff --name-only --diff-filter=U | grep -vE '^(dist/|sw\.js|index\.html)' )
if [ -n "$left" ]; then echo "CONFLICTS to resolve by hand (not generated files):"; echo "$left"; exit 2; fi
git add -A index.html dist sw.js >/dev/null 2>&1
dev/build.sh | tail -1 && dev/check.sh | tail -1
if [ $# -gt 0 ]; then dev/test.sh "$@" 2>&1 | grep -E "false|rror" | grep -vE 'errors \[\]|"[a-zA-Z]+":false' | head -6 | cut -c1-220; fi
git add -A . ':!.claude' >/dev/null 2>&1
dev/ship.sh "$msg" 2>&1 | tail -1
