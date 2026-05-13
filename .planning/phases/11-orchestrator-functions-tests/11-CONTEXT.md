# Phase 11: Orchestrator Functions & Tests - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement 5 new named exports in `src/scraper/orchestrator.ts` — `orchestrateFetch`, `handleSourceFailure`, `applyRateLimiting`, `aggregateResults`, `batchOrchestrateFetch` — and activate all 24 skipped test stubs in `src/scraper/__tests__/orchestrator.test.ts`.

Two of the new exports are aliases for existing functions (`orchestrateFetch` = `fetchCardPriceFromAllSources`, `batchOrchestrateFetch` = `fetchAllPrices`). The remaining three (`handleSourceFailure`, `applyRateLimiting`, `aggregateResults`) are new implementations.

All 24 stubs are activated: 10 in the TEST-12 groups (`orchestrateFetch` ×4, `handleSourceFailure` ×3, `applyRateLimiting` ×3), 7 in the TEST-13 groups (`aggregateResults` ×4, `batchOrchestrateFetch` ×3), and 3 `Integration scenarios` stubs.

**Phase split (2 plans):**
- Plan 11-01: TEST-12 — implement `orchestrateFetch` alias, `handleSourceFailure`, `applyRateLimiting` + activate their 10 stubs
- Plan 11-02: TEST-13 + Integration — implement `aggregateResults`, `batchOrchestrateFetch` alias + activate their 14 stubs (7 function stubs + 3 Integration scenarios)

**Explicitly out of scope:**
- Changes to `fetchCardPriceFromAllSources` or `fetchAllPrices` contracts (must remain unchanged)
- New scraping providers or price sources
- Any changes outside `src/scraper/orchestrator.ts` and its test file

</domain>

<decisions>
## Implementation Decisions

### Scope

- **D-01:** Activate all 24 stubs — the 21 function stubs (TEST-12 + TEST-13) AND the 3 `Integration scenarios` stubs at the bottom of the test file.
- **D-02:** Phase split into 2 plans: Plan 11-01 handles TEST-12 (orchestrateFetch, handleSourceFailure, applyRateLimiting), Plan 11-02 handles TEST-13 + Integration scenarios (aggregateResults, batchOrchestrateFetch, integration stubs).

### orchestrateFetch

- **D-03:** `orchestrateFetch` is an alias export for `fetchCardPriceFromAllSources`. Same logic, no duplication. The export line is: `export const orchestrateFetch = fetchCardPriceFromAllSources`. Tests for `orchestrateFetch` verify the alias resolves correctly and behaves identically (Liga Magic first, international parallel).

### handleSourceFailure

- **D-04:** `handleSourceFailure(source: string, oracleId: string, error: unknown): SourceFetchResult` — simple function. Calls `logger.error` with source name, oracleId, and error message. Returns `{ success: false, error: errorMsg }`. Does NOT maintain failure state — Opossum circuit breakers already handle threshold-based tripping. The "track failure count" test stub is satisfied by asserting `logger.error` was called with the right context.

### applyRateLimiting

- **D-05:** `applyRateLimiting(source: string): Promise<void>` — calls `checkRateLimitPreset(source)` from `src/lib/ratelimit/rate-limiter.ts`. Reuses the existing Redis token bucket rate limiter already in the codebase. Tests mock `@/lib/ratelimit/rate-limiter` to verify `checkRateLimitPreset` is called with the correct source name. The rate limit presets (Liga Magic: 50 req/min, TCGPlayer: 40 req/min, etc.) are already defined in the rate limiter module.

### aggregateResults

- **D-06:** `aggregateResults(oracleId: string, results: AllSourcesResult): PriceRecord[]` — pure function, no DB writes. Converts the per-source result map into a flat array of price records for successful sources only. Filters out `success: false` entries. Deduplication is by source (each source appears at most once per call since AllSourcesResult has one entry per source). If all sources failed, returns `[]`. Tests need no mocks — pure input/output.
- **D-07:** `PriceRecord` shape: `{ oracleId: string, source: string, priceBrl: number }`. If this type doesn't already exist, define it in the orchestrator file.

### batchOrchestrateFetch

- **D-08:** `batchOrchestrateFetch` is an alias export for `fetchAllPrices`. Same pattern as D-03. The export line is: `export const batchOrchestrateFetch = fetchAllPrices`. Tests verify the alias resolves and the return shape matches `FetchAllPricesStats`.

### Test Infrastructure

- **D-09:** Follow the same test patterns established in prior phases: `vi.mock(...)` declarations at the top, `vi.clearAllMocks()` in `beforeEach`, dynamic imports inside `it()` blocks only when module-level state must be reset. The existing non-skip tests at the top of the file (`fetchAllPrices concurrency` and `retry-then-circuit-breaker ordering`) are NOT touched.
- **D-10:** For `applyRateLimiting` tests, mock `@/lib/ratelimit/rate-limiter` at the top of the describe block. For `handleSourceFailure` tests, mock `@/lib/logger`. For `aggregateResults` tests, no mocks needed (pure function). For integration scenario tests, mock the same modules as the existing passing tests (`@/scraper/smart-refresh`, `@/scraper/providers/*`, `@/db/queries/prices`, `@/lib/currency`).

