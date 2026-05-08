---
phase: 04-opportunity-detection-notifications
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/db/schema/opportunities.ts
  - src/db/schema/detectionCandidates.ts
  - src/lib/opportunities/config.ts
  - src/lib/opportunities/detector.ts
  - src/lib/opportunities/queries.ts
  - src/lib/opportunities/digest.ts
  - src/lib/opportunities/index.ts
  - src/scheduler/jobs.ts
  - src/bot/commands/history.ts
  - src/bot/commands/config.ts
  - src/bot/index.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase wires opportunity detection, the D-07 candidate state machine, digest building, and Telegram delivery into the existing price collection scheduler. The core detection logic (`detector.ts`) is well-structured as a pure function with clear precondition guards. The query layer is generally sound with proper Drizzle parameterization.

Three areas need attention before production:

1. **Critical — middleware bypass**: Command handlers are registered on the `bot` instance before `bot.use(whitelistMiddleware)` runs, which in grammY means the whitelist is never applied to those commands.
2. **Warnings**: The `TELEGRAM_CHAT_ID` env var is converted to a number without a NaN guard; the `deleteCandidate` function declares `Promise<void>` but silently discards a `.returning()` result; and the `opportunities` table lacks a unique constraint that prevents duplicate alerts for the same (card, source) within a cooldown window.
3. **Info**: Inconsistent use of `console.*` vs the project `logger`, magic number `userId = 1` hardcoded in the scheduler, duplicate `formatSaoPauloTimestamp` and `SOURCE_DISPLAY_NAMES` across `digest.ts` and `history.ts`, and an unused `sevenDayAgoPrice` field filled with `0` in the retry path.

---

## Critical Issues

### CR-01: Whitelist middleware is registered AFTER command handlers — all /history and /config commands are unprotected

**File:** `src/bot/index.ts:3-16`

**Issue:** In grammY, middleware and command handlers are matched in the order they are added to the `bot` instance. The command handler side-effect imports (`import './commands/history'`, `import './commands/config'`, etc.) execute at module-evaluation time — before line 16 where `bot.use(whitelistMiddleware)` is called. This means all `bot.command(...)` registrations run first and are positioned ahead of the whitelist in the middleware chain. Any message that matches a command will be handled by the command handler without ever passing through the whitelist check, regardless of the sender's chat ID.

**Fix:** Register the whitelist middleware before importing the command modules:

```typescript
// src/bot/index.ts
import { bot } from '../lib/telegram'
import { whitelistMiddleware } from './middleware/whitelist'

// Apply whitelist FIRST — must precede all command registrations
bot.use(whitelistMiddleware)

// Command imports run AFTER middleware is in the chain
import './commands/start'
import './commands/add'
import './commands/remove'
import './commands/list'
import './commands/price'
import './commands/history'
import './commands/config'
```

> Note: ES module static imports are hoisted by the JavaScript engine, so moving the `bot.use` call above the import statements in the source file is not sufficient — the imports still execute first. The correct fix is to switch the command registrations to **dynamic imports** so that they run after `bot.use()` is registered:

```typescript
import { bot } from '../lib/telegram'
import { whitelistMiddleware } from './middleware/whitelist'

bot.use(whitelistMiddleware)

await import('./commands/start')
await import('./commands/add')
await import('./commands/remove')
await import('./commands/list')
await import('./commands/price')
await import('./commands/history')
await import('./commands/config')
```

Alternatively, refactor each command file to export a registration function (e.g., `registerHistoryCommand(bot)`) and call those functions after `bot.use(whitelistMiddleware)`.

---

## Warnings

### WR-01: TELEGRAM_CHAT_ID parsed with Number() — NaN silently passed to sendMessage

**File:** `src/lib/opportunities/digest.ts:158-164`

**Issue:** `Number(chatIdRaw)` returns `NaN` when `chatIdRaw` is not a valid integer string (e.g. `"abc"`, `" "`, `"12.5"`). `NaN` passes the preceding `!chatIdRaw` check because the check only tests for empty/undefined, not for an invalid number. The `bot.api.sendMessage(NaN, ...)` call will either throw a runtime error or silently fail depending on the grammY/Telegram API version, and the error message will not clearly indicate the misconfiguration.

**Fix:** Add a NaN guard immediately after the conversion:

```typescript
const chatId = Number(chatIdRaw)
if (!Number.isFinite(chatId)) {
  logger.error(`TELEGRAM_CHAT_ID="${chatIdRaw}" is not a valid integer; cannot send digest`)
  return { persisted, sent: false, error: 'chat_id_invalid' }
}
```

---

### WR-02: deleteCandidate declares Promise<void> but attaches an unused .returning() clause

**File:** `src/lib/opportunities/queries.ts:220-225`

**Issue:** `deleteCandidate` is typed as `Promise<void>` and its caller discards the return value, yet the Drizzle query has a `.returning({ id: detectionCandidates.id })` clause. This causes a spurious DB round-trip to SELECT the deleted row's id on every call. More importantly, the type signature is misleading — the function appears to return nothing but the implementation secretly fetches data. If future callers need to confirm whether a row was actually deleted (vs a no-op delete), they have no way to know without changing the internal implementation.

**Fix:** Either drop the `.returning()` clause (if the id is never needed):

