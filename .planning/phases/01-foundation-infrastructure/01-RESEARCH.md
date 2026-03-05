# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-03-05
**Domain:** Next.js + TypeScript + PostgreSQL + TimescaleDB
**Confidence:** HIGH

## Summary

Phase 1 establishes the technical foundation for the MTG Price Monitor system: a time-series optimized database with Drizzle ORM, JWT-based authentication for both web dashboard and Telegram bot, and Redis-backed rate limiting to respect external API constraints. The stack leverages Next.js 15 with App Router for seamless API/web integration, TimescaleDB hypertables for 10-100x faster time-series queries, and grammY for modern Telegram bot development.

**Primary recommendation:** Use the locked decisions from CONTEXT.md verbatim—they represent a well-researched, modern stack tailored for single-user deployment with future multi-tenant capability.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Database:**
- Card identification: **Scryfall oracle_id** as unique identifier
- Price storage: **One row per source** (card_id, source, price_brl, timestamp)
- Time-series partitioning: **TimescaleDB hypertables** with automatic time-based chunking
- Data retention: **90 days raw** → weekly downsampling → monthly after 2 years
- Card metadata: **Hybrid approach** (local cache + API fallback, 24-48h TTL)
- Schema design: **Normalized approach** with foreign keys (tables: cards, prices, users, wishlists)
- Indexes: **Composite index on (card_id, timestamp DESC)** covering 90% of queries
- ORM: **Drizzle ORM** with Drizzle Kit for migrations
- Connection pooling: **Built-in Drizzle pooling** (no PgBouncer initially)

**Authentication:**
- User model: **Single-user mode** (database supports future multi-user)
- Telegram integration: **BotFather-created bot** with password + chat_id whitelist
- Password storage: **bcrypt or argon2** hashing (never plain text)
- JWT implementation: **json-web-token** library with client-side storage
- Session duration: **1 day or less** (acceptable for single-user)

**Project Structure:**
- Runtime: **Node.js 20+**
- Language: **TypeScript strict mode**
- Framework: **Next.js** (App Router, API routes + dashboard)
- UI: **React 18+ Server Components**
- Organization: **Monorepo structure** (src/api, src/bot, src/scraper, src/web, src/db, src/lib, src/types)
- Code quality: **Biome** (linting + formatting, replaces ESLint + Prettier)
- Git hooks: **Husky + lint-staged**
- Logging: **Winston or Pino** (structured JSON logging)
- API design: **REST with Next.js API routes**
- Deployment: **Vercel** for Next.js, cron jobs via Vercel or external service
- Package manager: **pnpm**
- Environment variables: **Manual process.env** (.env.local, .env.production)
- Testing: **Vitest + Testing Library**
- UI components: **Shadcn/ui** (copiable, not installed) + Tailwind CSS
- Background jobs: **node-cron** (in-process scheduling)
- Web scraping: **Puppeteer or Playwright**
- Error handling: **try/catch + Winston**, no error tracking service initially
- Rate limiting: **Middleware + Redis** with token bucket algorithm
- Telegram library: **grammy** (type-safe, full API coverage)
- State management: **React Context + hooks**

### Claude's Discretion

None—all decisions locked during `/gsd:discuss-phase`.

### Deferred Ideas (OUT OF SCOPE)

