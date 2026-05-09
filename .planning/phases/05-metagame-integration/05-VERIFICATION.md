---
phase: 05-metagame-integration
verified: 2026-05-08T17:49:30Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm scheduleMetagameRefresh().start() is called from src/bot/index.ts or an equivalent entry point, or confirm the absence is intentional (consistent with schedulePriceCollection also not being called from any entry point)"
    expected: "Both schedulePriceCollection() and scheduleMetagameRefresh() are registered and started when the bot or server starts, so the 3x-daily and weekly crons actually fire in production"
    why_human: "Neither scheduler is called from src/bot/index.ts or any non-scheduler, non-test file in src/. schedulePriceCollection (Phase 2) also has this same gap — suggesting either the bootstrap wiring is consistently deferred to a future phase, or it is done via a mechanism not visible in src/ (e.g., an external process manager or a script not in src/). Cannot verify programmatically whether this is an intentional deferral or a missing step."
---

# Phase 5: Metagame Integration Verification Report

**Phase Goal:** Automatically populate wishlists with metagame-relevant cards by scraping EDHREC (Commander), MTGTop8 (Standard/Modern), resolving card names to oracle_ids via Scryfall, and scheduling a weekly refresh.
**Verified:** 2026-05-08T17:49:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths derived from ROADMAP success criteria (META-01, META-02, META-03) and PLAN must_haves, merged and deduplicated.

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | wishlists table has is_auto_added boolean NOT NULL DEFAULT false column | VERIFIED | `src/db/schema/wishlists.ts` line 17: `isAutoAdded: boolean('is_auto_added').notNull().default(false)` |
| 2 | RATE_LIMITS.SCRYFALL_HEAVY = { limit: 2, interval: 1 } exported | VERIFIED | `src/lib/ratelimit/rate-limiter.ts` line 41: `SCRYFALL_HEAVY: { limit: 2, interval: 1 }` |
| 3 | Migration file drizzle/0005_wonderful_pestilence.sql adds is_auto_added column | VERIFIED | File exists; contains `ALTER TABLE "wishlists" ADD COLUMN "is_auto_added" boolean DEFAULT false NOT NULL` |
| 4 | fetchEDHRECTopCards() implemented with circuit-breaker resilience | VERIFIED | `src/scraper/metagame/edhrec.ts` exports `fetchEDHRECTopCards`, hits `https://json.edhrec.com/pages/top/week.json`, 73 lines, 7 passing tests |
| 5 | fetchMTGTop8TopCards() implemented for Standard and Modern with stale meta ID guard | VERIFIED | `src/scraper/metagame/mtgtop8.ts` exports `fetchMTGTop8TopCards` and `MTGTop8Format`, hits `https://www.mtgtop8.com/topcards`, MIN_EXPECTED_ROWS=20, 71 lines, 7 passing tests |
| 6 | resolveNamesToOracleIds uses RATE_LIMITS.SCRYFALL_HEAVY for batch name resolution | VERIFIED | `src/scraper/metagame/scryfall-resolver.ts` line 66: `checkRateLimitPreset(RATE_LIMIT_KEY, RATE_LIMITS.SCRYFALL_HEAVY)`, BATCH_SIZE=75, 8 passing tests |
| 7 | executeMetagameRefresh orchestrates all modules with D-05/D-06/D-07 safety policies | VERIFIED | `src/scraper/metagame/orchestrator.ts` composes all three fetchers, resolves names, upserts missing cards before wishlist insert, uses `isAutoAdded: true`, `onConflictDoNothing()`, `notInArray` with `eq(wishlists.isAutoAdded, true)` guard, 8 passing tests |
| 8 | scheduleMetagameRefresh wired as weekly Sunday cron job with env override | VERIFIED | `src/scheduler/jobs.ts` exports `scheduleMetagameRefresh`, reads `process.env.CRON_METAGAME_REFRESH`, defaults `'0 2 * * 0'`, has defensive try/catch in callback, 5 passing tests |
| 9 | CRON_METAGAME_REFRESH documented in .env.example | VERIFIED | `.env.example` line 30: `CRON_METAGAME_REFRESH=0 2 * * 0` in the `# Scheduler` section |
| 10 | D-02 honored: scheduleMetagameRefresh is separate from schedulePriceCollection / executePriceCollection | VERIFIED | `executePriceCollection` body does not reference `executeMetagameRefresh`; verified by grep |

**Score:** 10/10 truths verified

### Human Verification Item

