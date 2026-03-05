# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema otimizado para séries temporais de preços, sistema de autenticação single-user (você), e infraestrutura de rate limiting para APIs externas. Este phase entrega a base técnica sobre a qual os sistemas de coleta de preços, notificações e dashboard serão construídos.

</domain>

<decisions>
## Database Decisions

### Card Identification
- Usar **Scryfall oracle_id** como identificador único de carta
- oracle_id agrupa todas as impressões da mesma carta (best para pricing)
- Cada impressão tem preço diferente, mas oracle_id permite agrupar por "mesma carta"

### Price Storage
- **Uma row por fonte** (card_id, source, price, timestamp)
- Tabela: `prices` com colunas: card_id, source ('liga_magic', 'tcgplayer', 'cardmarket', 'cardkingdom'), price_brl, timestamp
- Mais flexível para comparar fontes e handle update schedules diferentes
- Trade-off: 4x storage (~17.6M rows/year esperado)

### Time-Series Partitioning
- **TimescaleDB hypertables** para particionamento automático por tempo
- Queries time-based são 10-100x mais rápidas
- Drop de old data é instantâneo (DROP CHUNKS)
- Chave temporal: `timestamp` (timestamp do price)

### Data Retention
- **90 dias de dados raw**, depois **downsample para média semanal**
- After 2 years: média mensal
- Reduz storage em ~80% enquanto preserva trends
- Requires job de downsampling (após高峰 não inicial)

### Card Metadata
- **Hybrid approach**: cache local + API fallback
- Tabela `cards` com cache de metadados (name, set, rarity, color, image_url, oracle_id)
- TTL de 24-48h para cache
- Fallback para Scryfall API se não estiver em cache

### Schema Design
- **Normalized approach** com múltiplas tabelas
- Tabelas principais: `cards`, `prices`, `users`, `wishlists`
- Foreign keys para data integrity
- Facilita queries complexas e joins

### Indexes
- **Composite index em (card_id, timestamp DESC)**
- Cobertura de 90% das queries: get price history for a card
- Fast time-series lookups

### ORM & Migrations
- **Drizzle ORM** para database access
- **Drizzle Kit** para migrations
- TypeScript-first, excelente DX, performance próximo a raw SQL

### Connection Pooling
- **Built-in pooling do Drizzle**
- Simple setup, sem dependências externas (PgBouncer)
- Adequado para initial load

## Authentication Decisions

### User Model
- **Single-user mode** inicialmente (só você)
- Database schema suporta múltiplos users para expansão futura
- Sem complexidade de multi-tenancy no início

### Telegram Integration
- **Bot criado via BotFather** para seu uso pessoal
- **Password simples + chat_id check** para acesso
- Dashboard: password em hash (bcrypt/argon2)
- Bot: verifica se chat_id está whitelist (só o seu)

### Password Storage
- **Hash com bcrypt ou argon2**
- Nunca plain text, mesmo para single-user
- Padrão da indústria, segurança básica

### JWT Implementation
- Biblioteca: **json-web-token** (industry standard, battle-tested)
- Token storage: **Client-side (httpOnly cookies ou localStorage)**
- Session duration: **1 day ou less** (você é user único, curta duração é OK)

### Session Management
- Stateless JWT tokens
- Server verifica signature, não mantém state
- Client re-autentica após expiração (1 dia)

## Project Structure Decisions

### Tech Stack
- **Node.js 20+** (runtime)
- **TypeScript strict mode** (type safety em todo código)
- **Next.js** (framework web - API routes + dashboard)
- **React 18+** com **Server Components** (dashboard UI)

### Monorepo Organization
- **Monorepo simples** (tudo em um repo)
- Backend (API), frontend (dashboard), bot, scraper juntos
- Compartilha código (types, utilities, DB client)
- Separação lógica: `src/api`, `src/bot`, `src/scraper`, `src/web`

