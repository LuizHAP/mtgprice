# Phase 2: Core Data Collection - Research

**Researched:** 2026-03-05
**Domain:** Multi-source price collection, web scraping, API integration, currency conversion
**Confidence:** MEDIUM

## Summary

Phase 2 requires building a multi-source price collection system that fetches MTG card prices from 4 sources (Liga Magic, TCGPlayer, CardMarket, CardKingdom) with currency conversion and stores historical data in TimescaleDB. The research reveals a hybrid API-first/scraping-fallback approach is optimal, with Playwright recommended over Puppeteer for 2026, and Opossum as the standard circuit breaker implementation for Node.js.

**Primary recommendation:** Use Scryfall bulk data for card discovery, implement hybrid API/scraping with Opossum circuit breakers, Playwright for browser automation, and Brazilian Central Bank API for exchange rates.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**API vs Scraping Strategy**
- Primary approach: Hybrid (API-first, scraping fallback)
- Try official APIs first for all 4 sources
- Fall back to web scraping (cheerio/Puppeteer) if no API exists, API is limited, or API fails
- Source-specific strategy:
  - **Liga Magic:** Try API first → fallback to scraping (no documented public API)
  - **TCGPlayer:** Hybrid - use official API (requires key), scraping fallback if API fails
  - **CardMarket:** Same hybrid approach - try API first, then scrape
  - **CardKingdom:** Same hybrid approach - try API first, then scrape

