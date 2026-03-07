---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 3 (Wishlist Management & User Dashboard)
current_plan: 03-04 (Telegram Bot Wishlist Commands)
status: planning
last_updated: "2026-03-07T13:09:51.379Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# MTG Price Monitor - Project State

**Last updated:** 2026-03-06
**Current phase:** Phase 3 (Wishlist Management & User Dashboard)
**Current plan:** 03-04 (Telegram Bot Wishlist Commands)
**Status:** Ready to plan

## Project Reference

**Core Value:** Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

**What we're building:**
Sistema inteligente de monitoramento de preços de cartas de Magic: The Gathering que:
- Monitora automaticamente cartas de múltiplos formatos (Standard, Modern, Pioneer, Legacy, Vintage, Pauper, Commander)
- Busca preços em fontes brasileiras (Liga Magic) e internacionais (TCGPlayer, CardMarket, CardKingdom)
- Converte moeda com IOF de 6.38% (cartão de crédito)
- Notifica oportunidades de compra via Telegram quando detecta tendências favoráveis
- Oferece dashboard web para gerenciamento e visualização

## Current Position

**Phase:** 3 - Wishlist Management & User Dashboard
**Plan:** 03-01 (Wishlist CRUD API Endpoints)
**Status:** Wishlist CRUD API complete, ready for card search API (03-02)

