---
phase: 04-opportunity-detection-notifications
plan: "05"
subsystem: bot-commands
tags: [telegram-bot, history-command, config-command, tdd, grammy]
dependency_graph:
  requires:
    - "04-02"  # loadDetectionConfig
    - "04-03"  # getRecentOpportunities, OpportunityHistoryRow
  provides:
    - "/history bot command (D-18 format)"
    - "/config bot command (D-20 format)"
    - "NOTIF-02 fully satisfied"
  affects:
    - "src/bot/index.ts"
    - "src/bot/commands/"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted() for vitest mock stubs referenced in vi.mock factories"
    - "Inlined formatSaoPauloTimestamp to break transitive @/lib/telegram import chain"
    - "SOURCE_DISPLAY_NAMES inlined const to avoid coupling to digest.ts"
key_files:
  created:
    - src/bot/commands/history.ts
    - src/bot/commands/config.ts
    - src/bot/__tests__/commands/history.test.ts
    - src/bot/__tests__/commands/config.test.ts
  modified:
    - src/bot/index.ts
decisions:
  - "Used vi.hoisted() instead of module-level variable declaration to fix 'Cannot access before initialization' error in vitest mock factories — vi.mock calls are hoisted above module-level code"
  - "Inlined formatSaoPauloTimestamp and SOURCE_DISPLAY_NAMES in history.ts to avoid importing from digest.ts (which transitively imports @/lib/telegram and would force test mocking)"
metrics:
  duration: "~11 minutes (665 seconds)"
  completed: "2026-05-08"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
  commits: 5
---

# Phase 04 Plan 05: /history and /config Bot Commands Summary

**One-liner:** TDD-verified /history (D-18 format, inlined timestamp helper) and /config (D-20 read-only display) commands complete NOTIF-02 with module-graph isolation.

## What Was Built

Two new Telegram bot commands complete the NOTIF-02 requirement:

- `/history` — Returns the 10 most recent opportunities from the DB in D-18 format. Calls `getRecentOpportunities(10)` from Plan 03's query layer. Inlines `formatSaoPauloTimestamp` (America/Sao_Paulo via `Intl.DateTimeFormat`) and `SOURCE_DISPLAY_NAMES` to stay decoupled from `@/lib/opportunities/digest`.
- `/config` — Returns a read-only display of the current detection configuration in D-20 format. Calls `loadDetectionConfig()` from Plan 02's config loader. Ignores any command arguments (read-only by design).

Both commands were registered in `src/bot/index.ts` and added to `bot.api.setMyCommands`, bringing the bot menu to 7 entries: start, add, remove, list, price, history, config.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | /history failing tests | ea7bf9d | src/bot/__tests__/commands/history.test.ts |
| 1 (GREEN) | /history implementation | 8f9dafd | src/bot/commands/history.ts, test update |
| 2 (RED) | /config failing tests | 67da829 | src/bot/__tests__/commands/config.test.ts |
| 2 (GREEN) | /config implementation | 8f55179 | src/bot/commands/config.ts |
| 3 | Register in bot entrypoint | c333a53 | src/bot/index.ts |

## Verification Results

- `pnpm test src/bot/__tests__/commands/history.test.ts --run`: 8/8 tests pass
- `pnpm test src/bot/__tests__/commands/config.test.ts --run`: 7/7 tests pass
- `pnpm test src/bot --run`: 15/15 active tests pass (17 skipped pre-existing stubs, 6 todo)
- TypeScript: no errors in new files (pre-existing unrelated errors in tailwind.config.ts, auth.test.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vitest hoisting issue with botStub mock reference**
- **Found during:** Task 1 GREEN (first test run)
- **Issue:** The test file used a module-level `botStub` variable referenced inside `vi.mock()` factory. Vitest hoists `vi.mock()` calls above module code, causing "Cannot access 'botStub' before initialization" ReferenceError.
- **Fix:** Replaced module-level `const commandHandlers = {}` and `const botStub = {...}` with `vi.hoisted(() => ...)` to ensure they are evaluated in the hoisted scope before the mock factory runs. Both test files use this pattern.
- **Files modified:** `src/bot/__tests__/commands/history.test.ts`, `src/bot/__tests__/commands/config.test.ts`
- **Commits:** ea7bf9d (updated in GREEN commit 8f9dafd)

**2. [Rule 3 - Blocking] Copied Phase 4 dependency files into worktree**
- **Found during:** Task 1 setup
- **Issue:** This worktree (agent-aab278a4ed68a723b) was based on commit ffd46c4 (older than the Phase 4 plans 04-01 through 04-04). The `src/lib/opportunities/` directory and new DB schema files did not exist in the worktree.
- **Fix:** Copied `config.ts`, `queries.ts`, `detector.ts`, `digest.ts`, `index.ts` from `src/lib/opportunities/` and `detectionCandidates.ts`, `opportunities.ts`, updated `index.ts` from `src/db/schema/` from the main repo tree.
- **Files modified:** 10 files added (dependency copies from main repo)
- **Commits:** ea7bf9d (included with RED test commit)

## Known Stubs

None — all new command handlers are fully wired to their data sources (`getRecentOpportunities` and `loadDetectionConfig`). No placeholder text or hardcoded empty values.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan's threat model already covers (T-04-05-01 through T-04-05-11). Both commands use plain text `ctx.reply()` (no `parse_mode`), catch and suppress error details, and inherit whitelist middleware from `src/bot/index.ts`.

## Self-Check

### Files Exist

- `src/bot/commands/history.ts`: FOUND
- `src/bot/commands/config.ts`: FOUND
- `src/bot/__tests__/commands/history.test.ts`: FOUND
- `src/bot/__tests__/commands/config.test.ts`: FOUND

### Commits Exist

- ea7bf9d (test RED history): FOUND
- 8f9dafd (feat GREEN history): FOUND
- 67da829 (test RED config): FOUND
- 8f55179 (feat GREEN config): FOUND
- c333a53 (feat bot index): FOUND

## Self-Check: PASSED