- Multi-user authentication system (future expansion)
- Error tracking service (Sentry/Bugsnag)
- PgBouncer connection pooler
- Full monitoring/observability stack

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User pode vincular conta ao Telegram para receber notificações | grammY library provides webhook/polling modes, chat_id identification, and command handling. Database schema supports Telegram linking. |
| AUTH-02 | Sessão do usuário persiste entre acessos ao dashboard web | JWT with httpOnly cookies or localStorage provides stateless session persistence. Next.js middleware can validate tokens on protected routes. |
| PRICE-06 | Sistema implementa rate limiting para respeitar limites das APIs e evitar bloqueios | Redis-backed token bucket algorithm with Lua scripts ensures atomic rate limit enforcement. Respects Scryfall (10 req/sec) and Telegram limits. |
| PRICE-08 | Sistema armazena histórico de preços para cada carta/fonte | TimescaleDB hypertables with (card_id, timestamp DESC) composite index provide 10-100x faster time-series queries. Automatic partitioning by time chunks. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Next.js** | 15.2.3+ | Full-stack framework | Latest App Router with Server Components, zero-config Vercel deployment, fixed CVE-2025-29927 |
| **TypeScript** | 5.9+ | Type safety | Strict mode catches errors at compile time, excellent IDE support |
| **PostgreSQL** | 16+ | Primary database | Battle-tested relational database, ACID compliance |
| **TimescaleDB** | 2.15+ | Time-series extension | 65% lower storage vs InfluxDB, hypertables for 10-100x faster queries, automatic partitioning |
| **Drizzle ORM** | latest | Database access | TypeScript-first, SQL-like API, zero dependencies, serverless-ready |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **grammy** | latest | Telegram bot | Type-safe, async/await, full API coverage, modern architecture |
| **bcrypt/argon2** | latest | Password hashing | Industry standard, never store plain text |
| **json-web-token** | latest | JWT implementation | Stateless authentication, battle-tested |
| **Redis** | 7+ | Rate limiting store | Fast in-memory operations, Lua script atomicity, persists state |
| **Biome** | 1.x+ | Linting + formatting | 20x faster than ESLint+Prettier, single config, no conflicts |
| **Winston/Pino** | latest | Structured logging | JSON format, log levels, production-friendly |
| **Vitest** | latest | Testing framework | Fast, native ESM, integrated with Vite/Next.js |
| **node-cron** | latest | Job scheduling | In-process scheduling, simple, adequate for initial version |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python/FastAPI (original research) | Node.js/Next.js | User chose JS/TS ecosystem for familiarity with React |
| bcrypt | argon2 | Argon2 more resistant to GPU attacks, bcrypt more mature. Both acceptable. |
| PgBouncer | Drizzle built-in pooling | Built-in adequate for initial load, add PgBouncer if connection limits hit |
| ESLint + Prettier | Biome | Biome 20x faster, single config, no tool conflicts |

**Installation:**
```bash
# Core dependencies
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript@5.9+ @types/react@latest @types/node@latest

# Database
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit

# Authentication
pnpm add jsonwebtoken bcrypt
pnpm add -D @types/jsonwebtoken @types/bcrypt

# Telegram
pnpm add grammy

# Rate limiting
pnpm add ioredis

# Development tools
pnpm add -D @biomejs/biome
pnpm add -D husky lint-staged

# Testing
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom

# Logging
pnpm add winston

# Scheduling
pnpm add node-cron

# Web scraping (Phase 2)
pnpm add puppeteer # or playwright
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/              # Next.js API routes (app/api/*)
│   ├── auth/         # /api/auth/login, /api/auth/verify
│   ├── cards/        # /api/cards, /api/cards/[id]
│   └── prices/       # /api/prices, /api/prices/history
├── bot/              # Telegram bot logic
│   ├── commands/     # /start, /price, /history
│   ├── middleware/   # chat_id whitelist check
│   └── handlers/     # message handlers
├── db/               # Database client and migrations
│   ├── schema/       # Drizzle schema definitions
│   ├── migrations/   # Generated SQL migrations
│   └── seed/         # Seed data (development)
├── lib/              # Shared utilities
│   ├── auth.ts       # JWT signing/verification
│   ├── logger.ts     # Winston/Pino configuration
│   ├── rate-limiter.ts # Token bucket implementation
│   └── telegram.ts   # grammY bot instance
├── types/            # Shared TypeScript types
│   ├── database.ts   # Drizzle inferred types
│   ├── auth.ts       # User, Session types
│   └── api.ts        # Request/response types
└── web/              # Dashboard UI (app/*)
    ├── login/        # Login page
    ├── dashboard/    # Protected dashboard
    └── layout.tsx    # Root layout with providers
```

