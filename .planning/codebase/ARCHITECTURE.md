# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Multi-tier Next.js monolith with async scheduler and decoupled bot consumer

**Key Characteristics:**
- Server-side rendering (Next.js 15) for web dashboard
- REST API routes for wishlist, auth, card search, price endpoints
- Background scheduler (node-cron) for 2-3x daily price collection
- Telegram bot consumer (Grammy) with command handlers
- Time-series price storage (PostgreSQL) with TimescaleDB support
- Circuit breaker pattern for scraper fault tolerance (Opossum)
- Rate limiting per provider (Redis + token bucket algorithm)
- JWT-based auth with httpOnly cookies (session-less)

## Layers

**Presentation Layer:**
- Purpose: Next.js pages and React components
- Location: `src/app/` (pages), `src/components/` (reusable UI)
- Contains: Pages (page.tsx), layouts, UI component library (shadcn)
- Depends on: Authentication lib, Wishlist queries
- Used by: User browser clients

**API Layer:**
- Purpose: REST endpoints for auth, cards, prices, wishlist
- Location: `src/app/api/`
- Contains: Route handlers (login, verify, add/remove wishlist, search cards, get prices)
- Depends on: Database queries, Auth validation, Logger
- Used by: Telegram bot, frontend, external callers

**Telegram Bot Layer:**
- Purpose: Command-driven interface for users (Telegram messaging)
- Location: `src/bot/`
- Contains: Commands (add, remove, list, price, start), middleware (rate limit, whitelist)
- Depends on: Wishlist queries, Price queries, API layer
- Used by: Telegram users

**Scraper/Collection Layer:**
- Purpose: Multi-source price collection orchestration
- Location: `src/scraper/`
- Contains: Providers (Liga Magic, TCGPlayer, CardMarket, CardKingdom, Scryfall), orchestrator, smart refresh, circuit breaker
- Depends on: Axios HTTP, Currency conversion, Database inserts, Rate limiter
- Used by: Scheduler, API endpoints

**Scheduler/Background Layer:**
- Purpose: Periodic price collection job execution
- Location: `src/scheduler/`
- Contains: Cron job definitions (morning, afternoon, evening), execution orchestration
- Depends on: Scraper orchestrator, Database queries, Logger
- Used by: Application startup (scheduled tasks)

**Data Access Layer:**
- Purpose: Database query builders and ORM operations
- Location: `src/db/`, `src/lib/wishlist/queries.ts`
- Contains: Drizzle ORM schema, query helpers, price history functions
- Depends on: Drizzle ORM, PostgreSQL client
- Used by: All layers above

**Authentication Layer:**
- Purpose: JWT token generation, validation, password hashing
- Location: `src/lib/auth/`, `src/lib/auth-server.ts`
- Contains: Password hashing (bcryptjs), JWT operations (jsonwebtoken), server-side verification
- Depends on: jsonwebtoken, bcryptjs
- Used by: API auth endpoints, server components

**Infrastructure Layer:**
- Purpose: Cross-cutting concerns (logging, rate limiting, currency conversion)
- Location: `src/lib/` (logger.ts, ratelimit/, currency.ts)
- Contains: Winston logger, Redis rate limiter, Brazilian Central Bank currency API
- Depends on: Winston, ioredis, axios
- Used by: All layers

## Data Flow

**User Authentication Flow:**
1. User calls POST `/api/auth/login` with email, password
2. API layer queries users table, compares password hash
3. JWT token generated, set as httpOnly cookie
4. User authenticated for subsequent requests via `getServerUser()` in `src/lib/auth-server.ts`

**Price Collection Flow (Scheduled):**
1. Scheduler triggers via node-cron (9AM, 3PM, 9PM Brazil time)
2. `executePriceCollection()` in `src/scheduler/jobs.ts` queries all card oracle_ids
3. Orchestrator (`src/scraper/orchestrator.ts`) calls each provider sequentially/parallel:
   - Phase 1: Liga Magic (sequential, BRL direct)
   - Phase 2: TCGPlayer, CardMarket, CardKingdom (parallel, USD/EUR converted to BRL)
4. Smart refresh checks if card price is fresh (skip if < 1 hour old)
5. Circuit breaker (Opossum) protects against cascading failures
6. Rate limiter enforces per-provider request limits
7. Currency conversion applies IOF tax (6.38%) to foreign prices
8. Prices inserted into TimescaleDB prices table (card_id, source, price_brl, timestamp)

**Wishlist Query Flow:**
1. User calls GET `/api/wishlist`
2. `getServerUser()` verifies JWT cookie
3. `getUserWishlist()` queries wishlists table for user's cards
4. For each card:
   - `getLatestPricesForCard()` queries latest price from each of 4 sources
   - `calculatePriceTrend()` compares to 7-day history
   - `getBestPrice()` returns lowest price across sources