### Claude's Discretion

- Exact `PriceRecord` type name (could be `PriceEntry` or inline type) — whichever matches any existing price record type in the codebase
- Whether `applyRateLimiting` awaits `checkRateLimitPreset` or just calls it — depends on the rate limiter's async API
- Exact error message format in `handleSourceFailure` (should be consistent with existing `logger.error` calls in orchestrator.ts)
- Whether integration scenario stubs test via the `orchestrateFetch` alias or the underlying `fetchCardPriceFromAllSources` directly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Requirements
- `.planning/ROADMAP.md` §"Phase 11: Orchestrator Functions & Tests" — success criteria, requirements TEST-12 and TEST-13
- `.planning/REQUIREMENTS.md` §"TEST-12" and §"TEST-13" — exact requirement definitions

### Test File to Activate
- `src/scraper/__tests__/orchestrator.test.ts` — full file; activate all 24 `test.skip` stubs across all describe blocks. The 5 passing tests at the top (`fetchAllPrices concurrency` and `retry-then-circuit-breaker ordering`) are NOT touched.

### Implementation File to Modify
- `src/scraper/orchestrator.ts` — add 5 new named exports: `orchestrateFetch` (alias), `handleSourceFailure` (new), `applyRateLimiting` (new), `aggregateResults` (new), `batchOrchestrateFetch` (alias)

### Existing Code to Reuse
- `src/lib/ratelimit/rate-limiter.ts` — `checkRateLimitPreset(source)` — plugged into `applyRateLimiting`
- `src/lib/logger.ts` — `logger.error(...)` — used in `handleSourceFailure`

### Prior Phase Context & Patterns
- `.planning/phases/10-scheduler-tests/10-CONTEXT.md` — most recent context; same test activation pattern (test.skip → test, dynamic import, mock structure)
- `src/scheduler/__tests__/jobs.test.ts` §`scheduleMetagameRefresh` describe — **already passing** tests for the same testing pattern; reference for mock structure
- `.planning/phases/09-api-db-integration-tests/09-CONTEXT.md` — prior DB test activation pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fetchCardPriceFromAllSources(oracleId)`** — full single-card orchestration (Liga Magic sequential, then TCGPlayer/CardMarket/CardKingdom parallel). `orchestrateFetch` aliases this directly.
- **`fetchAllPrices(oracleIds[])`** — batch orchestration with p-limit, smart refresh, error tracking. `batchOrchestrateFetch` aliases this directly.
- **`SourceFetchResult` / `AllSourcesResult` types** — already defined and exported in `orchestrator.ts`; `handleSourceFailure` returns `SourceFetchResult`, `aggregateResults` takes `AllSourcesResult`.
- **`composeReliable(rawFetch, sourceName)`** — private helper that composes raw fetch → withRetry → wrapWithCircuitBreaker. Shows the composition pattern used by the orchestrator.
- **`checkRateLimitPreset(source)`** from `src/lib/ratelimit/rate-limiter.ts` — existing rate limit enforcement; `applyRateLimiting` delegates to this.

### Established Patterns
- **Alias exports** — `export const newName = existingFunction` for `orchestrateFetch` and `batchOrchestrateFetch`. Keeps backward compatibility while adding the new name.
- **vi.doMock + dynamic import** — the existing `preserves FetchAllPricesStats return shape` test uses `vi.resetModules()` + `vi.doMock()` + `await import('@/scraper/orchestrator')`. New tests that need fresh module state follow the same pattern.
- **Test structure in file** — 3 existing describe blocks at the top are passing and untouched; the 5 new describe blocks below them have the stubs to activate.

### Integration Points
- `applyRateLimiting` hooks into `src/lib/ratelimit/rate-limiter.ts` — the rate limiter already has presets per source name; the function just needs to call it with the right source string
- `handleSourceFailure` should return a `SourceFetchResult` matching the shape callers expect from `fetchCardPriceFromAllSources`

</code_context>

<specifics>
## Specific Ideas

- `orchestrateFetch` and `batchOrchestrateFetch` as alias exports means the test stubs that import them by name still exercise the full real implementation — no stub/dummy needed.
- The `handleSourceFailure` test "should track failure count per source" is satisfied by verifying `logger.error` was called with source + oracleId context — the function doesn't need its own counter since Opossum handles actual circuit breaking.
- `aggregateResults` is a pure function so its tests are the simplest in the phase — no async, no mocks, just object/array assertions.
- The 3 integration scenarios test the wired-together system: they'll need the same mocks as the existing `preserves FetchAllPricesStats return shape` test (smart-refresh, providers, insertPrice, convertToBRL).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-Orchestrator Functions & Tests*
*Context gathered: 2026-05-13*