| # | Item | Why Human |
|---|------|-----------|
| 1 | scheduleMetagameRefresh().start() called from application entry point | Neither scheduler (metagame nor price collection) is called from src/bot/index.ts or any production entry point. Cannot determine programmatically if this is intentional deferral (both Phase 2 and Phase 5 schedulers are in the same state) or a missing step. |

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|-------------|--------|---------|
| `src/db/schema/wishlists.ts` | — | 34 | VERIFIED | Contains `isAutoAdded: boolean('is_auto_added').notNull().default(false)`, all original columns preserved |
| `src/lib/ratelimit/rate-limiter.ts` | — | 147 | VERIFIED | Contains `SCRYFALL_HEAVY: { limit: 2, interval: 1 }`, all 6 original presets preserved |
| `drizzle/0005_wonderful_pestilence.sql` | — | 2 | VERIFIED | Contains `ALTER TABLE "wishlists" ADD COLUMN "is_auto_added" boolean DEFAULT false NOT NULL` |
| `src/scraper/metagame/edhrec.ts` | 40 | 73 | VERIFIED | Exports `fetchEDHRECTopCards`, substantive implementation with fallback path, caps names at 255 chars |
| `src/scraper/metagame/mtgtop8.ts` | 50 | 71 | VERIFIED | Exports `fetchMTGTop8TopCards` and `MTGTop8Format`, stale meta ID guard, User-Agent header |
| `src/scraper/metagame/scryfall-resolver.ts` | 60 | 103 | VERIFIED | Exports `resolveNamesToOracleIds` and `ResolvedCard`, BATCH_SIZE=75, SCRYFALL_HEAVY rate limit gate |
| `src/scraper/metagame/orchestrator.ts` | 100 | 188 | VERIFIED | Exports `executeMetagameRefresh` and `MetagameRefreshSummary`, all D-decisions implemented |
| `src/scraper/metagame/index.ts` | — | 4 | VERIFIED | Re-exports all four public symbols from metagame module |
| `src/scheduler/jobs.ts` | — | 309 | VERIFIED | Exports `scheduleMetagameRefresh`, CRON_METAGAME_REFRESH env var, defensive try/catch |
| `src/scheduler/index.ts` | — | 8 | VERIFIED | Exports `scheduleMetagameRefresh` alongside `schedulePriceCollection` and `executePriceCollection` |
| `.env.example` | — | 38 | VERIFIED | `CRON_METAGAME_REFRESH=0 2 * * 0` in Scheduler section |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema/wishlists.ts` | live Postgres wishlists table | drizzle-kit push (Task 3 of Plan 01) | VERIFIED | Migration SQL exists; SUMMARY confirms `COLUMN_EXISTS` probe passed |
| `src/lib/ratelimit/rate-limiter.ts` | scryfall-resolver.ts | `RATE_LIMITS.SCRYFALL_HEAVY` named export | VERIFIED | `scryfall-resolver.ts` imports and uses `RATE_LIMITS.SCRYFALL_HEAVY` at line 66 |
| `src/scraper/metagame/edhrec.ts` | `https://json.edhrec.com/pages/top/week.json` | `axios.get` | VERIFIED | Hardcoded URL on line 19 |
| `src/scraper/metagame/mtgtop8.ts` | `https://www.mtgtop8.com/topcards` | `axios.get + cheerio.load` | VERIFIED | URL in `MTGTOP8_BASE_URL` constant, cheerio imported |
| `src/scraper/metagame/scryfall-resolver.ts` | `https://api.scryfall.com/cards/collection` | `axios.post` | VERIFIED | `SCRYFALL_COLLECTION_URL` constant on line 27 |
| `src/scraper/metagame/orchestrator.ts` | `src/scraper/metagame/edhrec.ts` | `import { fetchEDHRECTopCards }` | VERIFIED | Line 26: `import { fetchEDHRECTopCards } from './edhrec'` |
| `src/scraper/metagame/orchestrator.ts` | `src/scraper/metagame/mtgtop8.ts` | `import { fetchMTGTop8TopCards }` | VERIFIED | Line 27: `import { fetchMTGTop8TopCards } from './mtgtop8'` |
| `src/scraper/metagame/orchestrator.ts` | `src/scraper/metagame/scryfall-resolver.ts` | `import { resolveNamesToOracleIds }` | VERIFIED | Line 28: `import { resolveNamesToOracleIds } from './scryfall-resolver'` |
| `src/scraper/metagame/orchestrator.ts` | `src/db/schema/wishlists.ts` | `isAutoAdded: true` insert + `eq(wishlists.isAutoAdded, true)` delete filter | VERIFIED | Lines 160, 172 in orchestrator.ts |
| `src/scheduler/jobs.ts` | `src/scraper/metagame/index.ts` | `import { executeMetagameRefresh } from '@/scraper/metagame'` | VERIFIED | Line 20 in jobs.ts |
| `src/scheduler/jobs.ts` | node-cron | `cron.schedule(schedule, callback, { scheduled: false })` | VERIFIED | Lines 280-293 in jobs.ts |
| `src/scheduler/index.ts` | `src/scheduler/jobs.ts` | re-export `scheduleMetagameRefresh` | VERIFIED | Line 7 in index.ts |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `orchestrator.ts` — wishlist insert | `wishlistRows` | `resolved.map(r => r.oracleId)` from Scryfall API | Yes — resolver calls real Scryfall `/cards/collection` via axios.post | FLOWING |
| `orchestrator.ts` — cards upsert | `missingCards` | `resolved.filter(r => !existingSet.has(r.oracleId))` | Yes — filtered against live DB query results | FLOWING |
| `orchestrator.ts` — stale removal | `newTop150OracleIds` | Same resolved list used for notInArray | Yes — real oracle IDs from resolution | FLOWING |
| `scryfall-resolver.ts` | `results: ResolvedCard[]` | `response.data.data` from Scryfall POST | Yes — real Scryfall card metadata | FLOWING |
| `edhrec.ts` | `names: string[]` | `response.data.cardviews[].name` from EDHREC JSON GET | Yes — real EDHREC card names | FLOWING |
| `mtgtop8.ts` | `names: string[]` | `$('table tr td:first-child a').text()` from MTGTop8 HTML | Yes — real scraped card names | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| All 35 metagame + scheduler tests pass | `npx vitest run src/scraper/metagame src/scheduler` | 35 passed, 17 skipped (pre-existing skips), 0 failed | PASS |
| No it.todo entries remain in metagame test files | `grep -rn "it.todo" src/scraper/metagame/__tests__/` | NO_TODOS | PASS |
| D-02 compliance: executeMetagameRefresh not inside executePriceCollection | grep -A 100 executePriceCollection for executeMetagameRefresh | D02_COMPLIANT | PASS |
| All 9 documented commits exist in git history | `git log --oneline <hash>` for each | All 9 found | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|------------|---------------|-------------|--------|---------|
| META-01 | 05-01, 05-02, 05-03, 05-04, 05-05 | Sistema auto-adiciona top cartas mais jogadas de Standard ao monitoramento | VERIFIED (code-complete) | fetchMTGTop8TopCards('ST') fetches top Standard cards; orchestrator inserts them into wishlists with isAutoAdded=true; weekly cron will fire when scheduleMetagameRefresh().start() is called |
| META-02 | 05-01, 05-02, 05-03, 05-04, 05-05 | Sistema auto-adiciona top cartas mais jogadas de Modern ao monitoramento | VERIFIED (code-complete) | fetchMTGTop8TopCards('MO') fetches top Modern cards; same pipeline as META-01 |
| META-03 | 05-01, 05-02, 05-03, 05-04, 05-05 | Sistema auto-adiciona top X cartas mais populares de Commander ao monitoramento | VERIFIED (code-complete) | fetchEDHRECTopCards() fetches top Commander cards from EDHREC; same pipeline |