```typescript
export async function deleteCandidate(cardId: string, source: string): Promise<void> {
  await db
    .delete(detectionCandidates)
    .where(and(eq(detectionCandidates.cardId, cardId), eq(detectionCandidates.source, source)))
  // No .returning() needed
}
```

Or change the return type to expose the deleted row count:

```typescript
export async function deleteCandidate(cardId: string, source: string): Promise<number> {
  const result = await db
    .delete(detectionCandidates)
    .where(and(eq(detectionCandidates.cardId, cardId), eq(detectionCandidates.source, source)))
    .returning({ id: detectionCandidates.id })
  return result.length
}
```

---

### WR-03: opportunities table has no unique constraint — duplicate rows possible within a cooldown window

**File:** `src/db/schema/opportunities.ts:7-28`

**Issue:** The `opportunities` table has only a non-unique composite index on `(card_id, source, detected_at)`. The cooldown check in `isInCooldown` prevents duplicate alerts during normal operation, but it is not enforced at the database level. If two concurrent price collection runs fire simultaneously (race condition — possible if the `isRunning` flag is ever reset prematurely or if the process restarts mid-run), both could pass the cooldown check and insert duplicate opportunity rows for the same `(card_id, source)` within the same cooldown window.

**Fix:** Add a partial unique index to enforce at most one unsent opportunity per `(card_id, source)`, or alternatively a unique constraint on `(card_id, source)` restricted to rows within the cooldown window. The simplest mitigation at the schema level:

```typescript
// In the table definition's index block:
uniqueCardSourceRecent: uniqueIndex('opportunities_card_source_unique_idx').on(
  table.cardId,
  table.source,
)
// Combined with an ON CONFLICT DO NOTHING in insertOpportunity
```

Note: a full unique constraint on `(card_id, source)` alone would prevent storing historical records. An application-level approach is to use `.onConflictDoNothing()` in `insertOpportunity` after adding such a constraint, similar to the pattern used in `insertCandidate`.

---

## Info

### IN-01: console.* used instead of project logger in bot command handlers and index

**File:** `src/bot/commands/history.ts:57`, `src/bot/commands/config.ts:31`, `src/bot/index.ts:11-13,29-30,36,40`

**Issue:** Multiple files use `console.error` and `console.log` instead of the project's `logger` (Winston). The rest of the codebase (scheduler, queries, digest) uses `logger.*` consistently. This means bot-startup events and command errors are not captured in the structured log stream.

**Fix:** Replace `console.*` calls with `logger.*` equivalents:

```typescript
// Instead of: console.error('Error in /history command:', error)
logger.error(`Error in /history command: ${error instanceof Error ? error.message : String(error)}`)

// Instead of: console.log('🤖 Starting Telegram bot...')
logger.info('Starting Telegram bot')
```

---

### IN-02: userId = 1 is a magic number hardcoded in the scheduler

**File:** `src/scheduler/jobs.ts:131`

**Issue:** The single-user mode assumption (`userId = 1`) is embedded directly in the scheduler with only a comment referencing "Phase 1 D-09". If this ever needs to change, or if the comment gets stale, it is easy to miss.

**Fix:** Introduce a named constant or environment variable:

```typescript
// At module level
const SINGLE_USER_ID = 1 // Phase 1 D-09: single-user mode

// In executePriceCollection:
const opportunities = await detectOpportunitiesForWishlist(SINGLE_USER_ID, detectionConfig)
```

---

### IN-03: formatSaoPauloTimestamp and SOURCE_DISPLAY_NAMES duplicated across digest.ts and history.ts

**File:** `src/lib/opportunities/digest.ts:44-55,26-31` and `src/bot/commands/history.ts:26-37,18-23`

**Issue:** Both `formatSaoPauloTimestamp` and `SOURCE_DISPLAY_NAMES` are defined identically in two files. The comment in `history.ts` explains the intentional decoupling rationale (avoiding a transitive mock dependency on `@/lib/telegram` in tests). This is a documented design decision, but the duplication does create a maintenance risk — a future change to the timestamp format or a new source name must be applied in both files.

**Fix (optional):** Extract the two pure utilities into a separate module that has no dependency on `@/lib/telegram` (e.g. `src/lib/opportunities/format.ts`). Both `digest.ts` and `history.ts` can then import from there without introducing the coupling that motivated the duplication.

---

### IN-04: sevenDayAgoPrice field set to 0 placeholder in retry path — misleading type

**File:** `src/lib/opportunities/queries.ts:316`

**Issue:** `getUnsentOpportunitiesLast24h` returns `DetectedOpportunity` objects with `sevenDayAgoPrice: 0`. The `DetectedOpportunity` interface declares `sevenDayAgoPrice: number` as a required field with no indication that it may be a meaningless placeholder. If any future consumer of the retry-path results relies on `sevenDayAgoPrice` (e.g. a richer digest format), it will silently receive `0` and produce incorrect output. Currently `buildDigest` does not use `sevenDayAgoPrice`, so there is no active bug, but the type contract is misleading.

**Fix:** Make `sevenDayAgoPrice` optional in the interface or use `null` with `number | null` to signal "not available":

```typescript
export interface DetectedOpportunity {
  // ...
  /** Price approximately lookbackDays ago. null when not available (e.g. retry path). */
  sevenDayAgoPrice: number | null
}
```

Then update callers to handle the null case explicitly.

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