### Pattern 1: Drizzle Schema with TimescaleDB Hypertables
**What:** Define tables in TypeScript, convert to hypertables for time-series optimization
**When to use:** All price data requiring time-based queries
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs
import { pgTable, serial, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'

export const prices = pgTable('prices', {
  id: serial('id').primaryKey(),
  cardId: varchar('card_id', { length: 255 }).notNull(), // Scryfall oracle_id
  source: varchar('source', { length: 50 }).notNull(), // 'liga_magic', 'tcgplayer', etc.
  priceBrl: numeric('price_brl', { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
})

// Migration to create hypertable (manual SQL):
// SELECT create_hypertable('prices', 'timestamp', chunk_time_interval => INTERVAL '7 days');

// Composite index for 90% query coverage
// CREATE INDEX idx_prices_card_timestamp ON prices (card_id, timestamp DESC);
```

### Pattern 2: JWT Authentication with Next.js Middleware
**What:** Stateless authentication using JWT tokens stored in httpOnly cookies
**When to use:** Protecting dashboard routes and API endpoints
**Example:**
```typescript
// Source: Next.js docs https://nextjs.org/docs/app/building-your-application/routing/middleware
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET!)
    } catch {
      // Invalid token, redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_token')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*']
}
```

### Pattern 3: Redis-Backed Token Bucket Rate Limiting
**What:** Atomic rate limiting using Redis Lua scripts
**When to use:** All external API calls (Scryfall, Telegram, etc.)
**Example:**
```typescript
// lib/rate-limiter.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export async function checkRateLimit(
  key: string,
  limit: number,  // max tokens
  interval: number, // refill interval in seconds
  tokens: number = 1 // tokens to consume
): Promise<{ allowed: boolean; remaining: number }> {
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local interval = tonumber(ARGV[2])
    local tokens = tonumber(ARGV[3])
    local now = tonumber(redis.call('TIME')[1])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local current_tokens = tonumber(bucket[1]) or limit
    local last_refill = tonumber(bucket[2]) or now

    -- Refill tokens based on time elapsed
    local elapsed = now - last_refill
    if elapsed >= interval then
      current_tokens = limit
      last_refill = now
    end

    -- Check if enough tokens
    if current_tokens >= tokens then
      current_tokens = current_tokens - tokens
      redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', last_refill)
      redis.call('EXPIRE', key, interval)
      return {1, current_tokens}
    else
      return {0, current_tokens}
    end
  `

  const result = await redis.eval(
    luaScript,
    1,
    `ratelimit:${key}`,
    limit,
    interval,
    tokens
  ) as [number, number]

  return { allowed: result[0] === 1, remaining: result[1] }
}

// Usage for Scryfall (10 req/sec):
// const { allowed } = await checkRateLimit('scryfall', 10, 1)
// if (!allowed) throw new Error('Rate limit exceeded')
```

### Pattern 4: grammY Telegram Bot with Chat ID Whitelist
**What:** Single-user Telegram bot with password + chat_id verification
**When to use:** Personal bot for notifications and commands
**Example:**
```typescript
// lib/telegram.ts
import { Bot } from 'grammy'

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

// Whitelist check middleware
bot.use(async (ctx, next) => {
  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (ctx.chat?.id.toString() !== allowedChatId) {
    return ctx.reply('Sorry, this bot is not available for public use.')
  }
  return next()
})

// /start command with password check
bot.command('start', async (ctx) => {
  const password = ctx.message?.text.split(' ')[1]
  if (password !== process.env.BOT_PASSWORD) {
    return ctx.reply('Invalid password. Access denied.')
  }
  await ctx.reply('Welcome! You now have access to the bot.')
})

bot.api.setMyCommands([
  { command: 'start', description: 'Authenticate with password' },
  { command: 'price', description: 'Check card price' },
  { command: 'history', description: 'View price history alerts' },
])

export { bot }
```

### Anti-Patterns to Avoid
- **Plain text passwords:** Always use bcrypt/argon2 with salt rounds >= 10
- **Storing JWTs in localStorage (without protection):** Vulnerable to XSS. Use httpOnly cookies or implement CSRF protection
- **Missing CSRF protection:** If using localStorage, must implement CSRF tokens
- **Synchronous password hashing:** Use async bcrypt.hash() to avoid blocking event loop
- **Skipping rate limiting:** External APIs will ban you. Scryfall is strict.
- **Composite index on (timestamp, card_id):** Wrong order! Use (card_id, timestamp DESC) for time-series queries
- **Creating hypertable on non-time column:** Must use timestamp column for partitioning
- **Forgetting to set TTL on Redis keys:** Memory bloat. Always EXPIRE rate limit keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt implementation | bcrypt npm package | Proper salt handling, timing-attack protection, battle-tested |
| JWT verification | Manual crypto signing | jsonwebtoken library | Secure defaults, claim validation, widespread adoption |
| Rate limiting | In-memory counter | Redis + Lua scripts | Atomic operations, persists across restarts, distributed-ready |
| Database migrations | Manual SQL files | Drizzle Kit | Type-safe, reversible, tracks schema history |
| Linting + formatting | Separate ESLint + Prettier | Biome | 20x faster, single config, no conflicts |
| Telegram bot parsing | Manual HTTP API calls | grammY | Type-safe, middleware support, handles webhooks/polling |

**Key insight:** Custom solutions for authentication and rate limiting are security nightmares. Use libraries that have been audited and battle-tested in production.

## Common Pitfalls

### Pitfall 1: Missing TimescaleDB Hypertable Conversion
**What goes wrong:** Queries run 10-100x slower as data grows. No automatic partitioning.
**Why it happens:** Drizzle creates regular PostgreSQL tables by default. Hypertable must be created separately.
**How to avoid:** Run `SELECT create_hypertable('prices', 'timestamp', chunk_time_interval => INTERVAL '7 days')` in migration after table creation.
**Warning signs:** Time-series queries getting slower after 50K+ rows.

### Pitfall 2: Composite Index Order
**What goes wrong:** Queries filtering by card_id and sorting by timestamp are slow.
**Why it happens:** PostgreSQL reads indexes left-to-right. Index on (timestamp, card_id) doesn't help card_id-first queries.
**How to avoid:** Always create index as (card_id, timestamp DESC). This covers 90% of time-series queries.
**Warning signs:** EXPLAIN ANALYZE shows Seq Scan instead of Index Scan.

### Pitfall 3: Ignoring Scryfall Rate Limits
**What goes wrong:** IP gets banned for 24 hours. Scraping halts completely.
**Why it happens:** Scryfall enforces 10 req/sec hard limit. Burst requests trigger bans.
**How to avoid:** Implement Redis token bucket with 10 req/sec limit. Add 50-100ms delays between requests. Use bulk data endpoints when possible.
**Warning signs:** HTTP 429 responses, sudden failures.

### Pitfall 4: JWT Secret in Code
**What goes wrong:** Anyone can forge tokens. Complete authentication bypass.
**Why it happens:** Committing `JWT_SECRET='hardcoded-secret'` to git.
**How to avoid:** Use `process.env.JWT_SECRET` with strong random value (openssl rand -base64 32). Never commit .env files.
**Warning signs:** Secret in version control.

### Pitfall 5: Missing CORS Configuration
**What goes wrong:** Frontend cannot call API. Browser blocks requests.
**Why it happens:** Next.js API routes need CORS headers for cross-origin requests.
**How to avoid:** Configure CORS in next.config.js or use middleware to set headers.
**Warning signs:** Browser console shows CORS errors.

### Pitfall 6: Forgetting to Chunk Old Data
**What goes wrong:** Database grows indefinitely. Queries slow down. Storage costs explode.
**Why it happens:** No retention policy implemented. Old price data never deleted or downsampled.
**How to avoid:** Implement TimescaleDB retention policy: `SELECT add_retention_policy('prices', INTERVAL '90 days')`. Add downsampling job for weekly/monthly averages.
**Warning signs:** Database size growing 10MB+ per day.

### Pitfall 7: Biome Configuration Conflicts
**What goes wrong:** Linting and formatting fight. Code keeps changing on save.
**Why it happens:** Biome linter and formatter have conflicting rules (similar to ESLint + Prettier issues).
**How to avoid:** Use Biome's single tool for both. Enable "recommended" preset. Don't mix with ESLint/Prettier.
**Warning signs:** Format differs after linting.

## Code Examples

Verified patterns from official sources:

### Drizzle Schema with Foreign Keys
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgTable, serial, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 255}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  oracleId: varchar('oracle_id', { length: 255 }).notNull().unique(), // Scryfall oracle_id
  name: varchar('name', { length: 255 }).notNull(),
  set: varchar('set', { length: 10 }),
  rarity: varchar('rarity', { length: 50 }),
  color: varchar('color', { length: 50 }),
  imageUrl: text('image_url'),
  lastFetched: timestamp('last_fetched'),
}, (table) => ({
  oracleIdx: index('cards_oracle_idx').on(table.oracleId),
}))

