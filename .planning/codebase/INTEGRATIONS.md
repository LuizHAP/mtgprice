# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Card Metadata & Pricing (Primary):**
- Scryfall (scryfall.com/api) - Card metadata, bulk data
  - SDK/Client: axios
  - Files: `src/scraper/providers/scryfall.ts`
  - Usage: Bulk card import, card metadata refresh (via gzip bulk data)
  - Rate limit: 10 req/sec preset
  - Note: Do NOT use Scryfall prices (only metadata)

**Price Scraping (4 Sources):**
- Liga Magic (ligamagic.com.br) - Brazilian MTG card prices (BRL)
  - SDK/Client: axios + cheerio (HTML parsing) + Playwright (browser automation)
  - Files: `src/scraper/providers/liga-magic.ts`
  - Authentication: None (public scraping with robots.txt compliance)
  - Rate limit: Per-provider configuration
  - Notes: Web scraping only (no API). Checks robots.txt before scraping.

- TCGPlayer (tcgplayer.com) - International MTG prices (USD)
  - SDK/Client: axios
  - Files: `src/scraper/providers/tcgplayer.ts`
  - Authentication: None (public API)
  - Rate limit: Per-provider configuration

- CardMarket (cardmarket.com) - European MTG prices (EUR)
  - SDK/Client: axios
  - Files: `src/scraper/providers/cardmarket.ts`
  - Authentication: None (public API)
  - Rate limit: Per-provider configuration

- CardKingdom (cardkingdom.com) - US MTG prices (USD)
  - SDK/Client: axios
  - Files: `src/scraper/providers/cardkingdom.ts`
  - Authentication: None (public API)
  - Rate limit: Per-provider configuration

**Currency Conversion:**
- Brazilian Central Bank API (Banco Central do Brasil) - Exchange rates USD/EUR to BRL
  - SDK/Client: axios
  - Files: `src/lib/currency.ts`
  - Authentication: None (public API)
  - Rate: 2-hour cache (per `CACHE_TTL`)
  - Purpose: Convert international prices to BRL with IOF tax (6.38%)

**Messaging & Bots:**
- Telegram Bot API - User notifications and command interface
  - SDK/Client: Grammy 1.36.2 (Telegram bot framework)
  - Files: `src/bot/index.ts`, `src/bot/commands/*`, `src/lib/telegram.ts`
  - Auth: `TELEGRAM_BOT_TOKEN` environment variable
  - Chat whitelist: `TELEGRAM_CHAT_ID` environment variable
  - Features: /start, /add, /remove, /list, /price commands with rate limiting

## Data Storage

**Databases:**
- PostgreSQL 12+ (primary)
  - Connection: `DATABASE_URL` environment variable
  - Client: postgres 3.4.5 (postgres-js)
  - ORM: Drizzle ORM 0.38.4
  - Schema: `src/db/schema/` (users, cards, prices, wishlists)
  - Key tables:
    - `users` - Authentication and Telegram linking
    - `cards` - Card metadata (oracle_id, name, set, image, lastFetched)
    - `prices` - Time-series price data (card_id, source, price_brl, timestamp with indexes)
    - `wishlists` - User wishlist items (user_id, card_id, unique constraint)

**File Storage:**
- Local filesystem only - Logs stored in `logs/` directory

**Caching:**
- Redis (optional, for rate limiting)
  - Connection: `REDIS_URL` environment variable
  - Client: ioredis 5.5.0
  - Purpose: Token bucket rate limiting per user/source
  - Files: `src/lib/ratelimit/redis.ts`

## Authentication & Identity

**Web Auth:**
- Custom JWT-based auth
  - Flow: Email + password → JWT token → httpOnly cookie
  - Implementation: `src/lib/auth/` (bcryptjs for hashing, jsonwebtoken for signing)
  - Endpoints: `src/app/api/auth/login`, `src/app/api/auth/verify`, `src/app/api/auth/logout`
  - Token expiry: 24 hours (configurable via cookie maxAge)
  - Server-side verification: `src/lib/auth-server.ts`

**Telegram Auth:**
- Telegram chat_id linking to user account
  - Files: `src/app/api/auth/link-telegram`
  - Purpose: Enable Telegram bot access to user wishlist

## Monitoring & Observability

**Error Tracking:**
- None detected (logs only)

**Logs:**
- Winston logger to file (`logs/error.log`, `logs/combined.log`)
- Files: `src/lib/logger.ts`
- Configurable via `LOG_LEVEL` environment variable
- Environments: Console output (dev), file output (all), JSON format

## CI/CD & Deployment

**Hosting:**
- Next.js-compatible platform (Vercel, AWS, etc.)
- Database: External PostgreSQL instance
- Redis: External Redis instance (optional)

**CI Pipeline:**
- Husky pre-commit hooks (lint-staged via Biomé)
- Files: `.husky/`, `lint-staged` config in package.json
- Biome linting/formatting via `npm run lint`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Telegram bot token from @BotFather
- `TELEGRAM_CHAT_ID` - Authorized Telegram chat ID (whitelist)
- `REDIS_URL` - Redis connection string (optional, for rate limiting)

**Optional env vars:**
- `LOG_LEVEL` - Winston log level (default: 'info')
- `NODE_ENV` - Production mode flag
- `CRON_MORNING`, `CRON_AFTERNOON`, `CRON_EVENING` - Cron schedules (default: 9AM, 3PM, 9PM)

**Secrets location:**
- `.env.local` (Git-ignored, never committed)

## Webhooks & Callbacks

**Incoming:**
- Telegram message updates (polling via Grammy bot)

**Outgoing:**
- Telegram bot messages sent via Grammy API

---

*Integration audit: 2026-04-11*
