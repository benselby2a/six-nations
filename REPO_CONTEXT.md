# Six Nations Guesser Repo Context

## Snapshot

- App type: single-page static web app.
- Main files: `index.html`, `app.js`, `styles.css`.
- Backend: Supabase accessed directly from the browser through `@supabase/supabase-js`.
- Rendering style: vanilla JavaScript building large HTML strings and writing `innerHTML`.
- Export: PDF generation via `jsPDF` and `jspdf-autotable`.

## File Map

### `index.html`

- Loads Google Fonts, Supabase client, jsPDF, and `styles.css`.
- Contains login view, profile modal, summary tab, predictions tab, and admin-only tabs.
- Most actions are wired with inline `onclick` handlers that call globals from `app.js`.

### `app.js`

- Holds nearly all application logic and in-memory state.
- Declares fixture list, flag helpers, auth helpers, storage abstraction, scoring logic, UI rendering, admin tools, prize logic, recovery SQL, and usage reporting.
- Important pattern: many functions depend on global mutable state (`users`, `matches`, `adminUsernames`, `appSettings`, `activeScoringRules`, `userJokerSelections`, `currentUsername`).

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
- `Storage.saveScoringRulesDraft`, `Storage.publishScoringRules`
- `Storage.saveUserJokerSelections`

This is the main browser-to-Supabase boundary.

### Predictions / user gameplay

- `renderMatches`
- `loadPredictions`
- `autoSavePredictions`
- `saveTournamentTries`
- `selectJoker`
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

### Summary logic is duplicated conceptually across features

- Leaderboard, prize projection, tries stats, tips, and PDF export all derive from overlapping match/user state.
- If changing scoring or display rules, verify all of those outputs.

### Prize and ranking behavior

- Prize projection is intentionally distinct from raw leaderboard order.
- Current special rule: AI player is shown on the leaderboard but excluded from prize payouts, with a prize footnote when exclusion affects displayed winners.
- Current special rule: AI player always shows `🤖` as supporter flag via `getUserFlags`.

## Recent Special Cases Worth Remembering

- AI player exclusion from prize payouts is implemented in `calculatePrizeProjection`.
- AI supporter icon override is implemented in `getUserFlags`.
- Prize summary footnotes combine tries status plus AI exclusion note.

## Fast Path For Common Tasks

### Change scoring rules

- Read `normalizeScoringRules`, `calculateMatchPointsBreakdownWithRules`, `renderRulesPreview`, and `showSummary`.

### Change prize behavior

- Read `calculatePrizeProjection` and `renderPrizeMoneyPanel`.
- Then check `showSummary` and leaderboard output.

### Change competitor/profile display

- Read `getDisplayName`, `getUserFlags`, profile modal code, competitor management, and summary row rendering.

### Change fixture/result entry

- Read `renderAdminMatches`, `saveNextMatchScore`, `saveFixtureEdits`, `autoSaveResults`, and `processBulkImport`.

### Change persistence shape

- Start in the `Storage` object and verify matching SQL/recovery generation code later in the file.

## Practical Guidance For Future Turns

- Read only the relevant sections of `app.js` first; avoid loading the whole file unless required.
- Prefer `rg` around the function cluster you need, then inspect a narrow line range.
- Re-render assumptions should be explicit: many saves require `renderMatches`, `showSummary`, or `updateLeaderboard`.
- If a change touches admin and player views, verify both.