**Error Handling: Circuit Breaker Pattern**
- Track failure rate per source
- If source fails >50% of requests in a collection run → stop that source
- Continue with other sources (one bad source doesn't block all)
- Retry stopped source in next scheduled run (2-3x daily)
- Individual card failures: log and skip, don't block entire source

**Rate Limiting: Conservative Approach**
- Use existing Redis-backed token bucket rate limiter (from Phase 1)
- Set limits at 80% of documented API limits (safety buffer)
- Example: TCGPlayer documented as 50 req/min → use 40 req/min

**Fetch Strategy: Smart Refresh with Source Priority**
- Refresh frequency: Only fetch if >8 hours since last successful fetch per card/source
- Fetch order:
  1. Liga Magic (BR prices are critical) - fetch first
  2. TCGPlayer, CardMarket, CardKingdom - fetch in parallel after Liga Magic

**Currency Conversion**
- USD/EUR → BRL conversion with 6.38% IOF (credit card)
- Exchange rate API: TBD during research
- Conversion applied during price collection before storing in database
- All prices stored as BRL in `prices` table (price_brl column)

**Card Discovery & Metadata**
- Card Source: Scryfall Bulk Data
  - Download "Unique Card Artwork" or "Default Cards" dataset
  - Contains all cards, oracle_ids, set information, image URLs
- Initial Scope: Manual seed - 100-500 cards of interest for testing
- Metadata Refresh: 30-Day Cycle - refresh if >30 days old
- Sync Strategy: Upsert All - use SQL upsert (ON CONFLICT DO UPDATE)
- New Set Detection: Auto-Detect from Scryfall - monitor RSS feed or API
- Image Handling: Hotlink Scryfall URLs - store image URLs, display from CDN

### Claude's Discretion

- Exact exchange rate API selection (Banco Central vs commercial)
- New set polling frequency (daily vs weekly)
- Bulk data re-sync cadence (beyond 30-day metadata refresh)
- Card deduplication logic within bulk data import
- Error logging granularity and alerting thresholds

### Deferred Ideas (OUT OF SCOPE)

- Local image hosting for card images (v2 if Scryfall hotlinking becomes unreliable)
- Real-time price updates (NOTIF-03 explicitly requires 2-3x daily, not real-time)
- User-defined card lists (Phase 3 wishlist covers this)
- Metagame-based auto-discovery (Phase 5 covers this)
- Multiple currency support (BRL-only for v1 per requirements)
- Historical price data downsampling (Phase 1 CONTEXT.md mentioned 90-day raw → weekly aggregation, not implementing in Phase 2)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRICE-01 | Sistema coleta preços da Liga Magic (Brasil) | Web scraping approach required (no known API), robots.txt compliance needed |
| PRICE-02 | Sistema coleta preços da TCGPlayer (EUA) | Hybrid approach: API first (requires key), scraping fallback with circuit breaker |
| PRICE-03 | Sistema coleta preços da CardMarket (Europa) | Hybrid approach: API first, scraping fallback with circuit breaker |
| PRICE-04 | Sistema coleta preços da CardKingdom (EUA) | Hybrid approach: API first, scraping fallback with circuit breaker |
| PRICE-05 | Sistema converte preços USD/EUR → BRL com IOF de 6.38% | Brazilian Central Bank API or commercial API with IOF calculation |
| PRICE-07 | Sistema realiza checagens de preços 2-3x ao dia de forma agendada | node-cron 3.0.3 already installed, schedule with smart refresh (>8h old) |
| PRICE-08 | Sistema armazena histórico de preços para cada carta/fonte | TimescaleDB hypertables from Phase 1, composite indexes optimized |
| NOTIF-03 | Sistema respeita frequência de checagem 2-3x ao dia (não real-time) | Smart refresh strategy ensures 2-3x daily, not real-time |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **axios** | ^1.6.0 | HTTP client for API calls | Simpler than fetch, better error handling, interceptors for auth |
| **cheerio** | ^1.0.0 | Fast HTML parsing (scraping fallback) | jQuery-like syntax, 10x faster than browser automation |
| **playwright** | ^1.40.0 | Browser automation for complex scraping | Multi-browser support, better auto-waiting, 2026 recommended |
| **opossum** | ^8.0.0 | Circuit breaker pattern implementation | Node.js standard, lightweight, TypeScript support, battle-tested |
| **node-cron** | 3.0.3 | Scheduled job execution (already installed) | Simple, in-process scheduling, adequate for 2-3x daily jobs |
| **ioredis** | 5.5.0 | Redis client (already installed) | Rate limiting state storage, circuit breaker state sharing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **zod** | ^3.22.0 | Runtime type validation for API responses | Validate external API data before database insertion |
| **p-queue** | ^8.0.0 | Promise queue with concurrency control | Limit parallel requests to avoid overwhelming sources |
| **date-fns** | ^3.0.0 | Date manipulation for smart refresh logic | Calculate "8 hours since last fetch" reliably |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **playwright** | puppeteer | Playwright: multi-browser, better API, 2026-recommended. Puppeteer: Chrome-only, lighter, mature ecosystem |
| **opossum** | Custom circuit breaker | Opossum: battle-tested, lightweight (4 files), rich events. Custom: full control, more maintenance |
| **axios** | fetch or ky | Axios: simpler API, interceptors. ky: modern, TypeScript-first. fetch: built-in, verbose |
| **cheerio** | jsdom | Cheerio: 10x faster, jQuery-like. jsdom: full DOM simulation, slower |

**Installation:**
```bash
npm install axios cheerio playwright opossum zod p-queue date-fns
npx playwright install chromium  # Install Chromium browser
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── scraper/
│   ├── sources/           # Source-specific implementations
│   │   ├── ligamagic/     # Liga Magic scraper
│   │   ├── tcgplayer/     # TCGPlayer API + scraper
│   │   ├── cardmarket/    # CardMarket API + scraper
│   │   └── cardkingdom/   # CardKingdom API + scraper
│   ├── circuit-breaker.ts # Circuit breaker wrapper (Opossum)
│   ├── fetcher.ts         # Unified fetcher with smart refresh
│   └── currency.ts        # Exchange rate conversion with IOF
├── scheduler/
│   ├── jobs.ts            # Cron job definitions (2-3x daily)
│   └── coordinator.ts     # Orchestrate Liga Magic → parallel intl sources
├── db/
│   ├── queries/           # Database queries for price storage
│   └── migrations/        # Scryfall bulk data import
└── lib/
    ├── ratelimit/         # Existing Redis-backed rate limiter
    └── logger/            # Winston logging (already configured)
```

### Pattern 1: Circuit Breaker with Opossum

**What:** Wrap all external API/scraping calls in circuit breakers to prevent cascading failures

**When to use:** All external service calls (API requests, web scraping)

**Example:**
```typescript
// Source: https://www.npmjs.com/package/opossum
import CircuitBreaker from 'opossum'

const options = {
  timeout: 10000,                   // 10 second timeout
  errorThresholdPercentage: 50,     // Open circuit when 50% fail
  resetTimeout: 60000,              // Try again after 60 seconds
  rollingCountTimeout: 10000,       // 10-second sliding window
  rollingCountBuckets: 10           // 1-second buckets
}

async function fetchTCGPlayerPrice(cardId: string) {
  const response = await axios.get(`https://api.tcgplayer.com/prices/${cardId}`)
  return response.data
}

