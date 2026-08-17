# Six Nations Guesser Repo Context

## Snapshot

- App type: single-page static web app.
- Main files: `index.html`, `app.js`, `styles.css`.
- Backend: Supabase accessed directly from the browser through `@supabase/supabase-js`.
- Rendering style: vanilla JavaScript building large HTML strings and writing `innerHTML`.
- Export: PDF generation via `jsPDF` and `jspdf-autotable`.
- Current notable summary surfaces:
  - `Tournament Stats` panel with live tries totals plus a per-load `The Statto` fact.
  - `Trev's Tips` panel with per-load cached commentary phrasing.

## File Map

### `index.html`

- Loads Google Fonts, Supabase client, jsPDF, and `styles.css`.
- Contains login view, profile modal, summary tab, predictions tab, and admin-only tabs.
- Most actions are wired with inline `onclick` handlers that call globals from `app.js`.
- Admin sub-tab labels are user-facing copy and currently read:
  - `Fixtures and Scores`
  - `Predictions`
  - `Competitors`
  - `Guesser Rules`
  - `Prize Fund`

### `app.js`

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
    passwordHash,
    totalTries,
    supportedTeams: [],
    predictions: {
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
  jokerEligible
}
```

### Other Global State

- `adminUsernames`: lowercase usernames with admin access.
- `appSettings`: includes prediction locking and other app-wide settings.
- `activeScoringRules`: current scoring and prize configuration.
- `userJokerSelections`: selected joker match ids per user.
- `currentUsername`: active logged-in user or `guest`.

## Main Runtime Flow

1. `initializeData()` loads users, admins, settings, matches, scoring rules, and joker selections from Supabase.
2. `init()` renders the main UI shells.
3. `showApp()` or `showAppAsGuest()` selects the visible mode.
4. Most user actions save via `Storage.*`, mutate in-memory globals, then re-render affected sections.

## Important Function Clusters In `app.js`

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

### `app.js` is monolithic

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

## Practical Guidance For Future Turns

- Read only the relevant sections of `app.js` first; avoid loading the whole file unless required.
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

- Recovery output must include:
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
