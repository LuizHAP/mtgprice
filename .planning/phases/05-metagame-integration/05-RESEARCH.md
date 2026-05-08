# Phase 5: Metagame Integration - Research

**Researched:** 2026-05-08
**Domain:** External metagame data sources (EDHREC JSON API, MTGTop8 HTML scraping), Scryfall card resolution, wishlist upsert, weekly cron scheduling
**Confidence:** HIGH (data sources verified by live fetch; Scryfall APIs verified via official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Monitor top 50 cards per format — Standard, Modern, and Commander each contribute 50 cards (maximum 150 auto-monitored cards).
- **D-02:** Metagame list refreshes weekly (Sunday). Dedicated weekly cron job, separate from the 3x-daily price collection cron.
- **D-07:** All auto-added metagame cards use `userId = 1` (single-user mode, inherited from Phase 1 D-09 and Phase 4 D-09).

### Claude's Discretion

- **D-03:** Evaluate MTGTop8, MTGGoldfish, and EDHREC as sources. Prioritize sources with stable access and minimal scraping fragility. EDHREC has a documented public API for Commander top cards — prefer that for Commander. For Standard/Modern, pick the most stable scraped or API-based source.
- **D-04:** Default to the `wishlists` table approach (per D-08 from Phase 4) unless a clear reason to diverge is found.
- **D-05:** Remove from auto-monitoring when card drops off top-50; cards the user added manually must never be auto-removed.
- **D-06:** If a metagame card's oracle_id is not yet in the local `cards` table, fetch its metadata from Scryfall and upsert before adding to the watchlist. Failures should be logged and the card skipped (non-blocking).

### Deferred Ideas (OUT OF SCOPE)

- Pioneer, Legacy, Vintage, Pauper staples (META-04 through META-07) — explicitly v2.
- Per-format on/off toggle — Phase 6 polish.
- Price charts / visualizations (v2 — ANALY-01).
- User-facing UI for metagame card management (existing wishlist UI inherits these cards).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| META-01 | Sistema auto-adiciona top cartas mais jogadas de Standard ao monitoramento | MTGTop8 `/topcards?f=ST` HTML scraping (verified accessible); Scryfall `/cards/collection` for oracle_id resolution |
| META-02 | Sistema auto-adiciona top cartas mais jogadas de Modern ao monitoramento | MTGTop8 `/topcards?f=MO` HTML scraping (verified accessible); Scryfall `/cards/collection` for oracle_id resolution |
| META-03 | Sistema auto-adiciona top X cartas mais populares de Commander ao monitoramento | EDHREC `json.edhrec.com/pages/top/week.json` (verified working, returns 100 cards); take first 50 |
</phase_requirements>

---

## Summary

Phase 5 wires three external data sources into the existing wishlist + price-collection pipeline. EDHREC exposes a stable, publicly accessible JSON endpoint (`json.edhrec.com/pages/top/week.json`) that returns Commander top cards with card names and inclusion stats — no authentication required, no HTML parsing needed. For Standard and Modern, MTGTop8 provides "most played cards" pages (`/topcards?f=ST` and `/topcards?f=MO`) with simple HTML table structure that cheerio can parse; both pages responded successfully during research (no Cloudflare block). MTGGoldfish returned HTTP 403 on both format-staples endpoints and should not be used.

Once card names are collected from these sources, each name must be resolved to a Scryfall `oracle_id` using either the `/cards/named?exact=` endpoint (1-at-a-time, 2 req/s limit) or the `/cards/collection` bulk endpoint (up to 75 names per POST, also 2 req/s). If the resolved card is already in the local `cards` table, it can be inserted into `wishlists` directly. If not, Scryfall metadata must be upserted first — the exact pattern Phase 2 established in `src/scraper/providers/scryfall.ts`.

The weekly cron follows the same `node-cron` + `schedulePriceCollection` pattern already in `src/scheduler/jobs.ts`. The Sunday schedule expression is `'0 2 * * 0'` (2:00 AM Sunday — runs before the Monday morning price collection). Auto-added wishlist rows must be distinguishable from manually added rows so they can be removed on the next refresh without touching user cards; the simplest mechanism is a boolean `isAutoAdded` column on the `wishlists` table.

**Primary recommendation:** Use EDHREC JSON API for Commander (verified stable, JSON, no scraping), MTGTop8 cheerio scraping for Standard + Modern (accessible, simple HTML tables), Scryfall `/cards/collection` for batch name→oracle_id resolution (max 75 per request, 2 req/s limit), and add an `is_auto_added` column to `wishlists` to safely manage removal-on-refresh.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | ^1.13.6 | HTTP client for EDHREC JSON + Scryfall API | Already in project, used by scryfall.ts |
| cheerio | ^1.2.0 | HTML parsing for MTGTop8 scraping | Already in project, used by price scrapers |
| node-cron | ^3.0.3 | Weekly Sunday cron registration | Already in project, used by scheduler/jobs.ts |
| drizzle-orm | ^0.38.4 | Wishlist and cards upsert | Already in project, established ORM |

All four libraries are already installed. No new dependencies required for this phase. [VERIFIED: package.json grep]

### No New Install Needed
```bash
# Nothing to install — all dependencies already in package.json
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/scraper/
├── providers/                   # Existing price fetchers
│   ├── scryfall.ts              # Existing — reuse upsertCards() here
│   └── [metagame sources below]
└── metagame/
    ├── edhrec.ts                # Commander top cards via JSON API
    ├── mtgtop8.ts               # Standard + Modern via cheerio scraping
    ├── scryfall-resolver.ts     # Name → oracle_id via /cards/collection
    └── orchestrator.ts          # Runs all three, upserts wishlists

src/scheduler/
└── jobs.ts                      # Add scheduleMetagameRefresh() here
```

The metagame module lives in `src/scraper/metagame/` — parallel to the price providers — and follows the same axios + cheerio + circuit-breaker + rate-limiter conventions.

### Pattern 1: EDHREC JSON Fetch (Commander)

**What:** Direct GET to `https://json.edhrec.com/pages/top/week.json` returns 100 Commander staples as a JSON array.
**When to use:** Commander format only. No auth, no scraping, no API key.
**Response structure (verified by live fetch):**
```typescript
// Source: live fetch of json.edhrec.com/pages/top/week.json (2026-05-08)
interface EDHRECCard {
  id: string          // UUID (Scryfall card id — NOT oracle_id)
  name: string        // "Sol Ring"
  sanitized: string   // "sol-ring"
  url: string         // "/cards/sol-ring"
  inclusion: number   // deck count
  label: string       // "In 227503 decks\n84% of 272277 decks"
  num_decks: number
  potential_decks: number
}
```
Take the first 50 entries (`slice(0, 50)`). Use the `name` field for Scryfall resolution.

**IMPORTANT:** The `id` field from EDHREC is a Scryfall card `id` (not `oracle_id`). Do NOT insert it directly into `wishlists.cardId`. Use it as an accelerator for Scryfall lookup: `GET https://api.scryfall.com/cards/{id}` returns the card with its `oracle_id`. Alternatively, use the `/cards/collection` bulk endpoint with `{"name": "<name>"}` identifiers, which is rate-limit-efficient (batch 50 names in one POST).

### Pattern 2: MTGTop8 Cheerio Scraping (Standard + Modern)

**What:** GET `https://www.mtgtop8.com/topcards?f=ST&meta=52` or `?f=MO&meta=51`, parse HTML table with cheerio.
**When to use:** Standard (ST) and Modern (MO) formats.
**Table structure (verified by live fetch):**
The page renders a table of "MOST PLAYED CARDS" with rows containing: card name, deck %, average copies. Cheerio selector pattern based on Phase 2's liga-magic/cardkingdom scrapers:
```typescript
// Source: MTGTop8 live fetch 2026-05-08, confirmed table structure
const $ = cheerio.load(html)
// Row pattern: table rows in the "MOST PLAYED CARDS" section
// Card name is in the first <td> of each data row
// Percentage is in the second <td>
```
Note: `meta=52` (Standard) and `meta=51` (Modern) are the current metagame IDs as of research date. These IDs may change when new metagames are created. Consider using the format page first to read the current meta ID, or hardcode with a fallback to the format page.

**Resilience:** MTGTop8 returned HTTP 200 without Cloudflare protection during research. The site has no `robots.txt` (returned 404), so there is no formal Disallow directive. The existing GitHub scrapers (freeall/mtgtop8, kammradt/mtgtop8-scrapper) use simple HTTP fetches without browser automation. [MEDIUM confidence — ToS not explicitly reviewed, but no technical block found]

### Pattern 3: Scryfall Batch Name Resolution

**What:** POST to `https://api.scryfall.com/cards/collection` with up to 75 `{"name": "<card name>"}` identifiers.
**When to use:** After collecting up to 50 card names from EDHREC or MTGTop8, batch-resolve to `oracle_id`.
**Rate limit:** 2 requests/second for `/cards/collection` (heavier endpoint). [CITED: scryfall.com/docs/api/rate-limits]
**Batch size:** 75 identifiers max per POST. 50 cards per format fits in one POST each. [CITED: scryfall.com/docs/api/cards/collection]

```typescript
// Source: Scryfall API documentation
const response = await axios.post('https://api.scryfall.com/cards/collection', {
  identifiers: cardNames.map(name => ({ name }))
})
// response.data.data = array of Card objects with oracle_id
// response.data.not_found = array of unresolved identifiers
```

Use the existing `RATE_LIMITS.SCRYFALL` preset from `src/lib/ratelimit/rate-limiter.ts`. Note: the current preset is for 10 req/s (bulk data). Add a separate `RATE_LIMITS.SCRYFALL_HEAVY` preset at 2 req/s for named/collection endpoints.

### Pattern 4: Card Upsert Before Wishlist Insert (D-06)

**What:** Before inserting into `wishlists`, verify the card exists in `cards` table. If missing, upsert via the existing `upsertCards()` in `src/scraper/providers/scryfall.ts`.
**When to use:** Any card resolved from metagame source that is not yet in local DB.

```typescript
// Source: existing pattern from src/scraper/providers/scryfall.ts
// Check if card exists
const existing = await db.query.cards.findFirst({
  where: eq(cards.oracleId, oracleId)
})

if (!existing) {
  // Build minimal ScryfallCard from the /cards/collection response
  await upsertCards([scryfallCardFromResponse])
}
```

### Pattern 5: Wishlist Upsert with Auto-Added Flag

**What:** Insert into `wishlists` with `onConflictDoNothing()` using Drizzle ORM. Distinguish auto-added rows for safe removal.
**When to use:** Adding metagame cards for `userId = 1`.

```typescript
// Source: drizzle-orm.team/docs/insert (verified pattern)
await db.insert(wishlists)
  .values({ userId: 1, cardId: oracleId, isAutoAdded: true })
  .onConflictDoNothing()  // UNIQUE(userId, cardId) — safe upsert
```

**Schema change required:** Add `is_auto_added boolean NOT NULL DEFAULT false` to `wishlists` table. Existing rows default to `false` (user-added). Auto-added metagame rows set to `true`.

**Removal logic (D-05):** On each weekly refresh, delete wishlist rows WHERE `userId = 1 AND isAutoAdded = true AND cardId NOT IN (currentTop50Set)`. This preserves all rows where `isAutoAdded = false` (user-added). [ASSUMED — deletion approach not verified against Phase 3 wishlist query shapes, but consistent with the UNIQUE constraint semantics]

### Anti-Patterns to Avoid

- **Using MTGGoldfish format-staples URLs:** `https://www.mtggoldfish.com/format-staples/standard` and `/modern` returned HTTP 403 (Cloudflare block) during research. Do not implement MTGGoldfish scraping. [VERIFIED: direct fetch attempted 2026-05-08]
- **Using EDHREC `id` as oracle_id:** The `id` field in EDHREC JSON is a Scryfall card `id` (printing-specific), not `oracle_id`. Inserting it directly into `wishlists.cardId` will cause FK violations or wrong card matching. Always resolve through Scryfall.
- **Using `meta=52` / `meta=51` as hard constants without fallback:** MTGTop8 meta IDs can change. Consider fetching the format page first to read the current active meta ID, or at minimum log a warning if fewer than 20 cards are returned (likely stale meta ID).
- **Running metagame refresh inside `executePriceCollection`:** The weekly Sunday cron is dedicated and separate. Do not interleave with the 3x-daily price cron per D-02.
- **Auto-removing cards without checking `isAutoAdded`:** Blindly deleting all wishlist rows for metagame cards would destroy user-added cards. Always filter on `isAutoAdded = true`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card name → oracle_id lookup | Custom name index | Scryfall `/cards/collection` | Handles fuzzy names, multiple printings, and not_found gracefully |
| Commander top cards | Custom deck aggregation | EDHREC JSON API | 7M+ decks aggregated — impossible to replicate |
| HTML scraping resilience | Custom retry logic | Existing circuit-breaker (`src/scraper/circuit-breaker.ts`) | Opossum circuit breaker already proven in Phase 2 |
| Rate limiting Scryfall | Custom delay counters | Existing `checkRateLimitPreset` | Redis-backed token bucket already calibrated for Scryfall |
| Wishlist deduplication | Custom duplicate check | `onConflictDoNothing()` + UNIQUE constraint | DB-enforced, atomic, zero extra queries |

---

## Common Pitfalls

### Pitfall 1: MTGTop8 Meta ID Staleness
**What goes wrong:** The current meta IDs (`meta=52` for Standard, `meta=51` for Modern) are dynamic. MTGTop8 creates a new meta segment when a new set rotates into the format. If the IDs change, the scraper silently returns zero or wrong cards.
**Why it happens:** The `/topcards?f=ST&meta=52` URL encodes the specific meta period, not "current Standard."
**How to avoid:** Either (a) always fetch `/format?f=ST` first and parse the active meta link, or (b) validate that the response contains at least 20 rows — if fewer are returned, log an error and skip format refresh.
**Warning signs:** Log line like "Standard returned 0 cards from MTGTop8" on a Sunday run.

### Pitfall 2: EDHREC JSON Endpoint Instability
**What goes wrong:** `json.edhrec.com` is an undocumented internal API. EDHREC may change the URL structure, response shape, or add authentication at any time.
**Why it happens:** No SLA, no versioning, not an official public API. [MEDIUM confidence on long-term stability]
**How to avoid:** Wrap the EDHREC fetch in the circuit breaker. If it fails, log and skip Commander refresh for that week rather than throwing. Validate that `container.json_dict.cardlists` (or the `cardviews` array) exists and has at least 20 entries before proceeding.
**Warning signs:** HTTP 4xx/5xx from `json.edhrec.com`, or response lacks expected keys.

### Pitfall 3: Scryfall Rate Limit on Heavy Endpoints
**What goes wrong:** `/cards/collection` is limited to 2 req/s (not 10 like lighter endpoints). Reusing the SCRYFALL preset (10 req/s) will cause HTTP 429 responses.
**Why it happens:** Scryfall distinguishes "heavy" endpoints (Search, Named, Collection) from lighter ones. The project's current `RATE_LIMITS.SCRYFALL` is set at 10 req/s.
**How to avoid:** Add `RATE_LIMITS.SCRYFALL_HEAVY = { limit: 2, interval: 1 }` to `src/lib/ratelimit/rate-limiter.ts`. Use this preset for all `/cards/collection` and `/cards/named` calls.
**Warning signs:** HTTP 429 responses from Scryfall during the metagame refresh cron.

### Pitfall 4: Wishlist Removal Destroying User-Added Cards
**What goes wrong:** On refresh, deleting all auto-monitored cards without the `isAutoAdded` filter removes cards the user manually added that happen to also be metagame staples.
**Why it happens:** A card like "Lightning Bolt" could exist in `wishlists` both because the user added it and because Modern auto-added it. Without `isAutoAdded`, a delete sweeps both.
**How to avoid:** Add `is_auto_added boolean NOT NULL DEFAULT false` to the `wishlists` schema. Removal query always filters: `WHERE is_auto_added = true AND card_id NOT IN (newTop50)`.
**Warning signs:** User complains that manually added cards disappeared after a Sunday refresh.

### Pitfall 5: Missing Card in `cards` Table Blocks Wishlist Insert
**What goes wrong:** `wishlists.cardId` has a FK reference to `cards.oracleId`. If a metagame card is resolved from Scryfall but not yet in the local `cards` table, the wishlist insert throws a FK violation.
**Why it happens:** The `cards` table is seeded from bulk data (recent sets), but metagame staples include reprints across many sets. `oracle_id` may already exist but the specific printing from bulk seed may not cover it.
**How to avoid:** Per D-06 — always check `cards` table before wishlist insert; upsert from Scryfall `/cards/collection` response data if missing. The Scryfall collection response already contains all card metadata fields needed by the `cards` table schema.
**Warning signs:** `ERROR: insert or update on table "wishlists" violates foreign key constraint` in Sunday cron logs.

---

## Code Examples

### EDHREC Fetch (Commander)
```typescript
// Source: live fetch verified 2026-05-08
// Endpoint: https://json.edhrec.com/pages/top/week.json
// Returns: { container: { json_dict: { cardlists: [...] } } } or { cardviews: [...] }
async function fetchEDHRECTopCards(limit = 50): Promise<string[]> {
  const response = await axios.get('https://json.edhrec.com/pages/top/week.json')
  // Structure observed: cardviews array at response.data level
  const cards = response.data?.cardviews ?? []
  return cards.slice(0, limit).map((c: { name: string }) => c.name)
}
```

### MTGTop8 Standard/Modern Scrape
```typescript
// Source: MTGTop8 live fetch verified 2026-05-08
// cheerio is already in package.json (^1.2.0)
async function fetchMTGTop8TopCards(format: 'ST' | 'MO', limit = 50): Promise<string[]> {
  const metaId = format === 'ST' ? 52 : 51
  const url = `https://www.mtgtop8.com/topcards?f=${format}&meta=${metaId}`
  const { data } = await axios.get<string>(url, {
    headers: { 'User-Agent': 'MTGPrice-Monitor/1.0' }
  })
  const $ = cheerio.load(data)
  const names: string[] = []
  // Card names are text content in the first <td> of each data row
  // Actual selector requires inspection — use 'table tr td:first-child a' as starting point
  $('table tr').each((_, row) => {
    const name = $(row).find('td:first-child a').text().trim()
    if (name) names.push(name)
  })
  return names.slice(0, limit)
}
```
**Note:** The exact cheerio selector must be validated against the live HTML. The structure shows card names in anchor tags within table cells. Log the raw HTML on first run and refine the selector if needed.

### Scryfall Batch Resolution
```typescript
// Source: Scryfall API docs (cards/collection endpoint, 75 max per batch)
// Rate limit: 2 req/s for /cards/collection — use SCRYFALL_HEAVY preset
async function resolveNamesToOracleIds(
  names: string[]
): Promise<Array<{ name: string; oracleId: string; metadata: ScryfallCard }>> {
  const BATCH_SIZE = 75
  const results: Array<{ name: string; oracleId: string; metadata: ScryfallCard }> = []

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE)
    const { allowed } = await checkRateLimitPreset('scryfall:collection', RATE_LIMITS.SCRYFALL_HEAVY)
    if (!allowed) await sleep(500) // back off if rate limited

    const response = await axios.post('https://api.scryfall.com/cards/collection', {
      identifiers: batch.map(name => ({ name }))
    })

    for (const card of response.data.data) {
      results.push({
        name: card.name,
        oracleId: card.oracle_id,
        metadata: card
      })
    }
    // response.data.not_found — log and skip
  }

  return results
}
```

### Wishlist Upsert with Auto-Added Flag
```typescript
// Source: drizzle-orm.team/docs/insert (onConflictDoNothing)
// Requires: is_auto_added column on wishlists table
await db.insert(wishlists)
  .values({ userId: 1, cardId: oracleId, isAutoAdded: true })
  .onConflictDoNothing()