const breaker = new CircuitBreaker(fetchTCGPlayerPrice, options)

// Monitor state changes
breaker.on('open', () => logger.warn('TCGPlayer circuit opened'))
breaker.on('halfOpen', () => logger.info('TCGPlayer circuit half-open'))

// Fallback when circuit is open
breaker.fallback((cardId) => {
  logger.warn(`TCGPlayer unavailable, skipping ${cardId}`)
  return null
})
```

### Pattern 2: Smart Refresh with State Tracking

**What:** Only fetch prices if >8 hours since last successful fetch per card/source

**When to use:** All price collection operations to avoid wasted API calls

**Example:**
```typescript
async function shouldFetchPrice(cardId: string, source: string): Promise<boolean> {
  const lastPrice = await db.query.prices.findFirst({
    where: eq(prices.cardId, cardId),
    orderBy: [desc(prices.timestamp)],
    columns: { timestamp: true }
  })

  if (!lastPrice) return true  // Never fetched

  const hoursSinceLastFetch = differenceInHours(new Date(), lastPrice.timestamp)
  return hoursSinceLastFetch > 8
}
```

### Pattern 3: Fetch Orchestration (Liga Magic First)

**What:** Sequential fetch: Liga Magic first, then parallel international sources

**When to use:** Scheduled price collection jobs (2-3x daily)

**Example:**
```typescript
import PQueue from 'p-queue'

async function fetchAllPrices(cardIds: string[]) {
  // Phase 1: Liga Magic (sequential, rate-limited)
  const ligaQueue = new PQueue({ concurrency: 1 })
  for (const cardId of cardIds) {
    await ligaQueue.add(() => fetchLigaMagicPrice(cardId))
  }

  // Phase 2: International sources (parallel)
  const intlQueue = new PQueue({ concurrency: 3 })
  await Promise.all([
    ...cardIds.map(id => intlQueue.add(() => fetchTCGPlayerPrice(id))),
    ...cardIds.map(id => intlQueue.add(() => fetchCardMarketPrice(id))),
    ...cardIds.map(id => intlQueue.add(() => fetchCardKingdomPrice(id)))
  ])
}
```

### Anti-Patterns to Avoid

- **Synchronous scraping:** Never use synchronous requests - always async/await with proper concurrency limits
- **Ignoring robots.txt:** Always check robots.txt before scraping - respect site policies
- **Hardcoded rate limits:** Don't hardcode rate limits - use configurable presets with 80% buffer
- **Cascading failures:** Never let one source failure block all sources - use circuit breakers
- **Real-time polling:** NOTIF-03 requires 2-3x daily, not real-time - avoid excessive polling

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker | Custom state machine with timeout logic | **opossum** | Edge cases: half-open state, sliding windows, fallback functions, event monitoring |
| HTML parsing | Custom regex/string parsing | **cheerio** | Edge cases: malformed HTML, encoding issues, nested selectors, Unicode |
| Browser automation | Custom Selenium/Puppeteer setup | **playwright** | Edge cases: anti-bot detection, dynamic content, cookies, JavaScript execution |
| Rate limiting | In-memory counter with setInterval | **ioredis** (existing) | Edge cases: race conditions, multi-process scaling, atomic operations, TTL cleanup |
| Date arithmetic | Manual timestamp calculations | **date-fns** | Edge cases: timezone issues, DST transitions, leap seconds, locale differences |
| HTTP client | fetch with manual retry logic | **axios** | Edge cases: connection timeouts, retries, interceptors, request cancellation |
| Promise concurrency | Promise.all with batching | **p-queue** | Edge cases: rate limiting, queue prioritization, paused/resumed queues, error handling |

**Key insight:** Custom solutions for distributed systems problems (circuit breakers, rate limiting, concurrency) introduce subtle bugs that manifest only under load. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Blocking Collection on Single Card Failures

**What goes wrong:** One card's scrape failure causes entire collection job to abort, leaving 99% of cards unfetched

**Why it happens:** Unhandled promise rejections or try-catch blocks that re-throw errors

**How to avoid:**
```typescript
// BAD: One failure stops all
for (const cardId of cardIds) {
  await fetchPrice(cardId)  // Throws on error
}

