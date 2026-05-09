---
phase: 05-metagame-integration
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/db/schema/wishlists.ts
  - src/lib/ratelimit/rate-limiter.ts
  - src/scraper/metagame/edhrec.ts
  - src/scraper/metagame/mtgtop8.ts
  - src/scraper/metagame/scryfall-resolver.ts
  - src/scraper/metagame/orchestrator.ts
  - src/scraper/metagame/index.ts
  - src/scheduler/jobs.ts
  - src/scheduler/index.ts
  - .env.example
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase introduces the metagame integration pipeline: EDHREC and MTGTop8 fetchers, a Scryfall
batch name resolver, a DB orchestrator, and a weekly cron job. The architecture is solid — external
sources fail gracefully (return `[]`, never throw), the oracle_id type confusion between Scryfall
card IDs and oracle IDs is called out and handled correctly, and the `isAutoAdded` flag correctly
guards user-added rows during the stale-row cleanup.

Five warnings were found: three missing HTTP timeouts (diverging from the project's established
10 s convention), one inaccurate summary counter, and a missing concurrent-execution guard on the
metagame cron callback. Three informational items cover an N+1 insert loop, a key TTL edge case in
the rate limiter, and an inaccurate `removedCount` field on the summary object.

No critical (security or data-loss) issues were found.

---

## Warnings

### WR-01: No HTTP timeout on EDHREC fetch — can hang scheduler indefinitely

**File:** `src/scraper/metagame/edhrec.ts:44`
**Issue:** `axios.get(EDHREC_TOP_WEEK_URL)` has no `timeout` option. Every other HTTP call in the
codebase (`tcgplayer.ts`, `liga-magic.ts`, `cardkingdom.ts`, `cardmarket.ts`) sets
`timeout: 10000`. If EDHREC's CDN stalls, this `await` will block the Node.js event loop for the
default axios timeout (0 = indefinite) and effectively hang the metagame job. Because the job
executes inside a cron callback that is `async`, the scheduler itself will not crash, but the
metagame refresh will never resolve and the resources it holds (Redis connection, etc.) will not
be released until the process is restarted.

**Fix:**
```typescript
const response = await axios.get<EDHRECResponse>(EDHREC_TOP_WEEK_URL, { timeout: 10000 })
```

---

### WR-02: No HTTP timeout on MTGTop8 fetch — same hang risk

**File:** `src/scraper/metagame/mtgtop8.ts:40`
**Issue:** `axios.get(url, { headers: { 'User-Agent': USER_AGENT } })` omits `timeout`. Same
impact as WR-01; a stalled connection to `mtgtop8.com` will block the refresh indefinitely.

**Fix:**
```typescript
const { data: html } = await axios.get<string>(url, {
  headers: { 'User-Agent': USER_AGENT },
  timeout: 10000,
})
```

---

### WR-03: No HTTP timeout on Scryfall collection POST — can block for multiple batches

**File:** `src/scraper/metagame/scryfall-resolver.ts:79`
**Issue:** `axios.post(SCRYFALL_COLLECTION_URL, { identifiers: ... })` has no `timeout`. With up
to two batches of 75 names each, a single hanging POST would block the resolver loop for an
unbounded period. This is the highest-impact of the three timeout omissions because the Scryfall
call occurs after the rate-limit check has consumed a token, so a stuck request also wastes the
rate-limit budget.

**Fix:**
```typescript
const { data } = await axios.post<ScryfallCollectionResponse>(
  SCRYFALL_COLLECTION_URL,
  { identifiers: batch.map((name) => ({ name })) },
  { timeout: 15000 },
)
```

---

### WR-04: `addedCount` over-reports when rows already exist in the wishlist

**File:** `src/scraper/metagame/orchestrator.ts:163`
**Issue:** `summary.addedCount` is set to `wishlistRows.length` (up to 150) before the
`onConflictDoNothing()` insert executes. The actual number of new rows inserted will be equal to
or less than this value because cards already present in the wishlist are silently skipped.
The log message on line 179 does acknowledge this with `"(with conflicts dropped)"`, but the
summary field itself is misleading to any caller that inspects it programmatically (e.g., tests,
future dashboards). The comment on line 176 already acknowledges `removedCount` cannot be sourced
without `.returning()` — the same treatment should be applied to `addedCount`.

