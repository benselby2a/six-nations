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

### `js/` file map (load order, all classic scripts sharing one global scope; no build step)
`constants` fixtures/flags/team helpers; `storage` Supabase client and `Storage`; `state` globals, usage tracking, escaping, cookies, remembered user; `years-admin` years, Years tab, readiness checklist, who plays; `init` initializeData/init/lock toggle; `admin-fixtures` fixtures, bulk import, results; `admin-competitors` competitors, invitations, account linking; `profile` profile, theme, help; `auth` login code flow, handleAuthChange, showApp; `predictions` predictions UI and admin prediction editing; `scoring` rules and points; `trevs-tips` Trev's Tips/Statto text; `leaderboard` round filter, prize projection/panel; `worm-chart`; `summary`; `fixture-chat` Match Summary comments and emoji; `export-pdf`; `rules-admin` rules and prize forms; `recovery-usage` recovery SQL, usage report; `app-shell` showTab, refresh, install tip, start-up wiring (auth listener) last. Keep this order: files run top to bottom at load.
Admin menu: `#adminPanel` folds to a slim bar when an admin section opens (`setAdminPanelCollapsed` in `app-shell`); tapping its heading reopens it.

### (legacy notes below were written for the single `app.js`)

- Holds nearly all application logic and in-memory state.
- Declares fixture list, flag helpers, auth helpers, storage abstraction, scoring logic, UI rendering, admin tools, prize logic, recovery SQL, and usage reporting.
- Important pattern: many functions depend on global mutable state (`users`, `matches`, `adminUsernames`, `appSettings`, `activeScoringRules`, `userJokerSelections`, `currentUsername`).
- Commentary/stat presentation has per-app-load randomness:
  - `The Statto` chooses one random fact at load and keeps it static for the session.
  - `Trev's Tips` chooses a cached voice/loadout at load and reuses it for the session.

### `styles.css`

- Contains three themes: `classic`, `retro`, `dark`.
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
- The readiness checklist is hidden entirely when all four steps are done, and reappears when any step is outstanding. While visible, its header toggles it open/closed; the choice is remembered in localStorage (`rugbyPredictorChecklistCollapsed`).
- The Admin Functions home shows a readiness checklist for the viewed year (`renderReadinessChecklist`): 15 fixtures added, all predictions in (every *active* competitor must have scores, tries and jokers), Guesser Rules saved, Prize Fund saved. "Saved" is recorded in `settings` as `rules_saved:<year>` / `prize_saved:<year>` when the admin clicks Save in that tab (a new year's rules are copied forward, so a stored row alone does not mean reviewed). `saveUpdatedRules('rules'|'prize')` writes the flag.
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
- `saveTournamentTries`
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

- Original artwork (not the official Six Nations crest): a gold rugby ball inside a ring of the six nations' flags (England, France, Italy, Wales, Ireland, Scotland) on green. Sources are `icons/icon.svg` (full), `icons/icon-small.svg` (favicon, ball only) and `icons/icon-maskable.svg` (Android, inside the safe zone). The PNGs in `icons/` and `favicon.ico` are rendered from them (opaque, as iOS requires for `apple-touch-icon`).
- `index.html` links the favicons, the 180px `apple-touch-icon`, a theme colour and `manifest.json`.

## Competitors screen

- Each competitor is an expandable `<details class="competitor-card">` (name, @username and status chips in the summary; fields stacked one per row inside, two columns from 700px wide). The add-competitor form is the first card. Field ids are unchanged (`edit-*-<username>`, `new-*-admin`) so the save/link/toggle functions are unchanged.
- `renderCompetitorManagement` re-renders itself (when accounts load, after linking or saving); `captureCompetitorScreenState` / `restoreCompetitorScreenState` keep open cards and unsaved edits across that. Only the add-competitor checkboxes are restored; the playing/admin checkboxes save immediately so the data is the truth.

## Home Screen app

- The app is installable as a full-screen web app: `manifest.json` has `display: standalone`, `index.html` has the `apple-mobile-web-app-*` meta tags and `viewport-fit=cover`, and `body` / `.modal` pad for `env(safe-area-inset-*)` (0 in a normal browser). A full-screen app has its own storage, separate from Safari, so it signs in on its own (login is a code for this reason).
- No reload gesture exists in full-screen mode, so the Match Summary has a Refresh button with an "Updated hh:mm" label, and `refreshWhenReturning` refreshes the summary when the app returns to the foreground after 5 minutes (only if the summary is showing, so unsaved predictions are never disturbed).
- `#installTip` is a dismissible tip shown only to iPhone/iPad Safari users who are not already in the full-screen app (flag in localStorage `rugbyPredictorInstallTipDismissed`).
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

## Match Summary chat (fixture comments and reactions)

- `supabase/fixture_chat_migration.sql` (run after `profile_second_email_migration.sql`) adds `fixture_comments` (max 140 chars) and `fixture_reactions` (six emoji, one of each per person). `target_user_id` is empty for chat about a match and set for chat about one competitor's prediction. Anyone, guests included, can read; a signed-in competitor inserts and deletes only their own rows (`current_competitor_id()`); admins can delete any. Comments cannot be edited. Deleting a competitor or fixture deletes its chat.
- `js/fixture-chat.js` holds the feature. `Storage.getFixtureChat` runs inside `loadYearData`; if the tables are missing it returns `available: false` and the feature stays hidden, so the code can ship before the migration.
- The Match Summary table (`js/summary.js`) calls `chatChipMarkup` (a chip in each fixture column header), `chatCellAttrs` and `chatCellBadge` (prediction cells open that prediction's chat). The sheet (`#fixtureChatSheet` in `index.html`) is a bottom sheet on phones and a right drawer from 900px. It replaces the touch tooltip on cells; the desktop hover tooltip still shows. Chips and badges update in place (`refreshChatIndicators`) so the table keeps its scroll position.
- The backup SQL drops the chat tables before `users`, and restores their rows after the migrations (restore order is listed in the generated SQL).
- Tests: `dev/tests/sql/fixture-chat.js` (security rules), `dev/tests/browser/fixture-chat.js` (behaviour), `dev/tests/sql/restore.js` (backup round trip).

## Guided tours (app and admin)

- `js/tour.js`. The "Take a tour" button in App Help starts the app tour; "Take the admin tour" in Admin Help starts the admin tour (`startTour('admin')`, admins only). Markup is `#tourLayer` in `index.html`.
- **The tour is a fixed card over a faded, blurred app.** It never moves, scrolls or switches tabs in the live app. Each step shows a static picture of the feature (`tour-images/*.jpg`, taken from the app on example data), numbered marks drawn on the picture (positions in `js/tour-images.js`), and numbered instructions that match the marks, including how to get there. Steps without a picture (the rules, and Add to Home Screen on iPhones/iPads) are text. The rules step is built from the year's real `getEffectiveScoringRules()`; the chat steps are left out until the chat tables exist.
- **When the screens the tour shows change, regenerate the pictures:** `dev/tour-shots.sh` (uses the mock Supabase from `dev/tests/browser/admin-collapse.js` and the example data in `dev/tour-demo.js`; it rewrites `tour-images/` and `js/tour-images.js`). Step text lives in `tourBuildSteps` / `tourBuildAdminSteps`.
- App tour steps: rules, add predictions, current score, PDF summary, comments (chat chips), stats (plus Add to Home Screen on iOS). Admin tour: menu, Fixtures and Scores, Predictions and the lock, Competitors, Guesser Rules, Prize Fund, Years.
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