// GOOD: Log and continue
for (const cardId of cardIds) {
  try {
    await fetchPrice(cardId)
  } catch (error) {
    logger.error(`Failed to fetch ${cardId}: ${error.message}`)
    // Continue to next card
  }
}
```

**Warning signs:** Collection logs show "stopping after error" or collection jobs complete in <1 second

### Pitfall 2: Ignoring robots.txt and ToS Violations

**What goes wrong:** Legal cease-and-desist orders, IP bans, blocked accounts

**Why it happens:** Rushing to implement without checking site policies

**How to avoid:**
1. Always fetch `https://example.com/robots.txt` before scraping
2. Check `User-agent: *` `Disallow: /` rules
3. Review site Terms of Service for scraping prohibitions
4. Implement respectful rate limits (1 request per second minimum)

**Warning signs:** HTTP 403 Forbidden errors, IP bans, account suspensions

### Pitfall 3: Currency Conversion Without IOF

**What goes wrong:** International prices appear 6.38% too cheap, users make incorrect purchasing decisions

**Why it happens:** Forgetting to apply IOF (Imposto sobre Operações Financeiras) for credit card purchases

**How to avoid:**
```typescript
const IOF_RATE = 0.0638  // 6.38%

function convertToBRL(price: number, exchangeRate: number): number {
  const converted = price * exchangeRate
  const withIOF = converted * (1 + IOF_RATE)
  return withIOF
}
```

**Warning signs:** TCGPlayer prices consistently lower than Liga Magic for same card

### Pitfall 4: Scryfall Bulk Data Price Staleness

**What goes wrong:** Using bulk data prices which are "dangerously stale after 24 hours" per Scryfall docs

**Why it happens:** Confusing bulk data (metadata) with real-time price data

**How to avoid:**
- Use Scryfall bulk data for **card metadata only** (names, oracle_ids, sets, images)
- Never use bulk data prices - fetch real-time prices from TCGPlayer/CardMarket/CardKingdom
- Scryfall docs: "prices should be considered dangerously stale after 24 hours"

**Warning signs:** Prices never change between collection runs

### Pitfall 5: Circuit Breaker Never Closes (Permanent Failure)

**What goes wrong:** Circuit breaker opens and never recovers, source permanently disabled

**Why it happens:** resetTimeout too short, or underlying issue never fixed

**How to avoid:**
```typescript
const options = {
  errorThresholdPercentage: 50,
  resetTimeout: 300000,  // 5 minutes - long enough for source to recover
  rollingCountTimeout: 60000,  // 1 minute window
  rollingCountBuckets: 10  // 6-second buckets
}
```

**Warning signs:** Source stays "unavailable" for hours despite service being healthy

### Pitfall 6: Race Conditions in Rate Limiting

**What goes wrong:** Multiple requests simultaneously pass rate limit check, causing API throttling

**Why it happens:** Non-atomic rate limit checks (check-then-set race condition)

**How to avoid:**
- Use existing Redis-backed token bucket with Lua scripts (already implemented)
- Lua scripts ensure atomic check-and-decrement operations
- Never use in-memory counters for distributed systems

**Warning signs:** API returns 429 Too Many Requests despite rate limiter

### Pitfall 7: TimescaleDB Hypertable Query Performance

**What goes wrong:** Price history queries take 10+ seconds as database grows

**Why it happens:** Querying without composite index (card_id, timestamp DESC)

**How to avoid:**
- Use existing composite index: `CREATE INDEX prices_card_timestamp_idx ON prices (card_id, timestamp DESC)`
- Always filter by card_id first, then order by timestamp
- Never query without card_id filter (full table scan)