**Progress:**
[██████████] 100%
```

**Phase 1 Completed Plans:**
- 01-00: Planning and research
- 01-01: Project initialization with Next.js, TypeScript, Biome
- 01-02: Database schema with Drizzle ORM and TimescaleDB
- 01-03: Redis-backed token bucket rate limiting
- 01-04: JWT authentication system with bcrypt and Telegram linking
- 01-05: Telegram bot with grammY, chat ID whitelist, and /start authentication

**Phase 2 Completed Plans:**
- 02-00: Test Infrastructure Setup - Vitest configuration and test stubs for all Phase 2 components
- 02-01: Scryfall Card Metadata & Liga Magic Foundation - Bulk data import, card upsert, metadata refresh, Liga Magic scraping
- 02-02: International Price Sources with Circuit Breaker - TCGPlayer, CardMarket, CardKingdom fetchers with Opossum circuit breakers
- 02-03: Currency Conversion & Smart Refresh Logic - IOF calculation, exchange rate fetching, 8-hour smart refresh
- 02-04: Orchestration, Scheduling & Price Storage - Multi-source orchestration, cron jobs, database queries

**Phase 3 Completed Plans:**
- 03-00: Test Infrastructure Setup ✅
- 03-01: Wishlist CRUD API Endpoints ✅
- 03-02: Card Search and Price Comparison API ✅
- 03-03: Web Dashboard Wishlist Management ✅
- 03-04: Telegram Bot Wishlist Commands ✅

**Next:** Phase 4 - Opportunity Detection & Notifications

## Performance Metrics

*Most recent plan (03-04):*
- Duration: ~4 minutes (240 seconds)
- Tasks: 7/7 completed
- Files created: 7 (2 utils, 1 middleware, 4 command handlers)
- Files modified: 1 (bot/index.ts)
- Commits: 7
- Deviations: None - plan executed exactly as written
- Total lines: 808

*Previous plan (03-03):*
- Duration: ~5 minutes (324 seconds)
- Tasks: 7/7 completed (1 checkpoint, 6 implementation)
- Files created: 8 (2 layout, 5 wishlist components, 2 pages)
- Files modified: 1 (layout.tsx)
- Commits: 6
- Deviations: 1 auto-fixed (TypeScript linting error in PriceTable)

*Previous plan (03-02):*
- Duration: ~2 minutes (163 seconds)
- Tasks: 3/3 completed
- Files created: 4 (cards/search, cards/[oracle_id], prices/[oracle_id], queries.ts)
- Files modified: 0
- Commits: 3
- Deviations: 2 auto-fixed (missing queries file, TypeScript linting)

*Previous plan (02-04):*
- Duration: ~10 minutes (600 seconds)
- Tasks: 5/5 completed
- Files created: 4 (prices.ts, orchestrator.ts, jobs.ts, scheduler/index.ts)
- Files modified: 1 (.env.example)
- Commits: 5
- Deviations: None

*Previous plan (02-03):*
- Duration: ~6 minutes (360 seconds)
- Tasks: 5/5 completed
- Files created: 2 (currency.ts, smart-refresh.ts)
- Files modified: 0
- Commits: 6
- Deviations: None

*Previous plan (02-02):*
- Duration: ~5 minutes (290 seconds)
- Tasks: 6/6 completed
- Files created: 5 (circuit-breaker.ts, logger.ts, tcgplayer.ts, cardmarket.ts, cardkingdom.ts)
- Files modified: 4 (package.json, pnpm-lock.yaml, rate-limiter.ts, .gitignore)
- Commits: 7
- Deviations: None

*Previous plan (02-01):*
- Duration: ~5 minutes (290 seconds)
- Tasks: 6/6 completed
- Files created: 11 (2 implementation + 9 test stubs)
- Files modified: 2 (package.json, pnpm-lock.yaml)
- Commits: 5
- Deviations: None

*Previous plan (01-05):*
- Duration: ~15 minutes (~900 seconds)
- Tasks: 5/5 completed (4 implementation + 1 verification checkpoint)
- Files created: 5
- Files modified: 4
- Commits: 6
- Deviations: 4 auto-fixed (2 bugs, 1 blocking, 1 missing critical)

*Previous plan (01-04):*
- Duration: ~10 minutes (622 seconds)
- Tasks: 8/8 completed
- Files created: 8
- Commits: 8

*Previous plan (01-01):*
- Duration: ~4.5 minutes (269 seconds)
- Tasks: 3/3 completed
- Files created: 15
- Commits: 3
- Dependencies installed: 366 packages

*Previous plan (01-02):*
- Duration: ~4 minutes
- Tasks: 3/3 completed
- Files created: 10
- Commits: 3
- Lines of code: ~280

## Accumulated Context

### Key Decisions Made

**During project initialization (2026-03-05):**

1. **Telegram bot vs Discord bot:** Telegram selected — user preference, simpler for notifications
2. **Checagem 2-3x ao dia vs tempo real:** 2-3x daily selected — balances opportunity detection with API limits
3. **Lógica de oportunidade:** queda + abaixo da média — combines recent trend with historical context
4. **Interface web + bot:** Dual interface selected — flexibility for different use cases
5. **Histórico completo:** Full history with charts selected — users want data beyond notifications

**Technology stack (from research):**
- Node.js 20+ — Backend language (changed from Python during Phase 1)
- Next.js 15+ — Web framework with App Router
- TypeScript strict mode — Type safety
- PostgreSQL 16+ + TimescaleDB 2.15+ — Time-series database, 65% lower storage vs InfluxDB
- grammY 1.36+ — Telegram integration, fully async
- Biome 1.x — Linting + formatting (20x faster than ESLint+Prettier)

**During Plan 01-02 (Database schema, 2026-03-05):**

1. **Price storage model:** One row per source (card_id, source, price_brl, timestamp) — enables flexible comparison across 4 sources, handles different update schedules. Trade-off: 4x storage (~17.6M rows/year) but acceptable with TimescaleDB compression.
2. **TimescaleDB hypertable with 7-day chunks:** Automatic time-based partitioning for 10-100x faster queries. Optimal for 2-3x daily checks across 4 sources (~48K rows/day).
3. **Composite index on (card_id, timestamp DESC):** Covers 90% of queries that filter by card and order by time. Index order is critical: PostgreSQL reads left-to-right, so card_id must come first.

**During Plan 01-04 (JWT Authentication, 2026-03-05):**

1. **JWT Secret in Test Setup:** Added JWT_SECRET environment variable to test/setup.ts to enable JWT testing in development environment.
2. **HttpOnly Cookie Configuration:** Set sameSite: 'lax' for better compatibility while maintaining security against XSS attacks.
3. **Middleware Extension:** Extended Plan 01-03 middleware to combine rate limiting and auth protection in a single file.

**During Plan 01-05 (Telegram Bot, 2026-03-05):**

1. **Chat ID Whitelist Security:** Implemented middleware-based chat ID whitelist for single-user security per CONTEXT.md decision (lines 73-77). Only whitelisted user can interact with bot.
2. **Password-Based Bot Authentication:** Created compareBotPassword function for /start command, reusing bcrypt from auth utilities for consistency.
3. **Docker Compose Infrastructure:** Created docker-compose.yml with TimescaleDB image for easy local development setup (PostgreSQL 16 + TimescaleDB 2.15).
4. **Polling Mode for Development:** Bot uses long polling (bot.start()) for development. Webhooks will be configured for production deployment.
5. **Command Registration in Bot Menu:** Used bot.api.setMyCommands to register /start, /price, /history in Telegram's command menu for better UX.

**During Plan 01-01 (Project initialization, 2026-03-05):**

1. **Package manager:** pnpm selected — faster, more disk-efficient, native monorepo support
2. **Code quality:** Biome selected — single tool for linting + formatting, 20x faster than ESLint+Prettier
3. **Git workflow:** Husky + lint-staged — automatic formatting on commit
4. **Monorepo structure:** Domain-based directories (api, bot, scraper, db, lib, types, web) — clear separation of concerns

### Known Constraints

1. **Cotação de câmbio:** Deve considerar IOF de cartão de crédito (6.38%) nas conversões dólar/euro → real
2. **Rate limiting:** APIs externas têm limites de requisição (Scryfall: 10 req/sec, Telegram: 100 req/60sec)
3. **Web scraping:** Algumas fontes podem não ter API pública, precisando de scraping
4. **Performance:** Sistema deve checar milhares de cartas 2-3x ao dia de forma eficiente
5. **Armazenamento:** Histórico de preços de milhares de cartas ao longo do tempo (4.4M rows/year expected)

### Critical Pitfalls to Avoid

1. **API Rate Limiting** — Scryfall bans IPs for excessive requests. Implement 50-100ms delays, use bulk data, cache 24h.
2. **Alert Fatigue** — 40% of users abandon apps after poor notification experience. Batch alerts, require multiple conditions.
3. **Legal/ToS Violations** — Scraping without permission can lead to cease & desist. Check robots.txt AND ToS.
4. **Wrong Card Version** — MTG has same card across dozens of sets with wildly different values. Use unique identifiers.
5. **Currency Conversion Without IOF** — International prices appear 6.38% too cheap without IOF tax.
6. **Time Series Bloat** — Use TimescaleDB partitioning, implement retention policies.
7. **Telegram Rate Limits** — 100 requests/60 seconds means batch sends fail during price drops.

### Research Gaps to Address

**Liga Magic integration approach:**
- Unknown if Liga Magic has official API or requires scraping only
- Handling: Phase 2 planning should include verification of robots.txt, ToS, and API access

**Opportunity detection algorithm thresholds:**
- Unknown optimal thresholds for "below historical average" detection
- Handling: Start with conservative defaults (15% drop + below 30-day average), plan for A/B testing

**Metagame data availability (Phase 5):**
- Unknown if MTGTop8/EDHREC have APIs or require scraping
- Handling: Phase 5 planning should include verification of metagame sources

**IOF calculation accuracy:**
- Need to verify 6.38% IOF is still current rate in 2026
- Handling: Verify with Brazilian Central Bank before Phase 1

### Active Todos

*None yet — project hasn't started*

### Blockers

*None currently*

## Session Continuity

### Last Work Completed

**2026-03-05 (Plan 01-01):** Project initialization with Next.js, TypeScript, Biome, and monorepo structure
- Created package.json with all dependencies (Next.js 15.5.12, React 19.2.4, Drizzle, grammY, ioredis, Winston)
- Configured TypeScript 5.9.3 with strict mode and path aliases (@/*)
- Created Next.js configuration ready for middleware/CORS
- Created .gitignore and .env.example with environment variable templates
- Installed 366 packages via pnpm
- Set up Biome 1.9.4 for linting + formatting (replaces ESLint + Prettier)
- Initialized Husky 9.1.7 with pre-commit hook running lint-staged
- Applied Biome formatting to all existing files (31 files, 0 errors)
- Created monorepo directory structure: src/api, src/bot, src/scraper, src/db, src/lib, src/types, src/web
- Added placeholder files in all directories to prevent "module not found" errors
- Created src/lib/placeholder.ts documenting planned utilities (logger, auth, rate-limiter, telegram, currency, validation, errors)
- Commits: a3a50c3 (init), 577a38c (biome/husky), 3430f9f (structure)

**2026-03-05 (Plan 01-02):** Database schema with TimescaleDB hypertables
- Created Drizzle ORM schema definitions for users, cards, prices, wishlists tables
- Set up database connection client and Drizzle Kit configuration
- Created TimescaleDB hypertable migration SQL (7-day chunks for time-series optimization)
- Created composite index on (card_id, timestamp DESC) for 90% query coverage
- Added migration guide (drizzle/README.md) with step-by-step instructions
- Commits: d5cd5ed (schema), 86ec42a (connection), fbd3b24 (hypertable)

**2026-03-05 (Plan 01-03):** Redis-backed token bucket rate limiting with Next.js middleware
- Implemented token bucket rate limiting algorithm with Redis Lua scripts for atomic operations
- Created Redis client singleton with connection management and error handling
- Added rate limit presets for Scryfall (10 req/sec), Telegram (100 req/min), TCGplayer (50 req/min)
- Built Next.js middleware applying rate limiting to /api/external/* routes with IP-based identification
- Created MockRedis class supporting eval, hmget, hmset, expire, and time commands for testing
- Commits: 845e351 (test), c5e5843 (feat), 41d6697 (feat)
- Known issue: Test mocking not working correctly - needs integration tests with real Redis for full test coverage

**2026-03-05 (Plan 01-04):** JWT-based authentication system with bcrypt and Telegram linking
- Created TypeScript type definitions for authentication (User, LoginInput, JwtPayload, etc.)
- Implemented auth utilities with bcrypt password hashing (10 salt rounds) and JWT signing/verification
- Built comprehensive test suite using TDD approach (RED → GREEN) with 10 passing tests
- Created login endpoint (/api/auth/login) with httpOnly cookie session management
- Created logout endpoint (/api/auth/logout) for session destruction (AUTH-02 complete)
- Created token verification endpoint (/api/auth/verify) for authentication status checks
- Created Telegram linking endpoint (/api/auth/link-telegram) for account linking (AUTH-01 complete)
- Extended Next.js middleware to combine rate limiting (Plan 01-03) and auth protection (this plan)
- Commits: a07f923 (types), 1b64cce (test-red), 9d431ec (feat-green), 5aa856a (login), d54c9c5 (logout), 605e47f (verify), b01a0a9 (telegram), 61b920f (middleware)

**2026-03-05 (Plan 01-05):** Telegram bot with grammY, chat ID whitelist, and password authentication
- Created grammY bot instance with error handling in src/lib/telegram.ts
- Implemented chat ID whitelist middleware blocking unauthorized users
- Created /start command handler with password verification using compareBotPassword
- Added compareBotPassword function to src/lib/auth.ts for bot authentication
- Set up bot startup with command registration in Telegram menu (/start, /price, /history)
- Created docker-compose.yml for PostgreSQL 16 + TimescaleDB 2.15 local development
- Fixed dotenv configuration for environment variable loading
- Fixed Drizzle ORM import errors in drizzle.config.ts
- Bot tested and verified working: MTG Price Alert bot (@mtg_price_alert_bot)
- AUTH-01 requirement complete (users can link Telegram account via bot)
- Commits: 52b9629 (bot startup), bedba89 (compareBotPassword), 2b14012 (dotenv + drizzle fixes), f7b703e (summary)

### Next Steps

**Phase 1 Complete!** All 6 plans finished (01-00 through 01-05).

**Immediate (Phase 2 Planning):**
1. Plan Phase 2: Core Data Collection from multiple sources
2. Implement price scrapers for Liga Magic, TCGPlayer, CardMarket, CardKingdom
3. Add currency conversion with IOF calculation (6.38% for credit card)
4. Set up scheduled jobs for 2-3x daily price checks
5. Store price history in TimescaleDB hypertables

**Infrastructure ready:**
- PostgreSQL 16 + TimescaleDB 2.15 (docker-compose.yml created)
- Database schema with hypertables and indexes
- Rate limiting infrastructure (Redis-backed)
- JWT authentication system
- Telegram bot with chat ID whitelist

### Context for Next Session

**Current status:** Phase 1 complete. All infrastructure ready for Phase 2 data collection.

**Key files created:**
- `package.json, tsconfig.json, next.config.js` - Next.js project configuration
- `biome.json` - Biome linting + formatting configuration
- `.husky/pre-commit` - Git hook for automatic formatting
- `src/*/index.ts` - Monorepo directory structure with placeholders
- `src/db/schema/*.ts` - Drizzle schema definitions
- `src/db/index.ts` - Database client connection
- `drizzle.config.ts` - Drizzle Kit configuration
- `drizzle/*.sql` - TimescaleDB migration scripts
- `src/lib/ratelimit/rate-limiter.ts` - Token bucket rate limiting with Lua scripts
- `src/lib/ratelimit/redis.ts` - Redis client singleton
- `src/lib/auth.ts` - JWT signing/verification and bcrypt password hashing
- `src/lib/telegram.ts` - grammY bot instance
- `src/bot/index.ts` - Bot entry point and command registration
- `src/bot/commands/start.ts` - /start command with password authentication
- `src/bot/middleware/whitelist.ts` - Chat ID whitelist security
- `src/types/auth.ts` - Authentication type definitions
- `src/app/api/auth/login/route.ts` - Login endpoint with httpOnly cookies
- `src/app/api/auth/logout/route.ts` - Logout endpoint (AUTH-02 complete)
- `src/app/api/auth/verify/route.ts` - Token verification endpoint
- `src/app/api/auth/link-telegram/route.ts` - Telegram account linking (AUTH-01 complete)
- `middleware.ts` - Next.js middleware with rate limiting + auth protection
- `test/mocks/redis.ts` - MockRedis class for testing
- `test/setup.ts` - Test setup with JWT_SECRET environment variable
- `docker-compose.yml` - PostgreSQL + TimescaleDB Docker configuration

**Before Phase 2:**
- All infrastructure ready for data collection
- Database schema optimized for time-series price data
- Rate limiting in place for external API calls
- Authentication system complete
- Telegram bot functional and tested

---
*State initialized: 2026-03-05*
*Last updated: 2026-03-05T22:28:19Z*
