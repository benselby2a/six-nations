# Six Nations Guesser Repo Context

## Snapshot

- App type: single-page static web app.
- Main files: `index.html`, `styles.css`, and `js/*.js` (the former single `app.js`, split with no code changes; see the file map below).
- Backend: Supabase accessed directly from the browser through `@supabase/supabase-js`.
- Rendering style: vanilla JavaScript building large HTML strings and writing `innerHTML`.
- Export: PDF generation via `jsPDF` and `jspdf-autotable`.
- Current notable summary surfaces:
  - `Tournament Stats` panel with live tries totals plus a per-load `The Statto` fact.
  - `Trev's Tips` panel with per-load cached commentary phrasing. Currently hidden on the page (`#trevsTipsContainer` has `hidden` + inline `display:none`); `updateTrevsTips` still renders into it.

## File Map

### `index.html`

- Loads Google Fonts, Supabase client, jsPDF, and `styles.css`.
- Contains login view, profile modal, summary tab, predictions tab, and admin-only tabs.
- Most actions are wired with inline `onclick` handlers that call globals from `js/*.js`.
- Admin sub-tab labels are user-facing copy and currently read:
  - `Fixtures and Scores`
  - `Predictions`
  - `Competitors`
  - `Guesser Rules`
  - `Prize Fund`

### `js/` file map (load order is `js/load-order.txt`; all classic scripts sharing one global scope; built into `dist/app.min.js` by `dev/build.sh`)
`constants` fixtures/flags/team helpers; `storage` Supabase client and `Storage`; `state` globals, usage tracking, escaping, cookies, remembered user; `years-admin` years, Years tab, readiness checklist, who plays; `init` initializeData/init/lock toggle; `admin-fixtures` fixtures, bulk import, results; `admin-competitors` competitors, invitations, account linking; `profile` profile, theme, help; `auth` login code flow, handleAuthChange, showApp; `predictions` predictions UI and admin prediction editing; `scoring` rules and points; `trevs-tips` Trev's Tips/Statto text; `leaderboard` round filter, prize projection/panel; `worm-chart`; `summary`; `fixture-chat` Match Summary comments and emoji; `export-pdf`; `rules-admin` rules and prize forms; `recovery-usage` recovery SQL, usage report; `app-shell` showTab, refresh, install tip, start-up wiring (auth listener) last. Keep this order: files run top to bottom at load.
Admin menu: `#adminPanel` is always fully shown at the top of every admin section (it is not collapsible).

### (legacy notes below were written for the single `app.js`)

- Holds nearly all application logic and in-memory state.
- Declares fixture list, flag helpers, auth helpers, storage abstraction, scoring logic, UI rendering, admin tools, prize logic, recovery SQL, and usage reporting.
- Important pattern: many functions depend on global mutable state (`users`, `matches`, `adminUsernames`, `appSettings`, `activeScoringRules`, `userJokerSelections`, `currentUsername`).
- Commentary/stat presentation has per-app-load randomness:
  - `The Statto` chooses one random fact at load and keeps it static for the session.
  - `Trev's Tips` chooses a cached voice/loadout at load and reuses it for the session.

### `styles.css`

- Two colour modes, defined as CSS variables at the top of the file: light (default: green header band, cream/white cards) and dark (`data-theme="dark"` on `<html>`). Style with the variables (`--bg`, `--surface`, `--text`, `--muted`, `--line`, `--gold` = main accent, `--on-accent`, `--ink`/`--accent-rgb` triplets for translucent tints via `rgb(var(--ink) / 0.1)`), not hard-coded colours. The header band, account menu, tour card and chat sheet stay green in light mode and re-declare the variables locally. The mode is `auto` (follows the device via `prefers-color-scheme`, the default), `light` or `dark`; the account menu's Appearance button cycles them (`toggleTheme()` in `js/profile.js`), saved in a cookie and localStorage (`rugbyPredictorColourMode`; an old saved `dark` from the previous theme selector is honoured). The account menu also has Take a tour (and Admin tour for admins).
- Styles summary table, prediction cards, admin panels, prize section, tooltips, and responsive behavior.

## Core Data Model

### `users`

Object keyed by normalized lowercase username:

```js
{
  [username]: {
    nickname,
    totalTries,          // selected year only
    supportedTeams: [],
    predictions: {       // selected year only
      [matchId]: { team1, team2 }
    }
  }
}
```

### `matches`

Array of fixtures/results:

```js
{
  id,
  round,
  date,
  time,
  team1,
  team2,
  actualScore1,
  actualScore2,
  actualTries1,
  actualTries2,
  jokerEligible,
  year
}
```

### Other Global State

- `adminUsernames`: lowercase usernames with admin access.
- `appSettings`: prediction locking for the selected year.
- `activeScoringRules`: current scoring and prize configuration.
- `userJokerSelections`: selected joker match ids per user.
- `currentUsername`: active logged-in competitor username, or `null` for guests.
- `currentAuthEmail`: email of the signed-in Supabase Auth account.

## Authentication

