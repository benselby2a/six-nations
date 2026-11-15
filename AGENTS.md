# App Instructions

Before making changes in this app, read [REPO_CONTEXT.md](REPO_CONTEXT.md) for the current repo map, data model, and high-risk areas.

## Working Rules

- This app is a static frontend with behavior split across `js/*.js` (see the file map in REPO_CONTEXT.md); prefer targeted edits over broad refactors.
- Preserve existing vanilla JS patterns unless the task explicitly requires structural change.
- Treat the Supabase-backed `Storage` object as the persistence boundary.
- When changing scoring, leaderboard, prize, tries, or joker behavior, check both summary rendering and admin editing flows.
- When changing UI, verify corresponding markup in `index.html`, styles in `styles.css`, and rendering code in the relevant `js/` file.

## Fast workflow

- Make the change in `js/*.js` / `styles.css` (the readable sources), run `dev/build.sh` (or `dev/bump.sh`, the same thing) to rebuild the minified `dist/` files, `sw.js` and the `?v=` tags that the page actually loads, then `dev/check.sh` (seconds). `dist/` and `sw.js` are committed build output: never edit them by hand.
- Test only what the change touches: `dev/test.sh <name>` (tests live in `dev/tests/`; first time `(cd dev/tests && npm install)`). Run `dev/test.sh all` (about 45s, parallel, slowest tests first) only for risky changes (scoring, storage, summary rendering, auth, anything touching several screens); for CSS, text or a single-screen change the relevant tests plus `dev/check.sh` are enough. Ship with `dev/ship.sh "message"` (bump, check, commit, sync, push in one step), then create and squash-merge the PR. Run `dev/tour-shots.sh` only when a screen the tour shows has changed (it is slow).
- DB changes: add a new idempotent migration file, update `supabase/verify_security.sql`, and hold the merge until the migration has been run.
- Keep PR descriptions to a few lines; screenshots only when layout is the point.
- To find code fast: `grep -n "functionName" js/*.js`, then edit only that file. Files are classic scripts sharing one global scope; they are concatenated and minified into `dist/app.min.js` in the order listed in `js/load-order.txt` (add a new file there). The only build tool is `dev/build.sh` (esbuild via npx).
