# App Instructions

Before making changes in this app, read [REPO_CONTEXT.md](/Users/benselby/Library/Mobile%20Documents/com~apple~CloudDocs/Development/SixNationsGuesser/six-nations/REPO_CONTEXT.md) for the current repo map, data model, and high-risk areas.

## Working Rules

- This app is a static frontend with most behavior in `app.js`; prefer targeted edits over broad refactors.
- Preserve existing vanilla JS patterns unless the task explicitly requires structural change.
- Treat the Supabase-backed `Storage` object as the persistence boundary.
- When changing scoring, leaderboard, prize, tries, or joker behavior, check both summary rendering and admin editing flows.
- When changing UI, verify corresponding markup in `index.html`, styles in `styles.css`, and rendering code in `app.js`.

## Fast workflow

- Make the change, run `dev/bump.sh` if `app.js`/`styles.css` changed, then `dev/check.sh` (seconds).
- Test only what the change touches (one focused Playwright or SQL test), not the whole suite; run everything once just before merge.
- DB changes: add a new idempotent migration file, update `supabase/verify_security.sql`, and hold the merge until the migration has been run.
- Keep PR descriptions to a few lines; screenshots only when layout is the point.
