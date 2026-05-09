---
phase: 06-polish-optimization
plan: 03
subsystem: scraper/circuit-breaker
tags: [reliability, observability, telegram, health, circuit-breaker]
dependency_graph:
  requires:
    - src/scraper/circuit-breaker.ts (Phase 2 — opossum circuit breaker infrastructure)
    - src/lib/telegram.ts (Phase 1 — grammY bot instance)
  provides:
    - Telegram health-alert delivery on circuit-open transition
    - Active test coverage for D-01..D-04 behaviors
  affects:
    - Any scraper provider that calls wrapWithCircuitBreaker (tcgplayer, cardmarket, cardkingdom, liga magic)
tech_stack:
  added: []
  patterns:
    - Dynamic import (await import('@/lib/telegram')) inside event handler to avoid module-load side effects
    - Falsy env guard (if (!chatId) return) for graceful no-op when chat ID unset
    - try/catch around sendMessage to prevent alert failure propagating to circuit breaker pipeline
key_files:
  modified:
    - src/scraper/circuit-breaker.ts
    - src/scraper/__tests__/circuit-breaker.test.ts
decisions:
  - Used process.env.TELEGRAM_CHAT_ID = '' (empty string) instead of delete in test to satisfy Biome noDelete lint rule; empty string is falsy and correctly triggers the guard
metrics:
  duration: 470s
  completed: 2026-05-09
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 6 Plan 03: Circuit Breaker Telegram Health Alerts Summary

**One-liner:** Telegram health alert sent on circuit-open transition via dynamic `bot.api.sendMessage` import with graceful degradation when chat ID is missing or send fails.

## What Was Built

Extended the existing `breaker.on('open', ...)` listener in `src/scraper/circuit-breaker.ts` to send a Telegram health alert whenever a price source circuit opens. The handler now:

1. Fires the existing Winston `logger.warn(...)` call (unchanged — Phase 2 regression preserved)
2. Reads `process.env.TELEGRAM_CHAT_ID`; returns immediately (no-op) if unset or empty
3. Dynamically imports `bot` from `@/lib/telegram` to defer module evaluation until first alert
4. Calls `bot.api.sendMessage(Number(chatId), '<D-03 message>')` with the exact Portuguese format
5. Catches any `sendMessage` error, logs via Winston, and never re-throws

### Final open-event handler (Task 1)

```typescript
breaker.on('open', async () => {
  // Existing Winston log (Phase 2 — preserved unchanged)
  logger.warn(`Circuit breaker opened for ${sourceName}`, {
    source: sourceName,
    state: 'OPEN',
  })

  // Phase 6 D-01..D-04: Telegram health alert.
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    return
  }

  try {
    const { bot } = await import('@/lib/telegram')
    await bot.api.sendMessage(
      Number(chatId),
      `⚠️ Circuit breaker aberto: ${sourceName} está offline (60s reset). Últimas tentativas falharam.`,
    )
  } catch (alertError) {
    const message = alertError instanceof Error ? alertError.message : String(alertError)
    logger.error(`Failed to send circuit-breaker health alert for ${sourceName}: ${message}`)
  }
})
```

### Why dynamic import (Pitfall 3 / test isolation)

`src/lib/telegram.ts` throws at module load time if `TELEGRAM_BOT_TOKEN` is unset. A static `import { bot } from '@/lib/telegram'` at the top of `circuit-breaker.ts` would cause every test that imports the circuit breaker to fail with a missing-token error. The `await import('@/lib/telegram')` inside the handler defers evaluation until the first actual alert, keeping the circuit-breaker module load side-effect-free and tests isolated.

## Test Results (Task 2)

Four new active tests added to `src/scraper/__tests__/circuit-breaker.test.ts` under `describe('Health alerts (Phase 6 / D-01..D-04)')`:

| # | Test | Result |
|---|------|--------|
| 1 | sends Telegram alert when circuit opens for TCGPlayer | PASS |
| 2 | alert message uses exact D-03 format with sourceName interpolation (CardMarket) | PASS |
| 3 | skips alert silently when TELEGRAM_CHAT_ID is unset | PASS |
| 4 | does not propagate sendMessage errors (failure isolation, CardKingdom) | PASS |

All 18 pre-existing skipped stubs preserved unchanged. Full Vitest suite: **19 passed, 0 failed**.

## Notes for Plan 02 Reviewers

This plan is independent of `withRetry` (Plan 02). Both operate within the same circuit-breaker pipeline:

- Plan 02 wraps the underlying fetch function with retry logic before it reaches the circuit breaker
- This plan (03) hooks into the circuit-breaker's `open` event, which fires after the circuit trips regardless of how many retries were attempted
- No shared state or import dependencies between Plan 02 and Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome lint failures blocked commit**
- **Found during:** Task 2 commit
- **Issue:** Three Biome lint errors in the test file: `noExplicitAny` on `mockResolvedValue({ message_id: 1 } as any)`, and `noDelete` (performance) on two `delete process.env.TELEGRAM_CHAT_ID` calls
- **Fix:**
  - Removed `as any` cast (mock return value typed correctly without it)
  - Replaced `delete process.env.TELEGRAM_CHAT_ID` with `process.env.TELEGRAM_CHAT_ID = ''` — empty string is falsy, correctly triggers `if (!chatId)` guard in the implementation, and avoids the `delete` operator
  - Simplified `afterEach` to `process.env.TELEGRAM_CHAT_ID = originalChatId` (covers both defined and undefined restore cases since undefined restores to no value)
- **Files modified:** `src/scraper/__tests__/circuit-breaker.test.ts`
- **Commit:** e0a1833

## Self-Check: PASSED

- `src/scraper/circuit-breaker.ts` — exists and contains D-03 message, dynamic import, TELEGRAM_CHAT_ID guard
- `src/scraper/__tests__/circuit-breaker.test.ts` — exists with 4 active Health Alert tests
- Task 1 commit `5aa5f0c` — verified in git log
- Task 2 commit `e0a1833` — verified in git log
- Full test suite: 19 passed, 0 failed
