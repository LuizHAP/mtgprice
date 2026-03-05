# Phase 2: Core Data Collection - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-source price collection system that automatically fetches prices from Brazilian (Liga Magic) and international sources (TCGPlayer, CardMarket, CardKingdom) with currency conversion (USD/EUR → BRL with 6.38% IOF), stores historical data in TimescaleDB hypertables, and runs on a scheduled basis (2-3x daily). This phase delivers the data layer that all downstream features (dashboard, notifications, opportunity detection) depend on.

</domain>

<decisions>
## API vs Scraping Strategy

### Primary Approach: Hybrid (API-first, scraping fallback)
- Try official APIs first for all 4 sources
- Fall back to web scraping (cheerio/Puppeteer) if:
  - No official API exists
  - API is limited or incomplete
  - API fails and scraping is non-critical
- Balances reliability (APIs) with independence (scraping fallback)

### Source-Specific Strategy
- **Liga Magic:** Try API first → fallback to scraping (no documented public API)
- **TCGPlayer:** Hybrid - use official API (requires key), scraping fallback if API fails
- **CardMarket:** Same hybrid approach - try API first, then scrape
- **CardKingdom:** Same hybrid approach - try API first, then scrape

### Error Handling: Circuit Breaker Pattern
- Track failure rate per source
- If source fails >50% of requests in a collection run → stop that source
- Continue with other sources (one bad source doesn't block all)
- Retry stopped source in next scheduled run (2-3x daily)
- Individual card failures: log and skip, don't block entire source
- Prevents bad data/cascading failures while maximizing data collected

### Rate Limiting: Conservative Approach
- Use existing Redis-backed token bucket rate limiter (from Phase 1)
- Set limits at 80% of documented API limits (safety buffer)
- Example: TCGPlayer documented as 50 req/min → use 40 req/min
- Add rate limit presets for CardMarket, CardKingdom as limits are discovered
- Small buffer prevents clock drift issues and simultaneous request spikes

### Fetch Strategy: Smart Refresh with Source Priority
- **Refresh frequency:** Only fetch if >8 hours since last successful fetch per card/source
- Tracks state to avoid wasted API calls on unchanged prices
- **Fetch order:**
  1. Liga Magic (BR prices are critical) - fetch first
  2. TCGPlayer, CardMarket, CardKingdom - fetch in parallel after Liga Magic
- Balances priority (BR data available sooner) with efficiency (parallel intl sources)

### Currency Conversion
- USD/EUR → BRL conversion with 6.38% IOF (credit card)
- Exchange rate API: TBD during research (likely Brazilian Central Bank or commercial service)
- Conversion applied during price collection before storing in database
- All prices stored as BRL in `prices` table (price_brl column)

## Card Discovery & Metadata

### Card Source: Scryfall Bulk Data
- Download Scryfall bulk data JSON file:
  - "Unique Card Artwork" or "Default Cards" dataset
  - Contains all cards, oracle_ids, set information, image URLs
- Bootstrap database with bulk data import
- Re-sync bulk data periodically (see refresh frequency below)

### Initial Scope: Manual Seed
- Phase 2: Manually seed 100-500 cards of interest for testing
- Small, focused dataset to verify collection works
- Phase 5 will handle auto-discovery from metagame sources
- Avoids monitoring thousands of irrelevant cards initially

### Metadata Refresh: 30-Day Cycle
- Refresh card metadata from Scryfall if >30 days old
- Keeps names, images, set info, rarity current
- Caches in database to minimize Scryfall API calls
- Balances freshness with API usage

### Sync Strategy: Upsert All
- Use SQL upsert (ON CONFLICT DO UPDATE) when syncing bulk data
- Inserts new cards, updates existing cards' metadata
- Idempotent operation - can run multiple times safely
- Ensures database stays current with Scryfall data

### New Set Detection: Auto-Detect from Scryfall
- Monitor Scryfall RSS feed or API for new set announcements
- Automatically add new Standard-legal cards when set releases
- Hands-off approach - always current without manual intervention
- New sets release ~4x/year, adding hundreds of cards

### Image Handling: Hotlink Scryfall URLs
- Store Scryfall image URLs in database (cards.image_url column)
- Display images directly from Scryfall CDN
- Zero storage cost, no bandwidth/hosting overhead
- Depends on Scryfall availability (acceptable trade-off for v1)
- If Scryfall becomes unreliable, switch to local hosting in v2

### Claude's Discretion
- Exact exchange rate API selection (Banco Central vs commercial)
- New set polling frequency (daily vs weekly)
- Bulk data re-sync cadence (beyond 30-day metadata refresh)
- Card deduplication logic within bulk data import
- Error logging granularity and alerting thresholds

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Rate limiter:** `src/lib/ratelimit/rate-limiter.ts` - Redis-backed token bucket with TCGPlayer preset (50 req/min), will add CardMarket/CardKingdom presets
- **Redis client:** `src/lib/ratelimit/redis.ts` - Singleton connection with error handling, can reuse for rate limiting new sources
- **Database schema:** `src/db/schema/` - `cards` and `prices` tables ready, use oracle_id for card identification
- **Telegram bot:** `src/bot/` - Infrastructure exists (Phase 4 will use for notifications, not Phase 2)

### Established Patterns
- **Rate limiting pattern:** Preset-based (SCRYFALL, TELEGRAM, TCGPLAYER) - add CARDMARKET, CARDKINGDOM, LIGA_MAGIC presets
- **Database pattern:** Drizzle ORM with TypeScript types, composite indexes on (card_id, timestamp DESC)
- **Error handling:** Winston logging (package.json has winston@3.17.0), structured JSON logs
- **Monorepo structure:** `src/scraper/` directory exists for scraping modules

### Integration Points
- **Database:** `src/db/index.ts` - Drizzle client connection, already configured
- **Prices table:** Hypertable with 7-day chunks, optimized for time-series inserts
- **Cards table:** Cache for Scryfall metadata, TTL 24-48h (from Phase 1 CONTEXT.md)
- **Scheduling:** `node-cron` in package.json (v3.0.3) - will use for 2-3x daily jobs
- **Web scraping:** Puppeteer/Playwright decision from Phase 1 ("Puppeteer ou Playwright para browser automation")

### Tech Stack Context
- **Runtime:** Node.js 20+ (from Phase 1)
- **TypeScript:** Strict mode enabled
- **Database:** PostgreSQL 16 + TimescaleDB 2.15 (docker-compose.yml ready)
- **ORM:** Drizzle ORM 0.38.4
- **Redis:** ioredis 5.5.0 for rate limiting
- **HTTP clients:** None yet - will add cheerio/Puppeteer for scraping, axios/ky for API calls
- **Scheduling:** node-cron 3.0.3 (in-process, adequate for initial version)

</code_context>

<specifics>
## Specific Ideas

**Phase 1 carryover decisions affecting Phase 2:**
- Card identification: Scryfall `oracle_id` as unique identifier (aggregates all printings)
- Price storage: One row per source (card_id, source, price_brl, timestamp)
- Web scraping tool: Puppeteer or Playwright (decision not yet finalized, will happen in Phase 2)
- Background jobs: node-cron for scheduling (not Vercel Cron Jobs initially)

**New Phase 2 decisions:**
- Conservative rate limiting (80% of documented limits) - safer long-term, small API overhead
- Circuit breaker pattern for failed sources - prevents cascading failures
- Smart refresh (>8h old) - reduces API calls by ~66% vs fetching all cards every run
- Liga Magic priority (fetch first) - BR data most important for user
- Scryfall bulk data for card discovery - most efficient for initial bootstrap

**Currency conversion requirement:**
- IOF of 6.38% for credit card purchases (from REQUIREMENTS.md PRICE-05)
- Must be applied to all international prices (TCGPlayer, CardMarket, CardKingdom)
- Store converted values in BRL in database (price_brl column)

</specifics>

<deferred>
## Deferred Ideas

**During this discussion:**
- None - discussion stayed within Phase 2 scope

**Noted for future consideration:**
- Local image hosting for card images (v2 if Scryfall hotlinking becomes unreliable)
- Real-time price updates (NOTIF-03 explicitly requires 2-3x daily, not real-time)
- User-defined card lists (Phase 3 wishlist covers this)
- Metagame-based auto-discovery (Phase 5 covers this)
- Multiple currency support (BRL-only for v1 per requirements)
- Historical price data downsampling (Phase 1 CONTEXT.md mentioned 90-day raw → weekly aggregation, not implementing in Phase 2)

</deferred>

---

*Phase: 02-core-data-collection*
*Context gathered: 2026-03-05*