- The login email field (`autocomplete="email"`, plus a `datalist`) stays empty and offers the last three emails used on this device as suggestions (localStorage `rugbyPredictorRecentEmails`). It is deliberately not pre-filled: iOS shows no suggestions in a field that already has text. iOS's own contact-card suggestion depends on the phone's Settings.
- Login is Supabase Auth with an emailed code only: `sendLoginCode` (the "Email a login code" button) -> `signInWithOtp` (no redirect), then `verifyLoginCode` -> `verifyOtp({ type: 'email' })` (the code box signs in as soon as a code is pasted into it). First use creates the account. The Supabase email templates (Magic Link and Confirm signup) should contain `{{ .Token }}` and no link. Because there is no redirect, the Site URL / Redirect URLs settings no longer matter for sign-in and a Home Screen shortcut signs in the same way as the browser. supabase-js persists the session in localStorage, so returning visitors stay signed in.
- `handleAuthChange` (wired to `onAuthStateChange`) restores the session and calls `resolveSignedInUser`, which maps the account to a competitor through the `my_competitor` RPC (`users.auth_user_id`).
- An admin can still link an existing account to a competitor by hand (Competitors card -> Sign-in account, using the `admin_list_accounts` / `admin_link_competitor` RPCs); a linked account's login email counts as registered.
- Sign-in is limited to registered emails, and an admin only needs to add an email. **The email lives on `users.email`**: clients have no column privilege on it (the same way `auth_user_id` is hidden), so only the admin RPCs and the security-definer functions read or write it. An invitation is just a `users` row with the email set, a neutral username (`player12`, nothing derived from the email) and no display name yet; its card on the Competitors screen shows the email with an "Invited" chip, and deleting the card removes the invitation. On the Competitors screen one "+ Add a competitor" card takes an email (the only required field); an expandable "Add their details now (optional)" panel (display name, username, teams, playing, admin) creates the competitor immediately when a display name is entered, otherwise it just invites the email (`addCompetitor` -> `admin_invite_email`). `sendLoginCode` first calls the public `check_login_email` RPC (registered = a `users` row has that email, or an account already linked to one has it as its login email); an unrecognised email shows `#unrecognisedEmailModal` (admin names from `login_admin_names`) and no code is sent. After signing in, `my_competitor()` links the account to the unlinked row whose email matches the account's confirmed email and returns it. A row with no display name sends the person to `#setupView` (`createMyProfile` -> `complete_my_profile(nickname, teams)`, which fills in the row made for them and tidies the username from their name); no row at all signs them out with the pop-up. Changing or clearing a signed-up competitor's email (`admin_set_competitor_email`) releases their old account so the login moves, and an admin cannot change their own email. There is no self-signup: nothing can create a competitor except an admin. Migrations, in this order: `preregistered_emails_migration.sql`, `registered_logins_migration.sql`, `invitations_migration.sql`, `users_email_migration.sql` (which moves the data off the earlier `competitor_emails` / `invited_emails` tables and drops them, so re-running an earlier file afterwards fails instead of silently downgrading; it also keeps the optional `hook_before_user_created`, which you can enable under Authentication > Hooks to stop Supabase creating accounts for unregistered emails at all). `verify_security.sql` checks the email column's privileges and row 16 the function versions. **Second email at sign-up**: `profile_second_email_migration.sql` (after `second_email_migration.sql`) adds `add_my_second_email(email)`; the join screen (`#setupView`) has an optional `#setupSecondEmail` field that `createMyProfile` sends after `complete_my_profile`. It adds once, only to the caller's own competitor, and refuses an email held by anyone else; admins change it later. **Two emails per player**: `second_email_migration.sql` (run after `users_email_migration.sql`) adds hidden `users.email2` and `users.auth_user_id2`; either email signs in as the same competitor (`my_competitor` links the first free slot, `check_login_email` accepts either, `current_competitor_id()`/`is_admin()` accept either account). `admin_set_competitor_email(username, email, slot)` sets/clears one slot and releases only that slot's account; `admin_unlink_account(uuid)` unlinks one account (not your own). The Competitors card has a second email field (`edit-email2-<username>`, `competitorEmails2`) and lists each linked account with its own Unlink.
- `supabase/verify_security.sql` is a read-only check to paste into the Supabase SQL editor after any migration: RLS on, guests cannot write, no allow-all write policy, no password hashes, auth links and registered emails not readable, no stale admin entries or markup in display names. Every row should say ok.
- Guests (anon) are read-only in the database: no write privileges on any table. `usage_events` accepts inserts only from signed-in people under their own username (admins may log for a competitor); the client skips usage logging when nobody is signed in.
- Display names are inserted into page templates, so `< > "` are never allowed: stripped on load (`cleanDisplayText`), rejected on save (`hasUnsafeDisplayChars`), and constrained in the database. Never interpolate user-supplied text into `innerHTML` without `escapeHtml`.
- Guests are remembered with the `rugbyPredictorUser=guest` cookie only; usernames are no longer remembered.
- Authorization is enforced by RLS, not the UI: admins are `admin_usernames` rows whose username belongs to a linked competitor (`is_admin()`). `users.auth_user_id` is not readable by clients. See `supabase/auth_migration.sql` (run once; idempotent) and bootstrap notes at its top.
- `Storage.saveAdminUsernames` diffs rather than clearing the table, because emptying it mid-save would remove the admin's own rights.

## Years

