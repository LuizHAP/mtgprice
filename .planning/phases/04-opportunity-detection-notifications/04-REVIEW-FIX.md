---
phase: 04-opportunity-detection-notifications
fixed_at: 2026-05-08T00:00:00Z
review_path: .planning/phases/04-opportunity-detection-notifications/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-08T00:00:00Z
**Source review:** .planning/phases/04-opportunity-detection-notifications/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warnings)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Whitelist middleware registered AFTER command handlers

**Files modified:** `src/bot/index.ts`
**Commit:** 2f4c7b8
**Applied fix:** Removed all static command imports and replaced them with `await import(...)` dynamic imports placed after `bot.use(whitelistMiddleware)`. This guarantees the whitelist is in the middleware chain before any command handlers are registered, since ES module static imports are hoisted and would otherwise execute before `bot.use()` regardless of source order. Also replaced all `console.*` calls in this file with `logger.*` equivalents (consistent with WR note in the review).

---

### WR-01: TELEGRAM_CHAT_ID parsed with Number() — NaN silently passed to sendMessage

**Files modified:** `src/lib/opportunities/digest.ts`
**Commit:** aeaaa46
**Applied fix:** Added a `Number.isFinite(chatId)` guard immediately after `Number(chatIdRaw)`. If the value is NaN or Infinity, the function logs a structured error via `logger.error` and returns `{ persisted, sent: false, error: 'chat_id_invalid' }` before attempting to call `bot.api.sendMessage`.

---

### WR-02: deleteCandidate declares Promise<void> but attaches an unused .returning() clause

**Files modified:** `src/lib/opportunities/queries.ts`
**Commit:** 8a3d2d3
**Applied fix:** Removed the `.returning({ id: detectionCandidates.id })` clause from `deleteCandidate`. The function now issues a plain `DELETE` with no extra SELECT round-trip, matching its declared `Promise<void>` return type.

---

### WR-03: opportunities table has no unique constraint — duplicate rows possible within a cooldown window

**Files modified:** `src/db/schema/opportunities.ts`, `src/lib/opportunities/queries.ts`, `src/lib/opportunities/digest.ts`
**Commit:** 0e0eb43
**Applied fix:**
1. `src/db/schema/opportunities.ts`: Added `sql` to drizzle-orm imports and a partial unique index `opportunities_card_source_unsent_unique_idx` on `(card_id, source)` filtered by `sent_to_user = false`. This prevents two concurrent runs from inserting duplicate unsent alerts for the same (card, source) pair while still allowing historical (sent) records.
2. `src/lib/opportunities/queries.ts`: Added `.onConflictDoNothing()` to `insertOpportunity` and updated its return type to `Promise<{ id: number; sentToUser: boolean } | null>` — returns `null` when a conflict is silently skipped.
3. `src/lib/opportunities/digest.ts`: Updated the `insertOpportunity` call site to handle the `null` return — skipped conflicts are logged as a warning rather than being silently ignored or thrown as an error.

---

_Fixed: 2026-05-08T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