**Warning signs:** EXPLAIN ANALYZE shows Seq Scan instead of Index Scan

## Code Examples

Verified patterns from official sources:

### Scryfall Bulk Data Download

```typescript
// Source: https://scryfall.com/docs/api/bulk-data
async function downloadScryfallBulkData() {
  // 1. Fetch bulk data metadata
  const response = await axios.get('https://api.scryfall.com/bulk-data')
  const bulkItems = response.data.data

  // 2. Find "Unique Artwork" or "Default Cards" file
  const uniqueArtwork = bulkItems.find(item => item.type === 'unique_artwork')
  const defaultCards = bulkItems.find(item => item.type === 'default_cards')

  const downloadUri = uniqueArtwork?.download_uri || defaultCards?.download_uri
  if (!downloadUri) throw new Error('No suitable bulk data file found')

  // 3. Download and parse
  const { data } = await axios.get(downloadUri, { responseType: 'arraybuffer' })
  const gunzip = zlib.createGunzip()
  const jsonString = await gunzipPromise(data, gunzip)

  const cards = JSON.parse(jsonString)

  // 4. Upsert to database
  await upsertCards(cards)
}
```

### Circuit Breaker with Fallback

```typescript
// Source: https://www.npmjs.com/package/opossum
import CircuitBreaker from 'opossum'

const breaker = new CircuitBreaker(fetchTCGPlayerPrice, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000
})

// Fallback returns cached price or null
breaker.fallback(async (cardId: string) => {
  const cached = await getCachedPrice(cardId, 'tcgplayer')
  if (cached) {
    logger.warn(`TCGPlayer unavailable, using cached price for ${cardId}`)
    return cached
  }
  logger.warn(`TCGPlayer unavailable, no cache for ${cardId}`)
  return null
})
```

### Playwright Scraping with Anti-Detection

```typescript
// Source: https://playwright.dev/docs/emulation
import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']  // Reduce bot detection
})

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 }
})

const page = await context.newPage()

// Wait for network idle to ensure dynamic content loaded
await page.goto('https://example.com/card/123', {
  waitUntil: 'networkidle'
})

const price = await page.$eval('.price', el => el.textContent)
await browser.close()
```

### Currency Conversion with IOF

```typescript
// Source: REQUIREMENTS.md PRICE-05 (6.38% IOF)
const IOF_RATE = 0.0638

async function convertToBRL(
  price: number,
  fromCurrency: 'USD' | 'EUR',
  exchangeRate: number
): Promise<number> {
  // exchangeRate is BRL per USD or BRL per EUR
  const converted = price * exchangeRate
  const withIOF = converted * (1 + IOF_RATE)
  return Math.round(withIOF * 100) / 100  // Round to 2 decimals
}
```

### Smart Refresh Check

```typescript
// Source: CONTEXT.md "Smart refresh: Only fetch if >8 hours since last successful fetch"
import { differenceInHours } from 'date-fns'

async function shouldFetchPrice(cardId: string, source: string): Promise<boolean> {
  const lastPrice = await db.query.prices.findFirst({
    where: and(
      eq(prices.cardId, cardId),
      eq(prices.source, source)
    ),
    orderBy: [desc(prices.timestamp)],
    columns: { timestamp: true }
  })

  if (!lastPrice) return true  // Never fetched

  const hoursSinceLastFetch = differenceInHours(new Date(), lastPrice.timestamp)
  return hoursSinceLastFetch > 8
}
```

### Rate Limit Preset Extension

