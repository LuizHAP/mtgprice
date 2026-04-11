# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
src/
├── app/                      # Next.js app router
│   ├── api/                  # REST API endpoints
│   │   ├── auth/            # Authentication routes
│   │   ├── cards/           # Card metadata routes
│   │   ├── prices/          # Price query routes
│   │   └── wishlist/        # Wishlist CRUD routes
│   ├── wishlist/            # Wishlist page (TSX)
│   ├── page.tsx             # Home page
│   └── layout.tsx           # Root layout
├── bot/                      # Telegram bot
│   ├── commands/            # Command handlers (/add, /remove, /list, /price, /start)
│   ├── middleware/          # Rate limiting, whitelist
│   └── index.ts             # Bot initialization
├── components/              # React UI components
│   ├── ui/                  # shadcn base components
│   ├── layout/              # Layout components (header, sidebar, etc.)
│   └── wishlist/            # Wishlist-specific components
├── db/                      # Database layer
│   ├── schema/              # Drizzle ORM table definitions
│   │   ├── users.ts         # Users table + relations
│   │   ├── cards.ts         # Cards table + relations
│   │   ├── prices.ts        # Prices table + relations (time-series)
│   │   └── wishlists.ts     # Wishlists table + relations
│   ├── queries/             # Query helpers (prices aggregation)
│   └── index.ts             # Database client initialization
├── lib/                     # Utilities and infrastructure
│   ├── auth/                # JWT, bcryptjs, password hashing
│   ├── ratelimit/           # Rate limiting (Redis token bucket)
│   ├── wishlist/            # Wishlist queries and validators
│   ├── auth-server.ts       # Server-side auth verification
│   ├── auth.ts              # JWT token ops (client/server)
│   ├── currency.ts          # Exchange rate + IOF tax
│   ├── logger.ts            # Winston logging
│   ├── telegram.ts          # Telegram bot instance
│   └── utils.ts             # Misc utilities
├── scraper/                 # Price collection pipeline
│   ├── providers/           # Price source implementations
│   │   ├── scryfall.ts      # Card metadata bulk import
│   │   ├── liga-magic.ts    # HTML scraping (BRL)
│   │   ├── tcgplayer.ts     # API fetch (USD)
│   │   ├── cardmarket.ts    # API fetch (EUR)
│   │   └── cardkingdom.ts   # API fetch (USD)
│   ├── circuit-breaker.ts   # Fault tolerance (Opossum)
│   ├── smart-refresh.ts     # Skip fresh data check
│   ├── orchestrator.ts      # Multi-source coordination
│   └── index.ts             # Scraper exports
├── scheduler/               # Background job runner
│   ├── jobs.ts              # Cron definitions + execution
│   └── index.ts             # Scheduler exports
├── types/                   # TypeScript type definitions
│   ├── auth.ts              # User, JwtPayload, LoginInput
│   └── wishlist.ts          # Wishlist item types
└── web/                     # Web middleware/utilities
    └── index.ts             # Web layer exports

