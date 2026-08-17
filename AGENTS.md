# App Instructions

Before making changes in this app, read [REPO_CONTEXT.md](/Users/benselby/Library/Mobile%20Documents/com~apple~CloudDocs/Development/SixNationsGuesser/six-nations/REPO_CONTEXT.md) for the current repo map, data model, and high-risk areas.

## Working Rules

- This app is a static frontend with most behavior in `app.js`; prefer targeted edits over broad refactors.
- Preserve existing vanilla JS patterns unless the task explicitly requires structural change.
- Treat the Supabase-backed `Storage` object as the persistence boundary.
- When changing scoring, leaderboard, prize, tries, or joker behavior, check both summary rendering and admin editing flows.
- When changing UI, verify corresponding markup in `index.html`, styles in `styles.css`, and rendering code in `app.js`.