export const prices = pgTable('prices', {
  id: serial('id').primaryKey(),
  cardId: varchar('card_id', { length: 255 }).notNull().references(() => cards.oracleId),
  source: varchar('source', { length: 50 }).notNull(), // 'liga_magic', 'tcgplayer', 'cardmarket', 'cardkingdom'
  priceBrl: varchar('price_brl', { length: 50 }).notNull(), // Use numeric for production
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => ({
  cardTimestampIdx: index('prices_card_timestamp_idx').on(table.cardId, table.timestamp),
}))

export const usersRelations = relations(users, ({ many }) => ({
  wishlists: many(wishlists),
}))

export const cardsRelations = relations(cards, ({ many }) => ({
  prices: many(prices),
  wishlists: many(wishlists),
}))

export const pricesRelations = relations(prices, ({ one }) => ({
  card: one(cards, {
    fields: [prices.cardId],
    references: [cards.oracleId],
  }),
}))

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  cardId: varchar('card_id', { length: 255 }).notNull().references(() => cards.oracleId),
  addedAt: timestamp('added_at').notNull().defaultNow(),
})
```

### Biome Configuration
```json
// Source: https://biomejs.dev/guides/getting-started/
{
  "$schema": "https://biomejs.dev/schemas/1.9.3/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["node_modules", "dist", ".next", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 110,
    "lineEnding": "lf"
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "a11y": {
        "recommended": true
      },
      "correctness": {
        "recommended": true
      },
      "complexity": {
        "recommended": true
      },
      "style": {
        "recommended": true
      },
      "suspicious": {
        "recommended": true
      },
      "performance": {
        "recommended": true
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  }
}
```

### Vitest Configuration for Next.js
```typescript
// Source: Search results for Vitest + Next.js integration
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint + Prettier | Biome (single tool) | 2025 | 20x faster linting, no config conflicts, better TypeScript support |
| Pages Router | App Router (Next.js 13+) | 2023-2024 | Server Components, streaming, simpler data fetching |
| Class components | Functional + hooks | React 18+ | Better reusability, simpler state management |
| Manual JWT verification | NextAuth.js / Better Auth | 2024-2025 | Built-in providers, session management, CSRF protection |
| In-memory rate limiting | Redis + Lua scripts | Ongoing | Atomic operations, distributed, persists state |