```typescript
// Source: Existing code in src/lib/ratelimit/rate-limiter.ts
export const RATE_LIMITS = {
  SCRYFALL: { limit: 10, interval: 1 },      // 10 req/sec
  TELEGRAM: { limit: 100, interval: 60 },    // 100 req/min
  TCGPLAYER: { limit: 50, interval: 60 },    // 50 req/min (documented)

  // NEW: Add during Phase 2 implementation
  CARDMARKET: { limit: 40, interval: 60 },   // 50 req/min → 80% = 40
  CARDKINGDOM: { limit: 40, interval: 60 },  // TBD → conservative 40
  LIGAMAGIC: { limit: 30, interval: 60 },    // Unknown → conservative 30
} as const
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer only | Playwright preferred | 2023-2024 | Multi-browser support, better auto-waiting, 2026-recommended |
| Custom circuit breakers | Opossum library | 2019-2020 | Standardized pattern, battle-tested, TypeScript support |
| Real-time polling | Scheduled 2-3x daily | Per REQUIREMENTS.md | Reduced API usage, NOTIF-03 compliance |
| In-memory rate limiting | Redis-backed token bucket | Phase 1 | Distributed-safe, atomic operations, horizontal scaling |
| Cheerio only | Hybrid cheerio + Playwright | 2022-2024 | Fast parsing for simple pages, browser automation for complex sites |

**Deprecated/outdated:**
- **Request (npm package):** Use axios instead - request is deprecated, unmaintained since 2020
- **Selenium WebDriver:** Use Playwright instead - Selenium is slower, harder to set up, worse API
- **Hystrix-js:** Use Opossum instead - Hystrix is unmaintained, last update 2018
- **Scryfall bulk data prices:** Use live APIs instead - prices are "dangerously stale after 24 hours" per Scryfall docs

## Open Questions

### 1. Liga Magic API Existence

**What we know:**
- No documented public API found in initial research
- CONTEXT.md assumes "no documented public API"
- May require web scraping only

**What's unclear:**
- Does Liga Magic have undocumented API used by their site?
- What are their robots.txt policies?
- Are there ToS provisions against scraping?

**Recommendation:**
- Phase 2 planning should include manual inspection of ligamagic.com.br
- Check robots.txt: `https://ligamagic.com.br/robots.txt`
- Inspect network traffic in browser DevTools for API endpoints
- Start with conservative scraping (1 req/sec), respect robots.txt

### 2. TCGPlayer API Authentication Process

**What we know:**
- API exists at api.tcgplayer.com
- Requires application process to get credentials (Public Key, Private Key)
- Rate limit documented as 50 req/min

**What's unclear:**
- What is the current application process in 2026?
- How long does approval take?
- Are there usage tiers or free tier limits?

