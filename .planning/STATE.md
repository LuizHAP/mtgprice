---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 1 (Foundation & Infrastructure)
current_plan: 05 - Implement Telegram bot with grammY
status: executing
last_updated: "2026-03-05T17:55:47.312Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# MTG Price Monitor - Project State

**Last updated:** 2026-03-05
**Current phase:** Phase 1 (Foundation & Infrastructure)
**Current plan:** 05 - Implement Telegram bot with grammY
**Status:** In progress (5/6 plans complete)

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

**Phase:** 1 - Foundation & Infrastructure
**Plan:** 05 - Implement Telegram bot with grammY
**Status:** Plan 01-00, 01-01, 01-02, 01-03, and 01-04 complete, continuing to Plan 05

**Progress:**
[████████░░] 83% complete (5/6 plans)
```

**Current focus:** Implementing Telegram bot with grammY (Plan 05)

## Performance Metrics

*Most recent plan (01-04):*
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

### Next Steps

1. **Immediate (Plan 01-05):** Implement Telegram bot with grammY, chat ID whitelist, and /start authentication
2. **Infrastructure setup:** Install PostgreSQL 16+ with TimescaleDB 2.15+ extension
3. **Database setup:** Configure DATABASE_URL, run migrations, apply hypertable conversion
4. **Redis setup:** Install Redis and configure REDIS_URL environment variable
5. **Phase 2:** Core data collection from multiple sources (Liga Magic, TCGPlayer, CardMarket, CardKingdom)

### Context for Next Session

**Current status:** Project initialization, database schema, rate limiting, and JWT authentication complete. Ready to implement Telegram bot (Plan 01-05).

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
- `src/types/auth.ts` - Authentication type definitions
- `src/app/api/auth/login/route.ts` - Login endpoint with httpOnly cookies
- `src/app/api/auth/logout/route.ts` - Logout endpoint (AUTH-02 complete)
- `src/app/api/auth/verify/route.ts` - Token verification endpoint
- `src/app/api/auth/link-telegram/route.ts` - Telegram account linking (AUTH-01 complete)
- `middleware.ts` - Next.js middleware with rate limiting + auth protection
- `test/mocks/redis.ts` - MockRedis class for testing
- `test/setup.ts` - Test setup with JWT_SECRET environment variable

**Before Plan 01-05:**
- Configure TELEGRAM_BOT_TOKEN environment variable
- Register Telegram bot with @BotFather
- Consider creating Telegram bot commands and handlers

---
*State initialized: 2026-03-05*
*Last updated: 2026-03-05T17:25:00Z*