### Directory Structure
- **Hybrid (by domain)**
  ```
  src/
  ├── api/           # Next.js API routes
  ├── bot/           # Telegram bot logic
  ├── scraper/       # Web scraping modules
  ├── web/           # Dashboard UI (Next.js app)
  ├── db/            # Database client, migrations
  ├── lib/           # Shared utilities
  └── types/         # Shared TypeScript types
  ```

### Code Style & Quality
- **Biome** para linting + formatting (substitui ESLint + Prettier)
- **Husky + lint-staged** para git hooks
- Formata on save, previne bad code no commit

### Logging
- **Winston ou Pino** para structured logging
- JSON format, log levels, metadata
- Production-friendly, fácil de parsear

### API Design
- **REST com Next.js API routes**
- Endpoints: `/api/cards`, `/api/prices`, `/api/auth`
- JSON responses
- Simples e bem suportado

### Deployment
- **Vercel** para Next.js (dashboard + API)
- Zero-config deployment, Git push → deploy
- Bot + scraper: Vercel Cron Jobs ou container separado

### Package Management
- **pnpm** como package manager
- Mais rápido, eficiente em disco, monorepo nativo

### Environment Variables
- **Manual process.env** inicialmente
- `.env.local` para development
- `.env.production` para production
- Nunca commit `.env` files

### Testing
- **Vitest + Testing Library**
- Fast, integrado com Vite/Next.js
- Testing Library para componentes React

### UI Components
- **Shadcn/ui** (copiable components, não installed)
- **Tailwind CSS** para estilização
- Componentes copiáveis para o projeto, full controle

### Background Jobs
- **node-cron** (in-process) para scheduling
- Scraping 2-3x ao dia
- Simple, adequate para initial version

### Web Scraping
- **Puppeteer ou Playwright** para browser automation
- Suporta sites com JS rendering
- Mais lento mas funciona em sites modernos

### Error Handling
- **try/catch + Winston logs**
- User-friendly messages no dashboard
- Detalhes técnicos nos logs (Winston)
- Sem error tracking service inicialmente

### Rate Limiting
- **Middleware + Redis** para APIs externas
- Token bucket ou leaky bucket algorithm
- Respeita limits de Scryfall (10 req/sec), Telegram, etc.
- Redis persiste state entre restarts

### Telegram Bot Library
- **grammy** (popular, type-safe, full Telegram API)
- Async/await, middleware support
- Modern architecture

### State Management
- **React Context + hooks** para estado global
- Simples, sem dependências externas
- Suficiente para dashboard pequeno

</decisions>

<specifics>
## Specific Ideas

**Tech stack change:**
- Original research recommended Python/FastAPI
- Changed to **Node.js/Next.js/TypeScript** during Phase 1 discussion
- Reason: Familiaridade com JavaScript/React ecosystem

**Single-user approach:**
- Bot criado via BotFather para uso pessoal
- Dashboard protegido por password simples
- No complex multi-user auth inicialmente
- Database schema preparada para expansão futura

**Deployment target:**
- Vercel para Next.js (zero-config, ótimo DX)
- Cron jobs via Vercel ou service externo
- Bot runs serverless ou em container

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
*Greenfield project - no existing code yet*

### Established Patterns
*Greenfield project - patterns to be established during implementation*

### Integration Points
*To be defined during implementation:*
- Database connection setup (Drizzle + PostgreSQL + TimescaleDB)
- Telegram bot webhook setup
- Next.js API routes structure
- Scraper job scheduling integration

</code_context>

<deferred>
## Deferred Ideas

**During this discussion:**
- None - discussion stayed within Phase 1 scope

**Noted for future consideration:**
- Multi-user authentication system (when expanding beyond personal use)
- Error tracking service (Sentry/Bugsnag) - can add later if needed
- PgBouncer connection pooler - add if connection limits become problematic
- Full monitoring/observability stack - Phase 6 or production readiness

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-03-05*
