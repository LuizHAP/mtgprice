# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.9.0 - All application code (Next.js, Node.js, bot)

**Secondary:**
- JavaScript - Build outputs
- YAML - Configuration files
- SQL - Database schemas

## Runtime

**Environment:**
- Node.js (version inferred from `@types/node` 22.13.5)

**Package Manager:**
- Yarn (lockfile: `yarn.lock` present)

## Frameworks

**Core:**
- Next.js 15.2.3 - Server-side rendering, API routes, web dashboard
- React 19.1.0 - UI components and pages

**Bot/Scheduler:**
- Grammy 1.36.2 - Telegram bot framework
- node-cron 3.0.3 - Task scheduling (2-3x daily price collection)

**Database:**
- Drizzle ORM 0.38.4 - TypeScript ORM for PostgreSQL
- postgres 3.4.5 - PostgreSQL client

**Testing:**
- Vitest 3.0.9 - Unit test runner
- @testing-library/react 16.2.0 - Component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- jsdom 26.0.3 - DOM implementation for testing
- Playwright 1.58.2 - Web scraping and E2E testing

**Build/Dev:**
- Biomé 1.9.4 - Linting and formatting (TypeScript, JSON, YAML)
- Tailwind CSS 4.2.1 - Utility-first styling
- PostCSS 8.5.8 - CSS processing
- tsx 4.21.0 - TypeScript execution for Node.js

## Key Dependencies

**Critical:**
- axios 1.13.6 - HTTP client for price scraping (Liga Magic, TCGPlayer, CardMarket, CardKingdom, Scryfall)
- cheerio 1.2.0 - HTML parsing for Liga Magic web scraping
- ioredis 5.5.0 - Redis client for rate limiting
- drizzle-kit 0.30.4 - ORM codegen and migrations

**Security:**
- bcryptjs 2.4.3 - Password hashing
- jsonwebtoken 9.0.2 - JWT token generation and verification

**Infrastructure:**
- winston 3.17.0 - Application logging
- opossum 9.0.0 - Circuit breaker for fault tolerance
- dotenv 17.3.1 - Environment variable loading

**UI Components:**
- shadcn 4.0.0 - Component library (Base UI React integration)
- @base-ui/react 1.2.0 - Headless component primitives
- lucide-react 0.577.0 - Icon library
- sonner 2.0.7 - Toast notifications
- next-themes 0.4.6 - Theme switching
- class-variance-authority 0.7.1 - Conditional styling
- clsx 2.1.1 - Utility function for classnames

**Validation:**
- zod 4.3.6 - TypeScript schema validation

**Utilities:**
- date-fns 4.1.0 - Date manipulation and formatting
- tailwind-merge 3.5.0 - Tailwind CSS class merging

## Configuration

**Environment:**
- `.env.local` file (required, never committed)
- Variables: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `REDIS_URL`
- Optional: `LOG_LEVEL`, `CRON_*` schedules, `NODE_ENV`

**Build:**
- `tsconfig.json` - TypeScript configuration with Next.js plugin
- `drizzle.config.ts` - Database schema, migrations, dialect (PostgreSQL)
- `biome.json` - Linting/formatting rules
- `tailwind.config.ts` - Tailwind CSS customization
- `.eslintrc.*` / `biome.json` - Code quality

## Platform Requirements

**Development:**
- Node.js 18+ (via types/node 22.13.5)
- PostgreSQL 12+ for Drizzle ORM
- Redis (optional, for rate limiting if enabled)
- Git for version control and Husky pre-commit hooks

**Production:**
- Next.js deployment platform (Vercel, AWS, etc.)
- PostgreSQL 12+ database
- Redis instance for rate limiting
- Telegram Bot API (Telegram cloud service)
- External APIs: Scryfall, Liga Magic, TCGPlayer, CardMarket, CardKingdom, Brazilian Central Bank

---

*Stack analysis: 2026-04-11*