```

### Weekly Cron Registration
```typescript
// Source: node-cron docs + existing jobs.ts pattern
// Pattern: 0 2 * * 0 = 2:00 AM every Sunday (runs before Monday morning price collection)
import cron from 'node-cron'

export function scheduleMetagameRefresh(): { start: () => void; stop: () => void } {
  const schedule = process.env.CRON_METAGAME_REFRESH || '0 2 * * 0' // Sunday 2AM

  const job = cron.schedule(schedule, async () => {
    logger.info('Weekly metagame refresh triggered')
    await executeMetagameRefresh()
  }, { scheduled: false })

  return {
    start: () => { job.start() },
    stop: () => { job.stop() }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MTGGoldfish format-staples (HTTP GET) | Blocked by Cloudflare 403 | ~2024 | Must use MTGTop8 or EDHREC instead |
| EDHREC HTML scraping | EDHREC JSON API at json.edhrec.com | ~2020 | No browser automation needed for Commander |
| Per-name Scryfall lookup | Batch `/cards/collection` (75 per POST) | 2023 | 75x fewer API calls for bulk resolution |

**Deprecated/outdated:**
- MTGGoldfish direct scraping: Cloudflare now blocks standard axios/cheerio fetches. VERIFIED as blocked (HTTP 403) during research.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MTGTop8 cheerio selectors `table tr td:first-child a` will capture card names | Code Examples, Pitfall 1 | Scraper returns empty list; wrong selector silently skips all cards. Mitigation: validate output length before proceeding. |
| A2 | MTGTop8 meta IDs `meta=52` (Standard) and `meta=51` (Modern) are current as of 2026-05-08 | Architecture Patterns | Wrong IDs return 0 or stale cards. Mitigation: validate >20 rows returned. |
| A3 | EDHREC JSON structure uses `cardviews` top-level array | Code Examples | Fetch returns empty results. Response shape was observed during research but could vary. Add a fallback to `container.json_dict.cardlists`. |
| A4 | Removal policy using `is_auto_added = true` filter is safe against all Phase 3 wishlist query paths | Architecture Patterns | User-added "and" auto-added cards get double-deleted. Mitigation: review Phase 3 queries to confirm no queries delete by cardId without userId filter. |
| A5 | EDHREC json.edhrec.com subdomain has no rate limiting or auth requirement | Architecture Patterns | HTTP 429 or 401 on weekly fetch. Mitigation: circuit breaker wraps the call; failure skips Commander that week. |

---

## Open Questions

1. **MTGTop8 exact cheerio selector**
   - What we know: Page renders a table of most-played cards with name and percentage columns. Live fetch confirmed card names are visible.
   - What's unclear: The exact CSS class or element hierarchy for the card name cells requires inspecting raw HTML source. The fetched content confirmed "table tr td" structure but did not expose exact class names.
   - Recommendation: Implement with tentative selector `table tr td:first-child a`, log first 5 parsed names during Wave 0 test, refine if needed.

2. **EDHREC JSON response root structure variation**
   - What we know: Live fetch returned a `cardviews` array at the root during research. A secondary fetch of the month endpoint confirmed the same structure. GitHub references suggest older endpoints used `container.json_dict.cardlists`.
   - What's unclear: Whether the `/pages/top/week.json` endpoint always returns `cardviews` at the root or may sometimes use the nested path.
   - Recommendation: Access `response.data?.cardviews ?? response.data?.container?.json_dict?.cardlists?.[0]?.cardviews ?? []` with a fallback chain. Validate length > 10 before slicing.

3. **Schema migration for `is_auto_added` column**
   - What we know: The `wishlists` table has a UNIQUE(userId, cardId) constraint. Adding `is_auto_added` requires a Drizzle migration.
   - What's unclear: Whether existing `wishlists` rows from Phase 3 tests need `is_auto_added = false` backfill or if `DEFAULT false` handles it automatically.
   - Recommendation: `DEFAULT false` handles all existing rows automatically in PostgreSQL — no backfill needed. The migration is a simple `ALTER TABLE wishlists ADD COLUMN is_auto_added boolean NOT NULL DEFAULT false`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Weekly cron, axios, cheerio | Yes | v22.18.0 | — |
| axios | EDHREC + Scryfall HTTP | Yes | ^1.13.6 (in package.json) | — |
| cheerio | MTGTop8 HTML parsing | Yes | ^1.2.0 (in package.json) | — |
| node-cron | Weekly schedule registration | Yes | ^3.0.3 (in package.json) | — |
| PostgreSQL/TimescaleDB | Wishlist + cards upsert | Yes | 16 + TimescaleDB 2.15 (docker-compose.yml) | — |
| Redis | Rate limiter for Scryfall | Yes | Running per Phase 1 | — |
| EDHREC json.edhrec.com | Commander top cards | Yes | Verified 2026-05-08 | Skip Commander that week |
| MTGTop8 topcards | Standard + Modern cards | Yes | Verified 2026-05-08 | Skip format that week |
| Scryfall API | Name → oracle_id resolution | Yes | Public API, no key needed | Cannot resolve — skip card |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** EDHREC, MTGTop8, and Scryfall are all external services with circuit-breaker fallbacks (skip that format/card that week).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `pnpm test:run -- src/scraper/metagame` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-01 | Standard top-50 names extracted from MTGTop8 HTML | unit | `pnpm test:run -- src/scraper/metagame/__tests__/mtgtop8.test.ts` | No — Wave 0 |
| META-02 | Modern top-50 names extracted from MTGTop8 HTML | unit | `pnpm test:run -- src/scraper/metagame/__tests__/mtgtop8.test.ts` | No — Wave 0 |
| META-03 | Commander top-50 names extracted from EDHREC JSON | unit | `pnpm test:run -- src/scraper/metagame/__tests__/edhrec.test.ts` | No — Wave 0 |
| META-01,02,03 | Scryfall batch resolution returns oracle_ids | unit | `pnpm test:run -- src/scraper/metagame/__tests__/scryfall-resolver.test.ts` | No — Wave 0 |
| META-01,02,03 | Wishlist upsert with isAutoAdded flag | unit | `pnpm test:run -- src/scraper/metagame/__tests__/orchestrator.test.ts` | No — Wave 0 |
| META-05 | Stale cards removed (isAutoAdded=true, not in new list) | unit | `pnpm test:run -- src/scraper/metagame/__tests__/orchestrator.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:run -- src/scraper/metagame`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/scraper/metagame/__tests__/edhrec.test.ts` — covers META-03 Commander fetch
- [ ] `src/scraper/metagame/__tests__/mtgtop8.test.ts` — covers META-01, META-02 (mocked HTML)
- [ ] `src/scraper/metagame/__tests__/scryfall-resolver.test.ts` — covers name→oracle_id resolution
- [ ] `src/scraper/metagame/__tests__/orchestrator.test.ts` — covers wishlist upsert + removal logic
- [ ] Schema migration: `ALTER TABLE wishlists ADD COLUMN is_auto_added boolean NOT NULL DEFAULT false`
- [ ] Rate limit preset addition: `RATE_LIMITS.SCRYFALL_HEAVY = { limit: 2, interval: 1 }` in `src/lib/ratelimit/rate-limiter.ts`

---

## Security Domain

No new authentication surfaces or user-input paths are introduced. The metagame fetcher is a background job consuming read-only external APIs.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surface |
| V3 Session Management | No | Background cron, no session |
| V4 Access Control | No | userId hardcoded to 1 per D-07 |
| V5 Input Validation | Yes | Card names from external sources sanitized before DB insert (max length = wishlists.cardId varchar(255)) |
| V6 Cryptography | No | No cryptographic operations |

**Threat: External source data injection** — Card names from EDHREC/MTGTop8 are inserted into the DB. Drizzle ORM parameterizes all queries, preventing SQL injection. The only surface is varchar length overflow; validate `name.length <= 255` before insert.

---

## Sources

### Primary (HIGH confidence)
- EDHREC json.edhrec.com — live fetch of `/pages/top/week.json` and `/pages/top/month.json` confirmed JSON structure and 100-card response (2026-05-08)
- MTGTop8 live fetch — `/topcards?f=ST&meta=52` and `/topcards?f=MO&meta=51` confirmed HTTP 200 + card table content (2026-05-08)
- [Scryfall /cards/collection docs](https://scryfall.com/docs/api/cards/collection) — 75 max identifiers per POST, oracle_id identifier type
- [Scryfall /cards/named docs](https://scryfall.com/docs/api/cards/named) — fuzzy/exact parameters, 2 req/s limit
- [Scryfall Rate Limits](https://scryfall.com/docs/api/rate-limits) — heavy endpoints (named, collection) = 2 req/s
- [Drizzle ORM Insert](https://orm.drizzle.team/docs/insert) — onConflictDoNothing() behavior
- Project codebase — `src/scraper/providers/scryfall.ts`, `src/scheduler/jobs.ts`, `src/lib/ratelimit/rate-limiter.ts`, `src/db/schema/wishlists.ts` (all read 2026-05-08)

### Secondary (MEDIUM confidence)
- [MTGGoldfish format-staples/standard](https://www.mtggoldfish.com/format-staples/standard) — confirmed HTTP 403 Cloudflare block (2026-05-08); ruled out as source
- [MTGGoldfish format-staples/modern](https://www.mtggoldfish.com/format-staples/modern) — confirmed HTTP 403 Cloudflare block (2026-05-08); ruled out as source
- [EDHREC robots.txt](https://edhrec.com/robots.txt) — only disallows `/articles/preview/`, `/articles/search/`, `/deckpreview/`, `/puzzlebookvegas/`; json.edhrec.com subdomain not mentioned
- MTGTop8 robots.txt — returned HTTP 404 (no restrictions file)
- [github.com/freeall/mtgtop8](https://github.com/freeall/mtgtop8) — community Node.js scraper confirming HTML accessibility
- [github.com/donaldpminer/edhrec api.py](https://github.com/donaldpminer/edhrec/blob/master/api.py) — confirmed json.edhrec.com endpoint pattern

### Tertiary (LOW confidence)
- MTGTop8 cheerio selector specifics — the exact CSS selectors were not confirmed; response showed card names in table rows but exact class names were not captured

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in package.json
- Data sources (EDHREC): HIGH — live JSON endpoint verified, response structure confirmed
- Data sources (MTGTop8): MEDIUM — live HTTP 200 confirmed, cheerio selectors need runtime validation
- Data sources (MTGGoldfish): HIGH (confirmed blocked) — definitively ruled out
- Architecture: HIGH — follows existing Phase 2 patterns exactly
- Pitfalls: HIGH — derived from verified findings (403 on Goldfish, rate limit docs, EDHREC API undocumented nature)
- Schema changes: HIGH — straightforward Drizzle migration, DEFAULT handles backfill

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (MTGTop8 meta IDs may change with Standard rotation; EDHREC endpoint may evolve)