5. Returns enriched wishlist with prices, trends, best price

**Telegram Bot Flow:**
1. Telegram sends message to bot
2. Grammy parses command (add, remove, list, price)
3. Whitelist middleware checks TELEGRAM_CHAT_ID
4. Rate limit middleware enforces per-user request limits
5. Command handler executes (e.g., add card to wishlist)
6. Bot responds via Grammy API

**State Management:**
- User state: PostgreSQL users table (email, password_hash, telegram_chat_id)
- Card state: PostgreSQL cards table (metadata, last_fetched)
- Price state: PostgreSQL prices table (time-series, indexed by card_id + timestamp)
- Wishlist state: PostgreSQL wishlists table (user_id, card_id, unique constraint)
- Session state: JWT httpOnly cookie (stateless, verified server-side)
- Rate limit state: Redis (optional, token bucket per user/source)

## Key Abstractions

**Orchestrator (fetchCardPriceFromAllSources):**
- Purpose: Coordinate multi-source price collection with fallback and retry
- Examples: `src/scraper/orchestrator.ts`
- Pattern: Phase-based fetch (Liga Magic sequential, then international parallel)
- Returns: AllSourcesResult mapping each source to success/failure

**Smart Refresh:**
- Purpose: Skip fetching if price data is fresh
- Examples: `src/scraper/smart-refresh.ts`
- Pattern: Query timestamp index on prices table, skip if < 1 hour old
- Reduces API load and respects rate limits

**Circuit Breaker (Opossum):**
- Purpose: Fault tolerance for scraper failures
- Examples: `src/scraper/circuit-breaker.ts`
- Pattern: Wrap provider calls, fail fast if provider down
- Prevents cascading failures across sources

**Rate Limiter:**
- Purpose: Enforce request limits per provider and per user
- Examples: `src/lib/ratelimit/rate-limiter.ts`
- Pattern: Token bucket algorithm (ioredis or in-memory)
- Per-provider presets: Scryfall (10/sec), Liga Magic, TCGPlayer, CardMarket, CardKingdom

## Entry Points

**Web Dashboard:**
- Location: `src/app/page.tsx`
- Triggers: User visits / (root path)
- Responsibilities: Display homepage, wishlist size, price sources, daily check frequency

**API Routes:**
- Location: `src/app/api/`
- Triggers: HTTP requests to /api/* endpoints
- Responsibilities: Auth (login/logout/verify), cards (search), prices (by oracle_id), wishlist (CRUD)

**Telegram Bot:**
- Location: `src/bot/index.ts`
- Triggers: `npm run bot:dev` (local) or `npm run bot:start` (production)
- Responsibilities: Listen for Telegram messages, dispatch to command handlers

**Scheduler:**
- Location: `src/scheduler/index.ts`
- Triggers: Application startup (imported into main app)
- Responsibilities: Schedule cron jobs, manage job execution, prevent concurrent runs

## Error Handling

**Strategy:** Defensive programming with try-catch, user-facing error responses

**Patterns:**
- API routes: Return 400/401/409/500 with JSON error messages
- Scraper providers: Catch network errors, log and continue (fail gracefully)
- Database queries: Throw Error for critical failures, let caller handle
- Telegram bot: Catch errors, respond with user-friendly messages, don't crash
- Logger: Winston logs to file and console, includes stack traces for errors

## Cross-Cutting Concerns

**Logging:** Winston logger (`src/lib/logger.ts`)
- Configuration: LOG_LEVEL env var, JSON format, file output (error.log, combined.log)
- Used by: Scraper, scheduler, API routes

**Validation:** Zod schema validation (`src/lib/wishlist/validators.ts`)
- Used by: API POST endpoints for request body validation
- Pattern: Validate input, return 400 if fails

**Authentication:** JWT + httpOnly cookies (`src/lib/auth/`, `src/lib/auth-server.ts`)
- Used by: API routes that require user context
- Pattern: getServerUser() throws if unauthenticated, caller returns 401

**Rate Limiting:** Token bucket via Redis or in-memory (`src/lib/ratelimit/`)
- Used by: Scraper providers, Telegram bot rate limit middleware
- Pattern: checkRateLimitPreset() or middleware function

**Currency Conversion:** IOF-adjusted exchange rates (`src/lib/currency.ts`)
- Used by: Orchestrator when converting USD/EUR prices to BRL
- Pattern: applyIOF(amount) and convertToBRL(amount, currency)

---

*Architecture analysis: 2026-04-11*
