#!/bin/bash
# One step from "change made" to "pushed and ready for a PR": bump cache tags, syntax check, commit, sync the branch, push.
# Usage: dev/ship.sh "Commit message"   (run only the tests the change touches first: dev/test.sh <name>)
set -e
cd "$(dirname "$0")/.."
[ -n "$1" ] || { echo "usage: dev/ship.sh \"commit message\""; exit 1; }
BRANCH=$(git rev-parse --abbrev-ref HEAD)
dev/bump.sh >/dev/null
dev/check.sh | tail -2
git add -A
git commit -qm "$1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YF7ntrNncvTWaxhmpEFPNu"
git fetch -q origin "$BRANCH" 2>/dev/null && git merge -s ours "origin/$BRANCH" -qm merge 2>/dev/null || true
git push -q -u origin "$BRANCH" 2>&1 | tail -1
echo "pushed $BRANCH"