**Fix:** Document the field's semantics clearly, or rename it to reflect the attempted count:
```typescript
// addedCount = attempted inserts (actual new rows may be lower due to onConflictDoNothing)
summary.addedCount = wishlistRows.length
```
Or, to get an accurate count, add `.returning({ id: wishlists.id })` and measure the result
array length:
```typescript
const inserted = await db.insert(wishlists).values(wishlistRows).onConflictDoNothing().returning({ id: wishlists.id })
summary.addedCount = inserted.length
```

---

### WR-05: Metagame cron callback has no concurrent-execution guard

**File:** `src/scheduler/jobs.ts:280–293`
**Issue:** `scheduleMetagameRefresh` wraps `executeMetagameRefresh()` in a cron callback without
checking whether a previous run is still in progress. `executePriceCollection` (line 81–88) uses
an `isRunning` module-level flag for exactly this purpose. Although the weekly schedule makes a
true overlap unlikely, if the schedule is overridden via `CRON_METAGAME_REFRESH` to a more
frequent interval, two concurrent refreshes could run simultaneously, each attempting to delete
then re-insert wishlist rows — leading to double-counted upserts and a brief window where
auto-added rows are deleted mid-run.

**Fix:** Add a guard flag mirroring the price-collection pattern:
```typescript
let isMetagameRunning = false

// inside cron callback:
if (isMetagameRunning) {
  logger.warn('Metagame refresh already running, skipping this trigger')
  return
}
isMetagameRunning = true
try {
  const summary = await executeMetagameRefresh()
  logger.info(`Weekly metagame refresh complete: ${JSON.stringify(summary)}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`Weekly metagame refresh threw an error (scheduler continues): ${message}`)
} finally {
  isMetagameRunning = false
}
```

---

## Info

### IN-01: N+1 DB calls in `upsertResolvedCards` — one INSERT per card

**File:** `src/scraper/metagame/orchestrator.ts:74–91`
**Issue:** `upsertResolvedCards` iterates over `cardsToInsert` and issues one `db.insert()` per
card. For the maximum case (150 missing cards), this is 150 sequential round-trips to Postgres
instead of one batched `INSERT ... ON CONFLICT DO UPDATE`. While acceptable for a weekly job with
up to 150 rows, this is inconsistent with how Phase 2's `upsertCards()` in
`src/scraper/providers/scryfall.ts` works (single batched insert). Consider consolidating to a
single call for consistency and reduced latency:
```typescript
await db
  .insert(cards)
  .values(cardsToInsert)
  .onConflictDoUpdate({
    target: cards.oracleId,
    set: {
      name: sql`excluded.name`,
      set: sql`excluded.set`,
      rarity: sql`excluded.rarity`,
      color: sql`excluded.color`,
      imageUrl: sql`excluded.image_url`,
      lastFetched: sql`excluded.last_fetched`,
    },
  })
```

---

### IN-02: Rate-limiter Lua script skips `EXPIRE` refresh on denied requests

**File:** `src/lib/ratelimit/rate-limiter.ts:83–87`
**Issue:** `EXPIRE` is only called on the success branch (line 83). On the deny branch (line 86)
the key's TTL is not refreshed. This means that if a bucket is at 0 tokens, the key's TTL
continues counting down from the last successful call, and the bucket may expire — resetting to
`limit` tokens — earlier than expected. For `SCRYFALL_HEAVY` (interval=1 s) this is rarely
observable, but for longer-lived buckets it could allow a burst shortly after a period of high
activity. This is a pre-existing issue in the rate limiter (not introduced in phase 05) and is
low severity for the current use case; documented here for completeness.

---

### IN-03: `scheduleMetagameRefresh` is exported but never called in any application entry point

**File:** `src/scheduler/index.ts:7` and `src/scheduler/jobs.ts:272`
**Issue:** `scheduleMetagameRefresh` is exported from the scheduler barrel but a search of all
non-test source files (`src/bot/index.ts`, `src/app/`, etc.) shows no call site that invokes it
and calls `.start()`. The price-collection scheduler is similarly not wired in the reviewed
source — both appear to require manual integration by the caller. This is probably intentional for
the single-entrypoint bot architecture, but it means the weekly cron will never fire unless the
entry point (likely `src/bot/index.ts` or a dedicated worker) is updated to call
`scheduleMetagameRefresh().start()`.

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