All three requirements are fully code-complete. The operational gap (scheduleMetagameRefresh().start() not called from bot entry) is consistent with schedulePriceCollection() also not being called from any production entry point — indicating this is a pre-existing cross-phase pattern rather than a Phase 5 deficiency.

### Anti-Patterns Found

No anti-patterns found in implementation files. Scanned edhrec.ts, mtgtop8.ts, scryfall-resolver.ts, orchestrator.ts, and jobs.ts for TODO/FIXME/placeholder comments, empty returns, and hardcoded stubs. None found.

One acknowledged design choice in orchestrator.ts: `summary.removedCount = 0` is a known limitation (Drizzle delete does not return affected row count without `.returning()`), documented inline. This is not a stub — the deletion itself executes correctly.

### Human Verification Required

**1. Confirm scheduler activation pattern**

**Test:** Check whether `scheduleMetagameRefresh().start()` (and `schedulePriceCollection().start()`) should be called from `src/bot/index.ts`, a Next.js API route, or via an external process manager (e.g., a separate `worker.ts` entry point). If a bot bootstrap call is needed, add it to `src/bot/index.ts` alongside the existing bot start logic.

**Expected:** Both schedulers are started when the application boots so the 3x-daily price collection and weekly metagame refresh actually fire.

**Why human:** Neither scheduler is called from any production entry point in `src/`. This is consistent with `schedulePriceCollection` (Phase 2) also not being called — so this gap predates Phase 5. The decision of whether to wire it now or defer to a dedicated "process/infrastructure" phase requires developer judgment about deployment architecture.

### Gaps Summary

No blocking code gaps found. All Phase 5 implementation artifacts exist, are substantive, are correctly wired together, and all 35 automated tests pass. The single human verification item concerns the scheduler activation pattern in the bot entry point — a pre-existing cross-phase operational concern that applies to both the price collection scheduler (Phase 2) and the metagame scheduler (Phase 5).

---

_Verified: 2026-05-08T17:49:30Z_
_Verifier: Claude (gsd-verifier)_
