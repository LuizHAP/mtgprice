---
phase: 08
plan: 01
subsystem: scraper/testing
tags: [testing, circuit-breaker, opossum, vitest, tdd]
dependency_graph:
  requires:
    - src/scraper/circuit-breaker.ts (production source — verified unchanged)
  provides:
    - TEST-04: 5 active state transition tests (closed→open→half-open→closed)
    - TEST-05: 3 active fallback tests (execute/null-cache/fallback-error)
    - TEST-06: 4 active event emission tests (open/close/halfOpen/fallback)
    - TEST-07: 3 active per-source isolation tests + 3 integration scenario tests
  affects:
    - Full test suite count (+18 active, -18 skipped)
tech_stack:
  added: []
  patterns:
    - FAST_CONFIG constant (resetTimeout 200ms, errorThresholdPercentage 1) for deterministic state transitions
    - Direct CircuitBreaker import from opossum for state/event/stats access
    - b.shutdown() in try/finally for timer leak prevention
    - Real setTimeout wait (250ms) instead of vi.useFakeTimers() — matches Phase 7 anti-pattern
key_files:
  created: []
  modified:
    - src/scraper/__tests__/circuit-breaker.test.ts
decisions:
  - "Import order: external packages (opossum, vitest) before relative imports — Biome organizeImports rule overrides plan description"
  - "Cached data test: verify null return (no cache exists in production) — satisfies TODO intent per A1 assumption"
  - "Per-source timeouts: test capability via explicit wrapWithCircuitBreaker configs — no orchestrator source change needed per A2 assumption"
metrics:
  duration: ~5 minutes
  completed: "2026-05-10"
  tasks_completed: 4
  tasks_total: 4
  files_created: 0
  files_modified: 1
  commits: 2
---

# Phase 08 Plan 01: Circuit Breaker Test Activation Summary

**One-liner:** Activated all 18 opossum circuit-breaker test stubs using direct CircuitBreaker instantiation, FAST_CONFIG (200ms reset), and b.shutdown() try/finally pattern — zero source file changes.

## What Was Built

Replaced all 18 `test.skip` placeholder stubs in `src/scraper/__tests__/circuit-breaker.test.ts` with real assertions against the production `wrapWithCircuitBreaker` and direct opossum `CircuitBreaker` API. No production source files were modified.

### Test Groups Activated

**Task 1 — TEST-04: Circuit state transitions (5 tests)**
- `should start in closed state` — verifies initial `b.closed === true`, `b.opened === false`
- `should open circuit when 50% of requests fail` — fires one rejection with `errorThresholdPercentage: 1`
- `should remain open for resetTimeout duration` — asserts `b.opened` at T+50ms (before 200ms reset)
- `should transition to half-open after resetTimeout` — waits 250ms real time, asserts `b.halfOpen`
- `should close circuit when service recovers` — full lifecycle: fail → wait → succeed in half-open → closed

**Task 2 — TEST-05: Fallback function (3 tests)**
- `should execute fallback when circuit is open` — sentinel value returned via custom fallback
- `should return cached data from fallback` — null return verified (no cache in current impl)
- `should handle fallback errors gracefully` — fallback that throws; fire() rejects with fallback error

**Task 3 — TEST-06: Event emission (4 tests)**
- `should emit "open" event when circuit opens` — vi.fn() listener verified called once
- `should emit "close" event when circuit closes` — listener verified after recovery
- `should emit "halfOpen" event when testing recovery` — listener receives numeric resetTimeout value
- `should emit "fallback" event when fallback used` — listener receives fallback return value (not error)

**Task 4 — TEST-07 + Integration (6 tests)**
- `should create separate breaker for each source` — Liga Magic tripped, TCGPlayer unaffected
- `should configure appropriate timeouts per source` — four wrapWithCircuitBreaker calls with distinct configs
- `should track breaker stats per source` — `b1.stats.failures > 0`, `b2.stats.failures === 0`
- `should prevent cascading failures from bad sources` — Liga null, TCGPlayer 10.0, CardMarket 11.0
- `should recover automatically when source heals` — automatic half-open → closed without intervention
- `should handle rapid successive requests correctly` — 20 concurrent fires fast-fail to null; action not reinvoked

## Test Count Delta

| Before Phase 8 | After Phase 8 |
|---------------|---------------|
| 143 passed    | 161 passed    |
| 200 skipped   | 182 skipped   |
| 38 todo       | 38 todo       |
| Net: +18 active, -18 skipped |

## Patterns Established

| Pattern | Description |
|---------|-------------|
| `FAST_CONFIG` | `{ timeout: 100, errorThresholdPercentage: 1, resetTimeout: 200, rollingCountTimeout: 1000, rollingCountBuckets: 1 }` — shared across all 18 tests |
| Direct `CircuitBreaker` import | `import CircuitBreaker from 'opossum'` enables `.closed`, `.opened`, `.halfOpen`, `.stats`, custom `.fallback()` |
| `b.shutdown()` in try/finally | Clears opossum's internal `setTimeout`/`setInterval` — prevents Vitest open-handle leaks |
| Real timer wait | `await new Promise((r) => setTimeout(r, 250))` for half-open transition — avoids `vi.useFakeTimers()` issues |
| Biome import order | External packages (`opossum`, `vitest`) before relative imports (`../circuit-breaker`) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import order correction**
- **Found during:** Task 1 implementation, Biome check post-commit
- **Issue:** Plan specified internal `../circuit-breaker` before external `opossum` (incorrect — Biome organizeImports puts externals first)
- **Fix:** Reordered to: `opossum`, `vitest`, then `../circuit-breaker`
- **Files modified:** `src/scraper/__tests__/circuit-breaker.test.ts`
- **Commit:** 8218a69

## Phase Gate Verification

| Check | Result |
|-------|--------|
| `grep -c "test.skip"` returns 0 | PASS — 0 skipped stubs |
| `grep "expect(true).toBe(false)"` returns no matches | PASS — all placeholders replaced |
| `git diff --stat src/scraper/circuit-breaker.ts` no changes | PASS — production source untouched |
| Health Alert tests 4/4 pass (Phase 6 regression) | PASS |
| Biome check exits 0 | PASS |
| `npx vitest run src/scraper/__tests__/circuit-breaker.test.ts` exits 0, 22 passed | PASS |

## Self-Check: PASSED

Files modified:
- FOUND: src/scraper/__tests__/circuit-breaker.test.ts

Commits:
- a1c0fcb: test(08-01): activate all 18 circuit-breaker test stubs
- 8218a69: fix(08-01): correct Biome import order