- Everything competition-related belongs to a year: fixtures (`matches.year`), predictions and jokers (via `match_id`), tournament tries (`user_tries`, per competitor per year), scoring/prize rules (`scoring_rules.year`, one row per year; `scoring_close_tiers.year`), and the prediction lock (`settings` key `predictions_locked:<year>`). Competitors and admins are global.
- `seasons` lists the years in the header dropdown (`#yearSelect`). Admins add and remove years in the Years admin tab (`addYearFromAdmin`, `removeYear`); a new year can copy another year's rules, and removing a year deletes its fixtures, predictions, jokers, tries, rules and lock (competitors are kept; confirmed by typing the year).
- State: `selectedYear`, `availableYears`, `allMatches` (every year). The `matches` const array always holds the selected year's fixtures only (`applySelectedYearMatches`); `users[u].predictions`, `users[u].totalTries`, `userJokerSelections`, `activeScoringRules` and `appSettings` are loaded for the selected year by `loadYearData`. `switchYear` reloads and re-renders.
- Storage writes must stay year-scoped: `savePredictions` / `saveUserJokerSelections` only touch the selected year's match ids, `saveMatches` only deletes within the selected year. Match ids are one global sequence (`getNextMatchId`).
- Whether a competitor is playing in a year is the `Playing <year>` checkbox on the Competitors screen, stored per year in `settings` as `active_overrides:<year>` (JSON `{username: true|false}`); without an entry they count as playing once they have a prediction that year (`isCompetitorActive`). The old Competitor Completion Check box on the Predictions tab was removed; its detail (what each active competitor is still missing) is now under the checklist's predictions row.
- The readiness checklist has its own admin screen (`#checklistTab`, `showTab('checklist')`), opened by the **Setup checklist** button at the top of Admin Functions (`#checklistBtn`, shows "n of N done" / "All done"). The screen always shows every step, ticked or not, each with an Open/action button.
- The Setup checklist screen shows a readiness checklist for the viewed year (`renderReadinessChecklist`): 15 fixtures added, all predictions in, predictions locked, scores entered for matches kicked off over 3 hours ago (every *active* competitor must have scores, tries and jokers), Guesser Rules saved, Prize Fund saved. "Saved" is recorded in `settings` as `rules_saved:<year>` / `prize_saved:<year>` when the admin clicks Save in that tab (a new year's rules are copied forward, so a stored row alone does not mean reviewed). `saveUpdatedRules('rules'|'prize')` writes the flag.
- The prediction lock toggle (`#lockToggle`, per year) lives on the admin Predictions tab.
- A year with any result entered is locked in the Years tab: it cannot be cleared or removed from the app (enforced in the UI, `clearYearPredictions`/`removeYear`, and `Storage.clearSeasonPredictions`/`removeSeason`). A year without results can be cleared (predictions, jokers, tries) and, once it has no predictions, removed.
- Tables (summary, leaderboard, prizes, stats, PDF) list `getParticipantUsernames()`, i.e. competitors with predictions in the selected year. Admin competitor/score-correction screens still list everyone.
- The default year is the latest one with fixtures, or the last choice (localStorage `rugbyPredictorSelectedYear`).
- Schema: `supabase/years_migration.sql` (additive, idempotent, run after `auth_migration.sql`). The recovery tab exports every year from a raw snapshot of each table (`fetchRecoverySnapshot`).

## Main Runtime Flow

1. `initializeData()` loads users, admins, settings, matches, scoring rules, and joker selections from Supabase.
2. `init()` renders the main UI shells.
3. Auth restores the session; `showApp()`, `showAppAsGuest()` or the profile setup view selects the visible mode.
4. Most user actions save via `Storage.*`, mutate in-memory globals, then re-render affected sections.

## Important Function Clusters (in `js/*.js`)

### Storage / persistence

- `Storage.getUsers`, `Storage.saveUser`
- `Storage.savePredictions`
- `Storage.saveMatches`
- `Storage.saveAdminUsernames`
- `Storage.saveSettings`
- `Storage.saveScoringRulesDraft`
- `Storage.saveUserJokerSelections`

This is the main browser-to-Supabase boundary.

### Predictions / user gameplay

- `renderMatches`
- `loadPredictions`
- `autoSavePredictions`
- `getPredictionChecklistStatus`

### Admin workflows

- `renderAdminMatches`
- `saveNextMatchScore`
- `saveFixtureEdits`
- `processBulkImport`
- `renderCompetitorManagement`
- `renderAdminScoreCorrections`
- `savePredictionEdits`
- `renderRulesTab`
- `renderPrizeFundTab`
- `initRecoveryTab`
- `renderUsageReport`

### Scoring / leaderboard

- `normalizeScoringRules`
- `calculateMatchPoints`
- `calculateMatchPointsBreakdownWithRules`
- `calculatePoints`
- `updateLeaderboard`
- `updateTriesStats`
- `updateTrevsTips`
- `buildTournamentStattoFacts`

### Summary / prize logic

- `showSummary`
- `renderPrizeMoneyPanel`
- `calculatePrizeProjection`
- `buildRankingGroups`
- `getProjectedTournamentTriesTotal`

## High-Risk Areas

### Shared global scope

- Many features are tightly coupled through globals and shared render paths.
- A change in one place often requires checking summary, admin edit, and export behavior too.

### Usernames are normalized

- Storage and lookups expect lowercase usernames.
- Display names usually come from `nickname`, falling back to username.

### Rendering is string-based

- Many screens use template strings plus `innerHTML`.
- Small data-shape mistakes can silently break rendering.
- Re-rendered panels should not silently reshuffle session-random commentary:
  - `The Statto` should stay fixed until refresh.
  - `Trev's Tips` wording should stay fixed until refresh.

### Summary logic is duplicated conceptually across features

- Leaderboard, prize projection, tournament stats, tips, and PDF export all derive from overlapping match/user state.
- If changing scoring or display rules, verify all of those outputs.

### Prize and ranking behavior

- Prize projection is intentionally distinct from raw leaderboard order.
- Current special rule: AI player is shown on the leaderboard but excluded from prize payouts, with a prize footnote when exclusion affects displayed winners.
- Current special rule: AI player always shows `🤖` as supporter flag via `getUserFlags`.
- Prize UI rule: tied rank groups should be rendered once as a combined occupied rank range, not duplicated into each overlapping prize slot.

## Recent Special Cases Worth Remembering

- AI player exclusion from prize payouts is implemented in `calculatePrizeProjection`.
- AI supporter icon override is implemented in `getUserFlags`.
- Prize summary footnotes combine tries status plus AI exclusion note.
- `The Statto` and `Trev's Tips` intentionally use different name-formatting rules from the rest of the app:
  - AI can be called out as `AI (boo, hiss!)` in commentary/stat headline text.
- `The Statto` facts are computed from live prediction/result data and may include:
  - correct results
  - exact scores
  - bonus haul
  - contrarian calls / contrarian hit rate
  - draw picks
  - joker gains
  - recent form
  - current streak
  - near-perfect scorelines
  - close-score bonuses / split-fixture facts
- Near-perfect scorelines are currently defined as non-exact predictions within 2 total score points of the actual score, even if the predicted result outcome is wrong.

## Fast Path For Common Tasks

### Change scoring rules

- Read `normalizeScoringRules`, `calculateMatchPointsBreakdownWithRules`, `renderRulesPreview`, and `showSummary`.

### Change prize behavior

- Read `calculatePrizeProjection` and `renderPrizeMoneyPanel`.
- Then check `showSummary` and leaderboard output.
- If changing tie handling, verify both payout math and displayed prize labels.

### Change competitor/profile display

- Read `getDisplayName`, `getUserFlags`, profile modal code, competitor management, and summary row rendering.
- If the change affects commentary/stat surfaces, also check `getTrevsTipsDisplayName`, `formatStatNameList`, and the relevant text-generation helpers.

### Change commentary/stat surfaces

- Read `updateTriesStats`, `buildTournamentStattoFacts`, `getStaticStattoFact`, `getTrevsTipsLoadout`, and `updateTrevsTips`.
- Preserve the distinction between:
  - per-load randomness
  - per-render recalculation from live data
  - global display-name rules versus commentary-only display-name rules

### Change fixture/result entry

- Read `renderAdminMatches`, `saveNextMatchScore`, `saveFixtureEdits`, `autoSaveResults`, and `processBulkImport`.

### Change persistence shape

- Start in the `Storage` object and verify matching SQL/recovery generation code later in the file.

## App icon

- Original artwork (not the official Six Nations crest): a modern flat rugby ball (white with emerald seams and gold lacing, soft shadow) ringed by the six nations' flags (England, France, Italy, Wales, Ireland, Scotland) on an emerald gradient; the favicon is the ball alone (the flags would not be legible at 16 to 48px). Sources are `icons/icon.svg` (full), `icons/icon-small.svg` (favicon, ball only on a rounded square) and `icons/icon-maskable.svg` (Android, ball scaled into the safe zone). The PNGs in `icons/` and `favicon.ico` are rendered from them with Playwright (screenshot of the SVG at each size; opaque for `apple-touch-icon`; `favicon.ico` = `convert favicon-16.png favicon-32.png favicon-48.png favicon.ico`). Bump the `?v=` on the icon links in `index.html` and `manifest.json` when the artwork changes, so phones refetch it.
- `index.html` links the favicons, the 180px `apple-touch-icon`, a theme colour and `manifest.json`.

## Competitors screen

- Each competitor is an expandable `<details class="competitor-card">` (name, @username and status chips in the summary; fields stacked one per row inside, two columns from 700px wide). The add-competitor form is the first card. Field ids are unchanged (`edit-*-<username>`, `new-*-admin`) so the save/link/toggle functions are unchanged.
- `renderCompetitorManagement` re-renders itself (when accounts load, after linking or saving); `captureCompetitorScreenState` / `restoreCompetitorScreenState` keep open cards and unsaved edits across that. Only the add-competitor checkboxes are restored; the playing/admin checkboxes save immediately so the data is the truth.

## Home Screen app

- The app is installable as a full-screen web app: `manifest.json` has `display: standalone`, `index.html` has the `apple-mobile-web-app-*` meta tags and `viewport-fit=cover`, and `body` / `.modal` pad for `env(safe-area-inset-*)` (0 in a normal browser). A full-screen app has its own storage, separate from Safari, so it signs in on its own (login is a code for this reason).
- No reload gesture exists in full-screen mode, so the Match Summary has a Refresh button with an "Updated hh:mm" label, and `refreshWhenReturning` refreshes the summary when the app returns to the foreground after 5 minutes (only if the summary is showing, so unsaved predictions are never disturbed).
- `#installTip` is a dismissible tip shown only to iPhone/iPad Safari users who are not already in the full-screen app (flag in localStorage `rugbyPredictorInstallTipDismissed`).
- The Home Screen advice lives only in the tour (a step shown on iPhone/iPad when not already installed; `tourCanAddToHomeScreen`); there is no banner any more.
- If the artwork changes, re-render the PNGs and `favicon.ico` and bump the `?v=` on the icon links in `index.html` and `manifest.json`; browsers cache icons hard.

## Cache busting

- The site is served as static files with a browser cache of roughly 10 minutes. `index.html` loads `styles.css?v=...` and `app.js?v=...`, so a browser with a fresh page never pairs it with stale scripts or styles (that mismatch showed up as an empty dropdown and a tab that never hid).
- **Bump the `v=` value in both tags of `index.html` whenever `js/*.js` or `styles.css` changes (run `dev/bump.sh`; `dev/check.sh` verifies).** Use `YYYYMMDD-n`. Every script tag shares the same tag.

## Practical Guidance For Future Turns

- Grep `js/*.js` for the function, then read only that file; avoid loading the whole file unless required.
- Prefer `rg` around the function cluster you need, then inspect a narrow line range.
- Re-render assumptions should be explicit: many saves require `renderMatches`, `showSummary`, or `updateLeaderboard`.
- If a change touches admin and player views, verify both.
- Historical implementation plans for scoring/prize phases were intentionally trimmed from `docs/scoring-rules/`; treat this file plus the remaining ADR/runbooks/checklists/SQL as the durable source of truth.

## Scoring Rules History

### Accepted design decisions

- Scoring moved from hard-coded values to DB-backed admin-managed rules.
- Close-score bonus rules are:
  - granular per team score
  - only applied when the overall predicted result is correct
- Up to 3 close-score tiers are supported.
- Joker selections moved off `users.joker_match_id` into `user_joker_selections`.
- The app ended on a singleton rules model, not multi-ruleset publishing:
  - `scoring_rules` holds one effective row (`id = 1`)
  - `scoring_close_tiers` is singleton-friendly and no longer keyed by ruleset

### Current scoring defaults

- Correct result: `3`
- Perfect score bonus: `3`
- Draw bonus: `2`
- Default close tier: within `5` points for `+1`
- Max jokers per user default: `1`

## Schema History

### Phase 1 legacy scoring-rules schema

- Introduced:
  - `scoring_rule_sets`
  - `scoring_close_tiers` keyed by `rule_set_id`
  - `user_joker_selections`
- Added permissive RLS policies following existing project style.
- Seeded a default published ruleset.
- Backfilled legacy `users.joker_match_id` into `user_joker_selections`.

### Phase 6 singleton cleanup

- Replaced the legacy ruleset model with:
  - `scoring_rules`
  - `scoring_close_tiers` without `rule_set_id`
- Selected active published ruleset first, or latest fallback, during migration.
- Seeded fallback singleton defaults if no legacy ruleset existed.
- Preserved `user_joker_selections`.
- Dropped `scoring_rule_sets` after migration.

### Later schema additions

- Prize fields were added to `scoring_rules`:
  - `entry_fee_amount`
  - `payout_first_pct`
  - `payout_second_pct`
  - `payout_third_pct`
  - `payout_closest_tries_pct`
- Usage tracking added:
  - `usage_events`
  - indexes on `created_at`, `actor`, and `action`
  - permissive RLS policy
- Legacy joker cleanup migration:
  - backfill `users.joker_match_id` into `user_joker_selections`
  - drop `users.joker_match_id`

## Migration Notes

### Singleton rules migration runbook

- Preconditions:
  - deployed app must already read/write `scoring_rules`, singleton `scoring_close_tiers`, and `user_joker_selections`
  - backup/snapshot should exist first
- Execution flow:
  1. create singleton `scoring_rules`
  2. copy active published or latest legacy ruleset values
  3. rebuild `scoring_close_tiers` without `rule_set_id`
  4. confirm `scoring_rule_sets` is removed
  5. open app as admin and save rules once
  6. verify app as normal user still scores correctly
- Rollback expectation:
  - restore DB snapshot
  - redeploy pre-migration app if needed

### Prize migration notes

- Prize migration is additive on the singleton `scoring_rules` row.
- Singleton row should exist before prize migration verification.
- Recovery/export logic must include prize fields in both schema and data output.

## Regression Expectations

### Scoring and joker regression

- Correct-result points only award on correct result.
- Perfect score bonus stacks on top of correct-result points.
- Draw bonus only applies on actual draws predicted as draws.
- Close-score bonuses:
  - can stack per team
  - do not apply if the overall result is wrong
  - choose the highest bonus tier if multiple tiers match
  - break equal-bonus ties by choosing the tighter threshold
- Joker multiplier:
  - doubles total base points only when base points are greater than zero
- Joker limits:
  - `0` means no jokers selectable
  - `1` and `2` enforce hard selection caps
  - clearing a prediction on a joker match must clear the joker selection too
  - checklist/outstanding UI must show `selected/required`

### Prize regression

- Rules tab must block invalid payout totals unless all prize percentages are zero.
- Match Summary must show:
  - entrant count
  - total prize fund = `entry fee x eligible entrants`
  - tie-aware leaderboard payout splits
  - split closest-tries payouts on ties
  - provisional vs final tries status
- Tie examples to keep in mind:
  - tie for 1st splits combined occupied prize pots
  - tie for 2nd splits 2nd+3rd pots

### Recovery/export regression

- Recovery output (usage events are intentionally not exported; the empty `usage_events` table is still created) must include:
  - `scoring_rules`
  - `scoring_close_tiers`
  - `user_joker_selections`
  - prize fields on `scoring_rules`
- Usage/reporting schema should be preserved if recovery/export scope touches operational tables.

### Layout regression

- Rules admin layout must remain usable at small widths.
- Preview calculator and action buttons must remain usable on mobile.

## Removed Docs

- The old `docs/scoring-rules` folder was absorbed into this context file.
- If future work needs new migration/runbook notes, add only durable behavior here unless a standalone executable artifact is genuinely required.

## Match Summary reactions (emoji only)

- Text comments were removed; the feature is emoji reactions on a fixture (the 😀＋ chip in each column header) or on one person's prediction (tap a cell). They open in a centred pop-up (`#fixtureChatSheet` in `index.html`, styled as a modal; Escape or tapping outside closes it).
- `supabase/fixture_chat_migration.sql` still creates `fixture_comments` and `fixture_reactions` (six emoji, one of each per person). The app now only reads and writes `fixture_reactions`; `fixture_comments` is unused (left in the database, nothing else touches it). `target_user_id` is empty for the match and set for a prediction.
- `supabase/reaction_flags_migration.sql` (run after `fixture_chat_migration.sql`, idempotent) widens the allowed reaction emoji to the six plus the six team flags; every match offers the six plus its home and away flags (`chatEmojiOptions`). Until it has been run, reacting with a flag shows a save error.
- `js/fixture-chat.js` holds the feature. `Storage.getFixtureChat` runs inside `loadYearData`; if the reactions table is missing it returns `available: false` and the feature stays hidden, so the code can ship before the migration.
- The Match Summary table (`js/summary.js`) calls `chatChipMarkup`, `chatCellAttrs` and `chatCellBadge`; the hover tooltip on a prediction lists who reacted with what.
- Tests: `dev/tests/sql/fixture-chat.js` (security rules), `dev/tests/browser/fixture-chat.js` (behaviour), `dev/tests/sql/restore.js` (backup round trip).

## Guided tours (app and admin)

- `js/tour.js`. The "Take a tour" button in App Help starts the app tour; "Take the admin tour" in Admin Help starts the admin tour (`startTour('admin')`, admins only). Markup is `#tourLayer` in `index.html`.
- **The tour is a fixed card over a faded, blurred app.** It never moves, scrolls or switches tabs in the live app. Each step shows a static picture of the feature (`tour-images/*.jpg`, taken from the app on example data), numbered marks drawn on the picture (positions in `js/tour-images.js`), and numbered instructions that match the marks, including how to get there. Steps without a picture (the rules, and Add to Home Screen on iPhones/iPads) are text. The rules step is built from the year's real `getEffectiveScoringRules()`; the chat steps are left out until the chat tables exist.
- **When the screens the tour shows change, regenerate the pictures:** `dev/tour-shots.sh` (uses the mock Supabase from `dev/tests/browser/admin-collapse.js` and the example data in `dev/tour-demo.js`; it rewrites `tour-images/` and `js/tour-images.js`). Step text lives in `tourBuildSteps` / `tourBuildAdminSteps`.
- App tour steps: rules, add predictions, current score, PDF summary, reactions (emoji chips), stats (plus Add to Home Screen on iOS). Admin tour: menu, Fixtures and Scores, Predictions and the lock, Competitors, Guesser Rules, Prize Fund, Years.
- **Animations:** the card eases in; moving between steps slides the title and content in from the side you are heading (`tour-go-next` / `tour-go-prev` on the card, via `tourAnimateStep`), marks pop in one by one, the progress dots stretch, and the card eases between the small text-only size and the full picture size (`tourAnimateSize`; the picture is sized once that finishes). All switched off under `prefers-reduced-motion`.
- **No scrolling:** `tourFitContent()` sizes the card contents to the visible area (`--tour-h`, set from `visualViewport` so iPhone Safari's toolbars are handled): the picture shrinks to the room left under the text, the text tightens (`.tour-compact`) on small screens, and on very short screens the picture is dropped so the instructions are always fully visible. The picture stays invisible until it has been sized.
- **Offers:** `maybeOfferTour()` (from `showApp`) asks once after sign-in; `maybeOfferAdminTour()` (from `showTab`) asks the first time an admin opens Admin Functions. "No thanks" or finishing is remembered in `localStorage` (`tourAnswered:<user>`, `adminTourAnswered:<user>`, per person per device); leaving half way means they are offered again.
- Test: `dev/tests/browser/tour.js`.

## Past-year warning banner

- `pastYearWarning(year, now)` in `js/years-admin.js`: a banner (`[data-past-year-banner]`) warns admins who are changing a year that is over. Red when the year is before the current calendar year ("past year"), amber when it is this year and the month is April or later ("normally finishes in March"). Shown in the Fixtures and Scores, Predictions, Guesser Rules and Prize Fund sections and in the next-score, edit-fixture and bulk-import pop-ups; refreshed by `updatePastYearBanners()` (from `showTab`, `switchYear` and the pop-up openers). `appNow()` is a hook so tests can pretend it is another date. Test: `dev/tests/browser/past-year.js`.

## Prize fund exemptions

- Who has not paid is a per-year setting, stored in the `settings` table as `prize_exempt:<year>` = `{ "<username>": true }` (no migration needed). `appSettings.prizeExempt`, `isPrizeExempt(username)` and `toggleCompetitorPrizeExempt()` are in `js/years-admin.js`; `Storage.savePrizeExempt` saves it, and it is renamed/removed with a competitor (`updateActiveOverrideUsername`) and removed with a year.
- On the Competitors screen each card has an "Exempt from the prize fund in <year> (has not paid)" checkbox (also in the Add a competitor details), and a "Not in prize fund" chip in the card header. `calculatePrizeProjection` (`js/leaderboard.js`) leaves exempt people out of the entrant count, pot, payouts and the closest-tries prize; they stay on the leaderboard. There is no hard-coded rule for the "AI" player any more: tick the box for them like anyone else. (`isAiPlayer` still only drives the robot icon and the playful asides.)
- Test: `dev/tests/browser/prize-exempt.js`.

## Slim top bar (header layout)

- Signed in (or browsing as a guest), the big title is hidden (`body.in-app`, set by a MutationObserver in `js/app-bar.js`) and the top of the app is one slim bar: small title, a year chip (`#yearSelect`), and an avatar button (`#avatarBtn`, first letter of the display name, red dot for admins) that opens the account menu (`#accountMenu`): name (opens the profile), Theme (`#themeSelect`), Help (`#menuHelpBtn`) and Log out (`#logoutBtn`; reads "Sign In" for guests). The three screens are one slim row of tabs (`#appView > .tabs`). The Match Summary has one toolbar: All matches / Current round, a PDF icon (`#exportPdfBtn`) and a refresh icon (`#summaryRefreshBtn`), then an "Updated" line with the admin-only "+ ITA v SCO score" pill (`#nextMatchScoreMainBtn`, shown while there is a next match to score).
- Tour text and pictures follow these screens: after changing them run `dev/tour-shots.sh` and update the step text in `js/tour.js`. The login screen still has the big title.
- Layout by width: the tabs and the "Updated / + score" row live inside `.app-bar` and `.summary-toolbar` (so they can move). Under 900px the tabs get their own row under the bar and the "Updated" line its own row under the toolbar; from 900px up the tabs sit in the bar beside the title and year (avatar far right), and the toolbar is one row (filters 340px, icons, then "Updated" and the score pill on the right).
- The page must never scroll sideways (a wide table may scroll inside its own box). `dev/tests/browser/no-hscroll.js` checks every screen and pop-up at seven widths from 320 to 1280px. The Years table stacks into cards under 700px (`.admin-table-stack`, `data-label`s), and the Predictions toolbar wraps.
- Home Screen app on iPhone: `apple-mobile-web-app-status-bar-style` stays `black-translucent` (full-screen content), but a fixed solid cover (`body::after`, height `env(safe-area-inset-top)`) and a solid `html` background keep the status bar area opaque deep green instead of a see-through strip with the page fading under it. It is zero height in a normal browser. Test: `dev/tests/browser/safe-area.js` (uses Chromium's safe-area emulation).
- Opens at the very top: `js/app-bar.js` sets `history.scrollRestoration = 'manual'`, scrolls to the top on load (and again at 0.3s, 0.9s and 2s unless the person has already scrolled), after a login, when restored from the back/forward cache, and when the app returns after more than 5 minutes away. Test: `dev/tests/browser/open-top.js`.

- Rounds are inferred from fixture dates (`assignRoundsFromDates` in `js/years-admin.js`): fixtures in the same Monday to Sunday week (a Thursday to Sunday weekend) are one round, numbered from the earliest week. It runs when a year's fixtures load and inside `Storage.saveMatches`, so the stored `round` column is kept in step. There is no round input on Edit Fixture, and Bulk Import ignores a leading round number. Fixtures with no usable date keep their old round.

## Match Summary table layout

- Header cells and prediction cells use fixed slots (see "fixed slots" blocks at the end of `styles.css`) so rows line up whatever a match or cell has: header = joker badge, teams, date, result, tries, reactions chip; cell = score, points pill, then one line (`.cell-extras`) holding the Joker card beside the top emoji (at most two emoji when the cell holds a Joker, otherwise three: `chatCellMaxEmoji`). Tests: `summary-header-slots`.
- Prediction cells have no hover tooltip when the reactions pop-up is available (`fixtureChat.available`); clicking or tapping a prediction opens the pop-up with the score, points breakdown, Joker note and who reacted. The tooltips remain only if the reactions table is missing. The Predicted Tries column keeps its small tooltip.
- A phone held sideways (`orientation: landscape`, `max-height: 500px`, `hover: none`) collapses the match headers to the countries and score (CSS only).
- The pinned header is a copy of the header row in a sticky strip (`buildSummaryStickyHead` in `js/app-bar.js`); it is rebuilt after every summary render. Tests: `summary-pin`, `landscape-header`, `touch-no-tooltips`.
- Compact mode: the two-arrows button beside refresh (`#summaryCompactBtn`, `toggleSummaryCompact()` in `js/app-bar.js`, remembered in localStorage `summaryCompact`) adds `body.summary-compact`, which hides the emoji rows (`.cell-extras`, `.match-extras`) and the header dates and tries; the Joker then shows inline beside the score (`.joker-inline`). The header's Joker-eligible card sits beside the reactions chip in `.match-extras`. Teams are always on two rows (no "vs"). On desktop (900px and up) the app is full width with a slim side border.

## Remembered view (localStorage)

- `lastTab` (`predictions` / `summary` / `adminHome`, saved in `showTab`, restored by `restoreLastTab()` after sign-in) and `summaryView` (`{filter, round}` for All matches / Current round and which round, saved by `filterMatches` / `onRoundSelectChange`, restored by `restoreSavedSummaryView()`). Other localStorage keys: `summaryCompact`, `rugbyPredictorColourMode`, tour answers.
- The Points Progression chart follows the same filter as the table: all games, or only the selected round's games with running totals carried on from earlier rounds (title shows the round). Test: `remember-view`.
- Compact mode defaults on for phones (`isPhoneScreen()`: width 480px or less, or a phone held sideways) when nothing is saved; a saved choice (`summaryCompact` 1/0) always wins. A phone held sideways also uses the full width with a 0.5rem border. The tour covers it in slide 3 (See the current score), point 3. Test: `compact-default`.

- Usage log: `supabase/usage_events_trim_migration.sql` (idempotent) adds a trigger that keeps only the newest 100 `usage_events` rows after every insert (a security definer function, so it works for non-admins; clients cannot call it) and trims existing rows when run. Test: `dev/tests/sql/sql-usage-trim.js`; `verify_security.sql` check 20. The Usage Report shows those 100; "Remove All Usage Events" still clears the log.
- Taps: a match header (anywhere, not just the chip) opens that match's reactions; a prediction cell opens the prediction; a point on the Points Progression chart opens that game in the same pop-up (`openWormPointDetail`; there are no tooltips on the chart or the summary table, and the Predicted Tries column shows just the number, in All matches view only). On phones the Competitor and Score headers are larger and set at an angle (`.th-angled`). Test: `header-click`.
- PDF export: on desktop (`isDesktopPointer()`: hover and a fine pointer) `exportToPDF` shows the page in a pop-up (`#pdfModal`, `showPdfModal`) with Print and Save PDF; phones and tablets keep `doc.save` (opens in their own viewer/tab); `?export=pdf` still opens the file in the tab. Test: `pdf-modal`.
- Start-up: the loading screen stays up until the sign-in state is known (`authSettled`, `settleAuth()` in `js/auth.js`; an 8s fallback shows the login form). `#loginView` starts hidden and `showLoginScreen()` reveals it, so a restored session never flashes the login form (or Safari's email AutoFill bar). Test: `no-login-flash`.

## Unsaved changes

- `js/unsaved-changes.js`: a toast at the top ("Unsaved changes: <area>") and an outline on edited fields. `UNSAVED_AREAS` lists the in-page forms covered (rules, prize fund, competitor cards, add-a-year). The tournament tries boxes (My Predictions and admin) are not covered because they save themselves: `scheduleTriesAutosave` / `flushTriesAutosave` in `js/predictions.js` save 800ms after typing stops, on blur, and when the page is hidden, with a small status line (`#triesSaveStatus`) and no Save button. Pop-ups (Edit Prediction, Edit Fixture, quick score, Profile) are deliberately not tracked: they ask for Save or Cancel in front of you. A field's baseline is its value when first focused; the save functions are wrapped (at DOMContentLoaded) and re-baseline their area when they finish without an error alert; screens that re-draw drop their old fields. Instant-save toggles and chooser drop downs are ignored (`UNSAVED_IGNORE`). It also asks the browser to confirm leaving the page while something is unsaved. Add new forms to `UNSAVED_AREAS`. Test: `unsaved-toast`.
- Points Progression has a phone layout (`wormChartIsPhone()`, width 600px or less): a narrower, taller plot (420 units high) with bigger labels, points and lines (`.worm-chart-svg.phone` in `styles.css`); it redraws when the screen crosses that size (`refreshWormChartLayout`). Test: `worm-phone`.
- Default year: `defaultYear()` in `js/years-admin.js` is the calendar year, or the next one from 1 November (`calendarDefaultYear`), if that year exists; otherwise the latest year with fixtures. A year picked on a device is remembered together with the default of that day (`rugbyPredictorSelectedYearDefault`) and only honoured while that default is unchanged, so each November everyone lands on the new season once. The login screen subtitle follows the selected year. Test: `default-year`.

## Hidden predictions until lock
- `predictionsRevealed()` (scoring.js) is true when the year is locked (`appSettings.predictionsLocked`) or any result exists. Until then `canSeePredictionsOf(username)` only allows your own row; `getViewablePrediction()` is the safe accessor.
- Summary cells for other players show 🔒 (`td.hidden-prediction`), the Predicted Tries column shows 🔒, a `.predictions-hidden-note` banner explains it, the prize panel shows "Shown when predictions lock" for closest tries, and the PDF export uses the same helpers. The admin Predictions screen is unchanged.
- Test: `dev/test.sh hidden-predictions`.

## Last year's guess in the edit-prediction modal
`loadLastYearNote` (predictions.js) finds last year's fixture with the same two teams (either order), fetches that player's prediction for it, and shows "Last year (YYYY) You predicted a-b, the result was c-d." under the scores (`#edit-prediction-lastyear`), in this year's home/away order. Hidden when there is no such fixture or prediction. Test: `dev/test.sh last-year-note`. The admin tour's Fixtures step now promotes Bulk Import and suggests Google AI for generating the lines.

Tour pictures: the picture stays hidden until the 120ms refit has sized it (no tiny flash on first open), and step text must stay short or the picture shrinks (the admin Fixtures step is the longest). Test: `dev/test.sh tour-picture-size`.

## Connectivity (network.js, connectivity.js)
- `netFetch` (network.js) is the Supabase client's fetch: 20s timeout on everything, tracks `NET.offline`, and **refuses writes** (`/rest/v1/` non-GET) when offline with a 503 "not saved" response and a banner. Writes are never queued or answered from a cache.
- connectivity.js wraps the `Storage` read methods in `CACHED_READS`: a good read saves a copy in `localStorage` (`rugbyPredictorReadCache:v1:<name>[:<year>]`); if the network fails, the saved copy is returned instead and `#connectionBanner` says "Showing scores saved at HH:MM". `clearReadCache()` runs on logout.
- Live refresh: every 30s `liveRefreshTick` refreshes the summary (keeping scroll position) if the summary tab is showing, the page is visible, and a fixture kicked off within the last 3 hours; at most every 2 minutes. While a match is live, coming back to the page refreshes after 1 minute (5 otherwise).
- Test: `dev/test.sh connectivity`.

The app remembers only My Predictions or Match Summary as the last tab (never Admin); an old saved Admin value is ignored. Test: `dev/test.sh last-tab`.

A player's Joker pick on the summary has a small gold circle behind the card (`td.joker-cell .joker-indicator` in the full view, `body.summary-compact .cell-score .joker-inline` in compact); the header card has none. Look: `dev/test.sh joker-circle`.

Before predictions lock (and with no result in), the Match Summary shows only a bulleted "Signed up for <year>" list (`getActiveUsernames()`), not the table. The table (with 🔒 cells for others, for the odd case) appears once locked or any result exists.

New-version check (connectivity.js): about 1.5s after loading, and whenever the app comes back to the front, it fetches a fresh index.html (no-store) and compares the connectivity.js version tag with its own; a newer one reloads the app automatically (once per version, never while a pop-up or the tour is open). Needed because a Home Screen app can keep an old copy of the page. Test: `dev/test.sh version-check`.

Refresh efficiency: `getUsers`/`getUserJokerSelections` fetch only the selected year's fixtures. The 2-minute live refresh (`refreshLiveScores` in connectivity.js) fetches only that year's matches (`Storage.getYearMatches`) and the reactions. `showSummaryIfChanged()` (summary.js) skips the redraw when `summarySignature()` is unchanged; manual refresh uses it too.

Load time: jsPDF and its table plugin are fetched on demand by `loadPdfLibs()` (export-pdf.js) and quietly ~6s after start-up, not in `<head>`. The Google Fonts stylesheet loads without blocking rendering (`media="print"` swap). The tour pictures are WebP: `dev/tour-shots.sh` writes JPEGs then `dev/tour-webp.py` converts them and updates js/tour-images.js. Test: `dev/test.sh pdf-lazy`.


## Build and service worker
- Sources are `js/*.js` (order: `js/load-order.txt`) and `styles.css`. `dev/build.sh` concatenates and minifies them into `dist/app.min.js` and `dist/app.min.css` (esbuild via npx, pinned), writes `?v=<hash of the built files>` into `index.html`, and generates `sw.js` from `dev/sw.template.js`. `dist/` and `sw.js` are committed build output. `dev/bump.sh` is an alias for the build; `dev/check.sh` fails if `dist/` is out of date. Tests run against the built files.
- `sw.js` (service worker): precaches the app shell; the page is network-first (4s, then the saved copy); `dist/`, `tour-images/`, `icons/` are cache-first; the CDN libraries and fonts are stale-while-revalidate; Supabase calls, non-GET requests and the new-version check (`?_=`) are never handled by it. It is registered in `js/connectivity.js`. Test: `dev/test.sh service-worker` (it blocks the worker in other http tests: `serviceWorkers: 'block'`).
- New file in `js/`: add it to `js/load-order.txt`. Version check: `js/connectivity.js` compares the `?v=` of `dist/app.min.js` with the one in a freshly fetched `index.html`.

Pinned summary header: two layers (`.summary-sticky-pinned` = the first three columns, fixed; `.summary-sticky-scroll` = everything else, moved sideways with one `translate3d` in `syncSummaryStickyScroll`), instead of scrolling a copy with `scrollLeft` on every scroll event. Test: `dev/test.sh header-sideways`.

Pinned summary header is positioned by the browser alone (no scroll script): `.summary-sticky-zone` (absolute, top = the table, height = table minus the last row; set by `layoutSummarySticky` and a ResizeObserver) contains `.summary-sticky-head` (`position: sticky`) which holds the copy. The copy always sits exactly over the real header, sticks at the top while scrolling, and slides away with the table above the last row. Only the sideways movement still uses a script (one transform). Tests tap the copy (`.summary-sticky-inner`) since it covers the real header.

## Table view switch and the Classic view
- The Full / Compact / Classic switch (`#summaryViewSwitch`) lives in the player menu (top right), under Appearance (`#accountViewRow`). The summary toolbar has All matches / Current round (`#summaryFilterToggle`) then the download icon (`#exportPdfBtn`: downloads/opens the PDF file); Classic hides the filter and the round dropdown. There is no refresh button: the summary refreshes whenever the app comes back on screen (at most every 15 seconds, only on the Match Summary tab so nobody's typing is disturbed), every 2 minutes during a live match, and when the connection returns.
- `summaryViewMode` (app-bar.js) is remembered in `localStorage` `summaryViewMode` (an older `pdf` value is read as `classic`; the older `summaryCompact` key is still read and written). Compact is the default on phones.
- Classic mode (`js/pdf-view.js`, `buildPdfStyleViewHtml`): the table drawn in HTML like the PDF export: same columns (home, away, pts, joker per match, then Game Total, Total Tries, Final Rank), Result and Try Count rows, win/lose/draw colouring, every-other-row lightening, rank colours and line weights. Always the whole tournament. The A4 sheet is drawn at 297mm width and scaled to the box (`fitPdfView`, with a ResizeObserver).
- Colours: `PDF_SCHEMES.light` is exactly the PDF's palette (the PDF export reads its colours from it, so they cannot drift); `PDF_SCHEMES.dark` is the dark scheme. Every cell carries both as CSS variables (`--bg/--fg` and `--bg-d/--fg-d`), so changing the app's theme needs no redraw. Test: `dev/test.sh classic-view`.
- The tour has a "See the leaderboard" step (renamed from "See the current score"; the stats step was removed), a "Choose your view" step (a big picture of each view, `tour-images/view-*.webp`, with a selector that sets the default view: `tourPickView`) and a "Change your view any time" step with a picture of the open player menu (`menu-view.webp`, also covering Appearance: Auto/Light/Dark). Pictures are made by `dev/tour-shots.sh`. The pinned header does not exist in Classic mode (no `.summary-table-wrap`).

## Emoji reactions removed
- The emoji reactions feature (chips under match headers, badges in cells, reaction buttons and "who reacted" in the pop-up, the tour step) is gone. The pop-up itself stays (js/fixture-chat.js, name kept): tap a prediction for how it was scored, a match header for the match facts, a chart point for that game. `Storage` no longer reads or writes `fixture_reactions`; the table and its SQL migration are left in the database untouched (nothing deletes the old reactions). Test: `dev/test.sh match-details`.

Tour pictures: `tourPreload(kind, true)` fetches every picture the moment the tour opens (high priority). Any step with pictures (`.tour-figure` or the view chooser `.tour-view-pics`) stays hidden until its images have loaded, then is fitted; the view chooser only shrinks its picture when the body really overflows. Tests: `tour-late-picture`, `tour-picture-heights`, `tour-fixed-size`.

Compact view: the Score column is hidden and `.comp-score` (inside `.comp-sub`, beside the flags) shows the score. The Points Progression chart zooms like the Classic view (`zoomWormChart`, `enableWormPinch`, controls in `.worm-chart-tools`). The Classic sheet says "Updated <weekday, date> at <time>". Test: `dev/test.sh zoom-and-score`.
