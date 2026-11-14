#!/bin/bash
# Usage: dev/test.sh <name>   run one test (e.g. fixture-cancel, sql-second-email)
#        dev/test.sh all      run everything (about 30s in parallel; do this once before merge)
# First time: (cd dev/tests && npm install)   -- Playwright can use an existing global install.
cd "$(dirname "$0")/tests"
[ -d node_modules ] || { echo "run: (cd dev/tests && npm install)"; }
export NODE_PATH="$PWD/node_modules:$(npm root -g 2>/dev/null)"
run() { f=$(ls browser/$1.js sql/$1.js 2>/dev/null | head -1); [ -z "$f" ] && { echo "no test '$1'"; ls browser sql | sed 's/\.js$//'; exit 1; }
  echo "== $1"; timeout 150 node "$f" 2>&1 | grep -E "FAIL|pageerrors|passed|PASSED|Error|true|false|^[0-9]+ " | awk 'NR<=6 || /false|Error|FAIL|not ok/'; }
if [ "$1" = all ]; then
  export -f run; mkdir -p /tmp/sn-tests; rm -f /tmp/sn-tests/*.txt
  # slowest first, so the long ones start straight away; twice as many at once as cores (most of a test is waiting)
  slow="tour no-hscroll verify-security restore sql-fixture-chat sql-second-email app-bar checklist-screen invite open-top fixture-chat"
  all=$(ls browser/*.js sql/*.js | xargs -n1 basename | sed 's/\.js$//')
  { for t in $slow; do echo "$all" | grep -qx "$t" && echo "$t"; done; echo "$all" | grep -vxF "$(echo $slow | tr ' ' '\n')"; } \
    | xargs -P $(( $(nproc) * 2 )) -I{} bash -c 'run {} > /tmp/sn-tests/{}.txt 2>&1'
  cat /tmp/sn-tests/*.txt
else run "$1"; fi