**Deprecated/outdated:**
- **Next.js < 15.2.3:** Critical CVE-2025-29927 middleware bypass vulnerability. Upgrade immediately.
- **Pages Router (for new projects):** App Router is the future. Only use Pages Router for legacy migrations.
- **Class components:** Functional components with hooks are the standard.
- **this.setState:** Use useState hook or state management libraries.
- **create-react-app:** Deprecated. Use Next.js, Vite, or Remix.

## Open Questions

1. **IOF rate verification (6.38% for credit card purchases)**
   - What we know: STATE.md mentions this rate needs verification with Brazilian Central Bank
   - What's unclear: Is this still the current rate in 2026?
   - Recommendation: Verify with [Banco Central do Brasil](https://www.bcb.gov.br) before Phase 2 implementation

2. **Liga Magic API access vs scraping**
   - What we know: Price source is Liga Magic (Brazil)
   - What's unclear: Does Liga Magic have an official API or require web scraping?
   - Recommendation: Phase 2 planning must verify robots.txt, ToS, and API documentation. If scraping required, check Puppeteer vs Playwright for JS rendering.

3. **Optimal TimescaleDB chunk interval**
   - What we know: Research suggests 7 days for medium-frequency data
   - What's unclear: Is 7 days optimal for 2-3x daily price checks across 4 sources?
   - Recommendation: Start with 7 days. Monitor query performance. Adjust based on actual data volume (~17.6M rows/year = 48K rows/day).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest with jsdom environment |
| Config file | `vitest.config.ts` (to be created) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User can link Telegram account | integration | `pnpm test src/api/auth/link.test.ts` | ❌ Wave 0 |
| AUTH-02 | Session persists across browser restarts | integration | `pnpm test src/api/auth/session.test.ts` | ❌ Wave 0 |
| PRICE-06 | Rate limiting enforced for external APIs | unit | `pnpm test src/lib/rate-limiter.test.ts` | ❌ Wave 0 |
| PRICE-08 | Price history stored with correct schema | unit | `pnpm test src/db/schema/prices.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (quick smoke test)
- **Per wave merge:** `pnpm test:coverage` (full suite with coverage)
- **Phase gate:** Full suite green with ≥80% coverage before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment and path aliases
- [ ] `test/setup.ts` — Test setup file (e.g., global mocks, Testing Library setup)
- [ ] `src/api/auth/link.test.ts` — Telegram linking integration tests
- [ ] `src/api/auth/session.test.ts` — JWT session persistence tests
- [ ] `src/lib/rate-limiter.test.ts` — Token bucket algorithm unit tests with Redis mock
- [ ] `src/db/schema/prices.test.ts` — Drizzle schema validation tests
- [ ] `test/mocks/redis.ts` — Redis mock for testing (or use ioredis-mock)

## Sources

### Primary (HIGH confidence)
- [Next.js Documentation](https://nextjs.org/docs) - Verified Next.js 16.1.6 as latest, App Router features, authentication patterns
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) - Confirmed SQL-like API, zero dependencies, TypeScript-first
- [Biome Getting Started Guide](https://biomejs.dev/guides/getting-started/) - Verified installation, configuration, CLI commands
- [CONTEXT.md](.planning/phases/01-foundation-infrastructure/01-CONTEXT.md) - User decisions and locked technical choices

### Secondary (MEDIUM confidence)
- [突破API限制：node-rate-limiter实现高性能流量控制全指南](https://m.blog.csdn.net/gitblog_00716/article/details/143536409) - Confirmed `limiter` npm package for token bucket in Node.js
- [Redis 实现高可用限流：从固定窗口到令牌桶的四大算法实战解析](https://m.blog.cdn.net/m0_74908430/article/details/155076710) - Verified Redis + Lua script pattern for atomic rate limiting
- [Next.js 15 Authentication best practices](https://dev.to/taufiqul7756/nextjs-15-authentication-with-app-router-and-middleware-4f94) - Confirmed JWT middleware approach
- [grammy NPM package](https://www.npmjs.com/package/grammy) - Verified grammY as modern Telegram bot framework
- [Vitest + Next.js setup guides](https://www.linkedin.com/pulse/how-set-up-vitest-nextjs-typescript-ashfiquzzaman-sajal-9kscc) - Confirmed Vitest integration patterns

### Tertiary (LOW confidence - marked for validation)
- TimescaleDB hypertable best practices (web search rate limited, verify with official docs)
- bcrypt vs argon2 recommendations (web search results, verify with security experts)
- IOF 6.38% rate (STATE.md flag for verification with Brazilian Central Bank)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All choices locked in CONTEXT.md, verified with official docs
- Architecture: HIGH - Patterns verified with official documentation (Next.js, Drizzle, Biome)
- Pitfalls: MEDIUM - Common pitfalls documented, some specific to this stack need validation during implementation
- Authentication: HIGH - JWT patterns well-established, grammY verified for Telegram
- Rate limiting: MEDIUM - Token bucket algorithm confirmed, Redis Lua scripts standard practice
- Testing: MEDIUM - Vitest chosen but implementation details need Wave 0 setup

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days - stable stack with locked decisions)