**Recommendation:**
- Apply for TCGPlayer API access early in Phase 2
- Implement scraping fallback in parallel (don't wait for API approval)
- Plan for both API-first and scraping-only approaches

### 3. CardMarket API Rate Limits

**What we know:**
- CardMarket has an API (MKM API)
- Web search tool was rate-limited, couldn't fetch specific docs

**What's unclear:**
- What are the documented rate limits?
- Authentication method (API key, OAuth)?
- Is there a free tier for hobbyist use?

**Recommendation:**
- Fetch official docs directly: https://www.cardmarket.com/en/Services/API
- Start with conservative 40 req/min (80% buffer assumption)
- Adjust during implementation based on actual limits

### 4. CardKingdom API Availability

**What we know:**
- Search results suggest no public API documentation
- May require scraping only

**What's unclear:**
- Does CardKingdom have an affiliate API or partner program?
- What are their robots.txt policies?
- Site complexity (simple HTML vs heavy JavaScript)?

**Recommendation:**
- Manual inspection of cardkingdom.com during Phase 2
- Check for affiliate/partner programs
- Assess scraping complexity (cheerio vs Playwright)

### 5. Exchange Rate API Selection

**What we know:**
- Brazilian Central Bank provides official exchange rates
- Commercial APIs available (AllTick, ExchangeRate-API, Fixer.io)
- REQUIREMENTS.md specifies 6.38% IOF for credit card purchases

**What's unclear:**
- Which API has best reliability for BRL/USD and BRL/EUR?
- Update frequency (real-time vs daily)?
- Free tier limits vs paid plans?

**Recommendation:**
- Try Brazilian Central Bank API first (free, official)
- Fallback to commercial API if BCB API is unreliable
- Cache exchange rates for 1-4 hours (currency doesn't change that fast)

### 6. Scryfall New Set Detection Method

**What we know:**
- Scryfall has RSS/blog feed
- API endpoint `/sets` lists all sets
- New sets release ~4x/year

**What's unclear:**
- Should we poll RSS feed daily or weekly?
- Is there a webhook/notification system?
- How to identify "Standard-legal" sets automatically?

**Recommendation:**
- Start with weekly polling of `/sets` API endpoint
- Check for `set_type: "core"` or `set_type: "expansion"` for Standard-legal
- Implement manual trigger for new set imports (low frequency)

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.9 (already configured) |
| Config file | vitest.config.ts (needs creation) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRICE-01 | Fetch prices from Liga Magic | integration | `npm run test:run -- src/scraper/sources/ligamagic/__tests__/ligamagic.test.ts` | ❌ Wave 0 |
| PRICE-02 | Fetch prices from TCGPlayer | integration | `npm run test:run -- src/scraper/sources/tcgplayer/__tests__/tcgplayer.test.ts` | ❌ Wave 0 |
| PRICE-03 | Fetch prices from CardMarket | integration | `npm run test:run -- src/scraper/sources/cardmarket/__tests__/cardmarket.test.ts` | ❌ Wave 0 |
| PRICE-04 | Fetch prices from CardKingdom | integration | `npm run test:run -- src/scraper/sources/cardkingdom/__tests__/cardkingdom.test.ts` | ❌ Wave 0 |
| PRICE-05 | Convert USD/EUR to BRL with IOF | unit | `npm run test:run -- src/scraper/__tests__/currency.test.ts` | ❌ Wave 0 |
| PRICE-07 | Schedule 2-3x daily price checks | integration | `npm run test:run -- src/scheduler/__tests__/jobs.test.ts` | ❌ Wave 0 |
| PRICE-08 | Store price history in TimescaleDB | integration | `npm run test:run -- src/db/__tests__/prices.test.ts` | ✅ Phase 1 |
| NOTIF-03 | Respect 2-3x daily frequency (not real-time) | unit | `npm run test:run -- src/scraper/__tests__/smart-refresh.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:run` (quick unit tests, <30 seconds)
- **Per wave merge:** `npm run test:coverage` (full suite with coverage)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest configuration file (missing, needs creation)
- [ ] `src/scraper/sources/ligamagic/__tests__/ligamagic.test.ts` — Liga Magic scraper tests
- [ ] `src/scraper/sources/tcgplayer/__tests__/tcgplayer.test.ts` — TCGPlayer fetcher tests
- [ ] `src/scraper/sources/cardmarket/__tests__/cardmarket.test.ts` — CardMarket fetcher tests
- [ ] `src/scraper/sources/cardkingdom/__tests__/cardkingdom.test.ts` — CardKingdom fetcher tests
- [ ] `src/scraper/__tests__/currency.test.ts` — Currency conversion tests
- [ ] `src/scraper/__tests__/circuit-breaker.test.ts` — Circuit breaker behavior tests
- [ ] `src/scraper/__tests__/smart-refresh.test.ts` — Smart refresh logic tests
- [ ] `src/scheduler/__tests__/jobs.test.ts` — Cron job scheduling tests
- [ ] `test/mocks/axios.ts` — Axios mock for API tests
- [ ] `test/mocks/playwright.ts` — Playwright mock for scraper tests
- [ ] Framework install: `npm install -D @playwright/test vitest` — Vitest already installed, Playwright test utils needed

**Note:** `src/db/__tests__/prices.test.ts` exists from Phase 1 (PRICE-08 partial coverage). Extend with price insertion queries.

## Sources

### Primary (HIGH confidence)

- **Scryfall Bulk Data API** - https://scryfall.com/docs/api/bulk-data
  - Fetched via webReader on 2026-03-05
  - Official documentation for bulk data formats, download URIs, update frequency
  - 5 file types: Oracle Cards (149MB), Unique Artwork (209MB), Default Cards (465MB), All Cards (2.17GB), Rulings (22.7MB)
  - **Critical note:** "prices should be considered dangerously stale after 24 hours" - do not use bulk data prices

- **Opossum Circuit Breaker** - https://www.npmjs.com/package/opossum
  - Node.js standard library for circuit breaker pattern
  - Configuration options: timeout, errorThresholdPercentage, resetTimeout, rollingCountTimeout
  - Event system: open, halfOpen, close, fallback, success, failure, timeout
  - Fallback function support for graceful degradation

- **Existing Codebase** - /Users/luizpansarini/Documents/Projetos/mtgprice
  - `src/lib/ratelimit/rate-limiter.ts` - Redis-backed token bucket implementation
  - `src/db/schema/cards.ts` - Cards table schema with oracleId
  - `src/db/schema/prices.ts` - Prices table schema with hypertable
  - `package.json` - Confirms node-cron 3.0.3, ioredis 5.5.0, winston 3.17.0, vitest 3.0.9

### Secondary (MEDIUM confidence)

- **Puppeteer vs Playwright Comparison** - 2025-2026 benchmark articles
  - Source: https://m.blog.csdn.net/Data_Journal/article/details/156028592 (Chinese tech blog)
  - Playwright performs faster (4.5s vs 4.8s), multi-browser support, better auto-waiting
  - Playwright gaining traction in 2026, recommended for new projects

- **Circuit Breaker Implementation Guide** - 2026 architecture articles
  - Source: https://m.blog.csdn.net/gitblog_00062/article/details/137736019 (CSDN)
  - Opossum highlighted as best choice for Node.js
  - Configuration recommendations: 50% error threshold, 30-60 second reset timeout
  - Three-state machine: CLOSED, OPEN, HALF-OPEN

- **Exchange Rate APIs** - 2026 forex API selection
  - Source: https://www.cnblogs.com/mm12/p/19365541 (Chinese tech blog, December 2025)
  - AllTick API recommended for 2026 (100ms updates, 10 years historical data)
  - Brazilian Central Bank official API mentioned as alternative

- **Brazilian Web Scraping Legality** - Legal considerations
  - Source: General knowledge of Brazilian law (LGPD, civil code)
  - No specific web scraping law in Brazil
  - robots.txt not legally binding but considered as evidence
  - LGPD applies to personal data scraping

### Tertiary (LOW confidence)

- **TCGPlayer API** - https://developer.tcgplayer.com (URL not reachable due to rate limit)
  - WebSearch results indicate API exists, requires application for credentials
  - Rate limit: 50 req/min (documented, needs verification)
  - Authentication: Public Key + Private Key
  - **Flag for validation:** Need to fetch official docs during Phase 2 planning

- **CardMarket API** - https://www.cardmarket.com/en/Services/API (webReader rate-limited)
  - Search results indicate API exists (MKM API)
  - Rate limits unknown (assumed 50 req/min for conservative planning)
  - **Flag for validation:** Fetch official docs during Phase 2 planning

- **CardKingdom API** - https://www.cardkingdom.com (webReader rate-limited)
  - Search results suggest no public API
  - Likely scraping-only source
  - **Flag for validation:** Manual inspection during Phase 2 planning

- **Liga Magic** - https://ligamagic.com.br (webReader rate-limited)
  - No documented public API found
  - **Flag for validation:** Check robots.txt, inspect network traffic, assess scraping feasibility

- **Brazilian Central Bank API** - https://www.bcb.gov.br/en/monetarypolicy/exchangerates (webReader rate-limited)
  - Official exchange rate source mentioned in search results
  - **Flag for validation:** Fetch docs during Phase 2 planning

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Playwright/Opossum/axios confirmed via web search, but source-specific APIs need validation
- Architecture: MEDIUM - Circuit breaker and smart refresh patterns well-documented, but source-specific implementations unknown
- Pitfalls: HIGH - Common scraping pitfalls well-known, database performance issues identified in Phase 1

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days - API documentation may change, scraping patterns stable)

**Key limitations:**
- WebReader tool rate-limited during research, couldn't fetch official API docs for TCGPlayer/CardMarket/CardKingdom/Liga Magic
- WebSearch tool rate-limited, relied on secondary sources
- Source-specific API authentication and rate limits need verification during Phase 2 planning
- Brazilian Central Bank API documentation needs direct inspection

**Next steps for Phase 2 planning:**
1. Manual inspection of TCGPlayer developer portal
2. Fetch CardMarket API documentation
3. Inspect CardKingdom and Liga Magic sites for API endpoints
4. Verify Brazilian Central Bank API endpoints
5. Create vitest.config.ts for test framework setup
6. Implement Wave 0 test files before writing scraper code