Root files:
├── drizzle.config.ts        # Drizzle ORM config (schema, migrations)
├── tsconfig.json            # TypeScript compiler options
├── package.json             # Dependencies and scripts
├── next.config.ts           # Next.js configuration
└── tailwind.config.ts       # Tailwind CSS config
```

## Directory Purposes

**src/app/**
- Purpose: Next.js App Router pages and API endpoints
- Contains: Route handlers, page components, layouts
- Key files: `api/auth/login/route.ts`, `api/wishlist/route.ts`, `page.tsx`

**src/app/api/**
- Purpose: REST API endpoints
- Contains: POST/GET/DELETE route handlers (no authentication separation)
- Key files: Auth routes, card search, wishlist CRUD, price queries

**src/bot/**
- Purpose: Telegram bot interface
- Contains: Command implementations, middleware (rate limit, whitelist)
- Key files: `commands/add.ts`, `commands/price.ts`, `middleware/rate-limit.ts`

**src/components/**
- Purpose: Reusable React components
- Contains: shadcn UI library, layout components, wishlist widgets
- Key files: Button, Card, input components in `ui/`

**src/db/**
- Purpose: Data persistence and ORM layer
- Contains: Drizzle schema definitions, database client, query helpers
- Key files: `schema/prices.ts` (time-series), `queries/prices.ts` (aggregation)

**src/lib/**
- Purpose: Cross-cutting utilities and infrastructure
- Contains: Authentication (JWT, password), rate limiting (Redis), currency conversion, logging
- Key files: `auth/`, `ratelimit/redis.ts`, `currency.ts`, `logger.ts`

**src/scraper/**
- Purpose: Multi-source price collection pipeline
- Contains: Provider implementations (4 sources + Scryfall), orchestrator, circuit breaker, smart refresh
- Key files: `orchestrator.ts` (coordination), `providers/liga-magic.ts` (scraping), `circuit-breaker.ts` (fault tolerance)

**src/scheduler/**
- Purpose: Background job scheduling
- Contains: Cron job definitions (morning, afternoon, evening), execution controller
- Key files: `jobs.ts` (2-3x daily schedule)

**src/types/**
- Purpose: TypeScript type definitions (shared across layers)
- Contains: User auth types, wishlist types
- Key files: `auth.ts` (JwtPayload, LoginInput), `wishlist.ts` (item types)

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Homepage (public)
- `src/app/wishlist/page.tsx` - Wishlist page (authenticated)
- `src/bot/index.ts` - Telegram bot startup
- `src/scheduler/index.ts` - Cron scheduler

**Configuration:**
- `drizzle.config.ts` - Database schema, migrations, PostgreSQL dialect
- `tsconfig.json` - TypeScript options, path alias `@/*` → `./src/*`
- `package.json` - Dependencies, scripts (dev, build, test, db:*, bot:*)

**Core Logic:**
- `src/scraper/orchestrator.ts` - Price collection orchestration
- `src/app/api/wishlist/route.ts` - Wishlist CRUD with price enrichment
- `src/lib/wishlist/queries.ts` - Wishlist queries (latest prices, trends)
- `src/bot/commands/*.ts` - Telegram command handlers

**Testing:**
- `src/**/__tests__/*.test.ts` - Co-located unit tests (vitest)
- Key: `src/scraper/__tests__/orchestrator.test.ts`, `src/bot/__tests__/commands/*.test.ts`

## Naming Conventions

**Files:**
- Route handlers: `src/app/api/[namespace]/[id]/route.ts`
- Components: PascalCase (Button.tsx, Card.tsx)
- Services/utilities: camelCase (logger.ts, ratelimit.ts, currency.ts)
- Tests: `[subject].test.ts` or `[subject].spec.ts` (co-located with source)
- Schema tables: plural lowercase (users, cards, prices, wishlists)

**Directories:**
- API routes: `/api/[resource]/[action]` (e.g., `/api/auth/login`, `/api/wishlist`)
- Components: `/components/[category]/[name]` (e.g., `/components/ui/Button`)
- Utilities: `/lib/[domain]/[file]` (e.g., `/lib/ratelimit/redis.ts`)

**Functions:**
- Async handlers: `async function HANDLER(...)` (route.ts)
- Query functions: `get*()`, `fetch*()` (queries.ts, providers)
- Validation functions: `validate*()` (validators.ts)
- Conversion/utility: `apply*()`, `convert*()` (currency.ts)

**Types:**
- PascalCase: `User`, `LoginInput`, `JwtPayload`, `AllSourcesResult`
- Enums/const: UPPER_SNAKE_CASE (e.g., `IOF_RATE`, `RATE_LIMITS`)
- Generics: Single letter (K, V, T) or descriptive (SourceMetadata)

## Where to Add New Code

**New Feature (e.g., price alert/notification):**
- Primary code: `src/lib/[domain]/` (e.g., `src/lib/alerts/`)
- Tests: `src/lib/[domain]/__tests__/` (co-located)
- Database: Update `src/db/schema/` if new table needed
- API: Add route in `src/app/api/[resource]/route.ts`

**New Price Source (e.g., StockX):**
- Implementation: `src/scraper/providers/stockx.ts`
- Add to orchestrator: Update `src/scraper/orchestrator.ts` ALL_SOURCES array
- Tests: `src/scraper/__tests__/stockx.test.ts`

**New Telegram Command (e.g., /stats):**
- Command handler: `src/bot/commands/stats.ts`
- Register in: `src/bot/index.ts` (import statement)
- Tests: `src/bot/__tests__/commands/stats.test.ts`

**Utilities/Helpers:**
- Shared helpers: `src/lib/utils.ts`
- Domain-specific: `src/lib/[domain]/` (e.g., `src/lib/wishlist/`)

## Special Directories

**src/db/schema/**
- Purpose: Drizzle ORM table definitions
- Generated: No (manual TypeScript definitions)
- Committed: Yes (source of truth for database structure)
- Import: `import { users, cards, prices, wishlists } from '@/db'`

**drizzle/**
- Purpose: Generated migration files from Drizzle Kit
- Generated: Yes (by `drizzle-kit generate`)
- Committed: Yes (tracks schema history)
- Usage: `drizzle-kit push` applies migrations to database

**logs/**
- Purpose: Application logs (error.log, combined.log)
- Generated: Yes (created at runtime by Winston)
- Committed: No (.gitignore)
- Location: Root directory

**.next/**
- Purpose: Next.js build output
- Generated: Yes (by `next build`)
- Committed: No (.gitignore)

---

*Structure analysis: 2026-04-11*
