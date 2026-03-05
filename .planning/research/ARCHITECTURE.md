# Architecture Research

**Domain:** Price monitoring system for Magic: The Gathering cards
**Researched:** 2026-03-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Presentation Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Web Dashboard│  │Telegram Bot  │  │  Admin UI    │         │
│  │  (Next.js)   │  │  (Bot API)   │  │  (Next.js)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
└─────────┼─────────────────┼──────────────────┼──────────────────┘
          │                 │                  │
┌─────────┼─────────────────┼──────────────────┼──────────────────┐
│         ↓                 ↓                  ↓                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Gateway Layer                      │   │
│  │                    (NestJS + Fastify)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    Application Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │   Scraper   │ │Opportunity  │ │Notification │             │
│  │  Scheduler  │ │  Detector   │ │  Service    │             │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘             │
│         │                │                │                   │
│  ┌──────┴──────┐ ┌───────┴────────┐ ┌────┴─────┐            │
│  │  Data       │ │   Currency     │ │   User    │            │
│  │Collector    │ │  Converter     │ │  Service  │            │
│  └─────────────┘ └────────────────┘ └───────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                    Message Queue Layer                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Redis / RabbitMQ / BullMQ                  │   │
│  │         (Async task processing & events)                │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    Data Layer                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │  PostgreSQL │ │   Redis     │ │  Time-Series│             │
│  │ (Primary DB)│ │  (Cache)    │ │  (Prices)   │             │
│  └─────────────┘ └─────────────┘ └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Scraper Scheduler** | Coordinates periodic price collection (2-3x/day) | NestJS scheduler + Bull queues |
| **Data Collector** | Multi-source aggregation (API + scraping) | Axios + Puppeteer/Playwright |
| **Opportunity Detector** | Analyzes price drops & trends | Rule engine + statistical analysis |
| **Notification Service** | Sends Telegram alerts | Telegram Bot API + queue |
| **Currency Converter** | Converts USD/EUR to BRL with IOF | External API adapter with caching |
| **User Service** | Authentication, wishlist management | JWT + PostgreSQL |
| **Web Dashboard** | Price history, configuration UI | Next.js + shadcn/ui |
| **Telegram Bot** | Command-based user interactions | python-telegram-bot or Telegraf |

## Recommended Project Structure

```
mtgprice/
├── apps/                          # Deployable applications
│   ├── api/                       # NestJS backend API
│   │   ├── src/
│   │   │   ├── scrapers/          # Data collection modules
│   │   │   │   ├── liga-magic/
│   │   │   │   ├── tcgplayer/
│   │   │   │   ├── cardmarket/
│   │   │   │   └── cardkingdom/
│   │   │   ├── services/          # Business logic
│   │   │   │   ├── opportunity-detector/
│   │   │   │   ├── currency-converter/
│   │   │   │   ├── notification/
│   │   │   │   └── user/
│   │   │   ├── schedulers/        # Scheduled tasks
│   │   │   │   └── price-scheduler.service.ts
│   │   │   ├── jobs/              # Bull queue job processors
│   │   │   ├── common/            # Shared utilities, decorators
│   │   │   └── main.ts
│   │   └── test/
│   ├── web/                       # Next.js web dashboard
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── bot/                       # Telegram bot (optional: separate service)
├── packages/                      # Shared libraries
│   ├── types/                     # Shared TypeScript types
│   │   └── src/
│   │       ├── card/              # Card-related types
│   │       ├── price/             # Price-related types
│   │       ├── user/              # User-related types
│   │       └── api/               # API response types
│   ├── ui/                        # Shared UI components
│   ├── db/                        # Database client & migrations
│   │   └── src/
│   │       ├── migrations/
│   │       └── client.ts
│   └── config/                    # Shared configuration
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml            # pnpm workspace definition
├── tsconfig.base.json             # Base TypeScript config
└── docker-compose.yml             # Local development stack
```

### Structure Rationale

- **apps/api/**: NestJS backend with modular architecture. Separate scraper modules allow independent rate limiting and failure handling per source.
- **apps/web/**: Next.js for server-rendered dashboard with excellent DX and performance.
- **apps/bot/**: Telegram bot as separate deployable service for independent scaling.
- **packages/types/**: Centralized type definitions ensure type safety across frontend, backend, and bot.
- **packages/db/**: Shared database client and migrations ensure schema consistency.
- **packages/config/**: Centralized configuration (environment variables, constants).
- **Monorepo advantages**: Code sharing, atomic commits, unified build pipeline, easier refactoring.

## Architectural Patterns

### Pattern 1: Event-Driven Architecture with Message Queues

**What:** Components communicate asynchronously via message queues instead of direct synchronous calls.

**When to use:**
- Scraper tasks can run independently without blocking API responses
- Opportunity detection is triggered by new price data availability
- Notifications can be sent without delaying scraper completion
- Multiple workers process tasks concurrently

**Trade-offs:**
- Pros: Decoupled components, better fault isolation, scalable, handles rate limits gracefully
- Cons: More complex debugging, eventual consistency, requires queue infrastructure

**Example:**
```typescript
// Price collector publishes job to queue
await priceQueue.add('collect-source', {
  source: 'liga-magic',
  cardIds: ['card-1', 'card-2'],
  priority: 1
});

// Worker processes job asynchronously
@Process('collect-source')
async handleCollectSource(job: Job) {
  const prices = await this.scraperService.scrape(job.data);
  await this.priceRepository.save(prices);
  await this.opportunityQueue.add('analyze', { cardId: job.data.cardId });
}
```

### Pattern 2: Adapter Pattern for Multi-Source Data Collection

**What:** Define a unified interface for all price sources, with specific implementations for each source (API or scraping).

**When to use:**
- Multiple data sources with different access methods (API vs scraping)
- Need to normalize data from different formats
- Want to easily add/remove sources without affecting business logic

**Trade-offs:**
- Pros: Consistent interface, easy to test, isolates source-specific logic
- Cons: Initial boilerplate, may lose source-specific features

**Example:**
```typescript
interface PriceSourceAdapter {
  getName(): string;
  fetchPrices(cardIds: string[]): Promise<PriceData[]>;
  supportsBatching(): boolean;
  getRateLimit(): RateLimitConfig;
}

class TCGPlayerAdapter implements PriceSourceAdapter {
  async fetchPrices(cardIds: string[]): Promise<PriceData[]> {
    // TCGPlayer-specific API call implementation
  }
}

class LigaMagicAdapter implements PriceSourceAdapter {
  async fetchPrices(cardIds: string[]): Promise<PriceData[]> {
    // LigaMagic-specific web scraping implementation
  }
}
```

### Pattern 3: Repository Pattern with Time-Series Partitioning

**What:** Abstract data access logic with optimized storage for time-series price data.

**When to use:**
- Need to store and query large amounts of historical price data
- Queries are primarily time-based (price history, trends)
- Want to optimize for both recent and historical data access

**Trade-offs:**
- Pros: Clean data access layer, optimized queries, easy to mock for testing
- Cons: More abstraction layers, requires careful partitioning strategy

**Example:**
```typescript
// PostgreSQL with native partitioning (PostgreSQL 10+)
CREATE TABLE prices (
  id BIGSERIAL,
  card_id VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL,
  price_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create monthly partitions
CREATE TABLE prices_2026_03 PARTITION OF prices
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Composite index for common queries
CREATE INDEX idx_price_card_time ON prices (card_id, recorded_at DESC);
```

### Pattern 4: Rate Limiting with Token Bucket Algorithm

**What:** Control request rate to external APIs/scraping targets using token bucket algorithm.

**When to use:**
- Respecting external API rate limits
- Avoiding IP blocks during web scraping
- Distributing requests across time windows

**Trade-offs:**
- Pros: Prevents blocks, respects source limits, smooths request distribution
- Cons: Slower data collection, requires careful tuning

**Example:**
```typescript
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,    // Max tokens
    private refillRate: number,  // Tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens = 1): Promise<boolean> {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

## Data Flow

### Request Flow

```
[User: Check Price]
    ↓
[Web Dashboard] → [API Gateway] → [Price Service] → [PostgreSQL + Redis]
    ↓              ↓                ↓
[Response] ← [Transform] ← [Query w/ Cache] ← [Database]
```

### Price Collection Flow

```
[Scheduler Trigger]
    ↓
[Price Queue] → [Worker 1: TCGPlayer] ──┐
               [Worker 2: CardMarket]  ├──→ [Price Repository]
               [Worker 3: Liga Magic]  │      ↓
                                     [Opportunity Queue]
                                          ↓
                                   [Analyzer Worker]
                                          ↓
                                   ├─→ [Price History]
                                   ├─→ [Alert Queue] → [Notification Service] → [Telegram]
                                   └─→ [Cache Update] → [Redis]
```

### Notification Flow

```
[Opportunity Detected]
    ↓
[Event Published] → [Notification Queue]
    ↓                ↓
[User Preferences Check] → [Filtered Notifications]
    ↓
[Telegram Bot API] → [User Receives Message]
```

### Key Data Flows

1. **Price Collection Flow:**
   - Scheduler triggers Bull jobs for each source every 8-12 hours
   - Workers fetch prices concurrently with source-specific rate limits
   - Raw prices stored in PostgreSQL with partitioning by time
   - Opportunity detection job queued for each updated card
   - Redis cache updated with latest prices for quick reads

2. **Opportunity Detection Flow:**
   - Triggered by new price data arrival
   - Analyzes: price drop % + historical average + popularity
   - Generates alerts if conditions match user preferences
   - Pushes notification job to queue

3. **User Query Flow:**
   - Web dashboard requests price history
   - API checks Redis cache first
   - Cache miss → Query PostgreSQL with date range
   - Results cached for future requests

4. **Notification Flow:**
   - Opportunity detector publishes alert event
   - Notification worker checks user preferences
   - Filters by user's wishlist and notification settings
   - Sends Telegram messages via bot API
   - Logs notification history for analytics

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single monolithic API, single PostgreSQL instance, Redis for cache, cron-based scheduler |
| 1k-100k users | Separate scraper workers, database read replicas, queue-based scheduler, CDN for static assets |
| 100k+ users | Microservices with API Gateway, distributed scraping nodes, timeseries DB specialization, horizontal pod autoscaling |

### Scaling Priorities

1. **First bottleneck: Scraper rate limits**
   - Distribute scraping across multiple workers/nodes
   - Implement proxy rotation for web scraping
   - Use priority queues for user wishlist vs general monitoring
   - Cache external API responses when possible

2. **Second bottleneck: Time-series database queries**
   - Implement PostgreSQL partitioning by time (monthly partitions)
   - Add read replicas for dashboard queries
   - Archive old data to columnar storage or cold storage
   - Use Redis for hot data (recent prices)

3. **Third bottleneck: Notification delivery**
   - Batch Telegram messages to respect API limits
   - Implement notification queue with retry logic
   - Consider sharding by user groups for massive scale

### Performance Optimization Strategies

- **Database Indexing:**
  ```sql
  -- Composite index for card price history queries
  CREATE INDEX idx_price_card_time ON prices (card_id, recorded_at DESC);

  -- Index for opportunity detection (price trend queries)
  CREATE INDEX idx_price_source_time ON prices (source, recorded_at DESC);

  -- Partial index for active wishlist cards
  CREATE INDEX idx_wishlist_active
    ON wishlist_items (card_id, user_id)
    WHERE active = true;
  ```

- **Caching Strategy:**
  ```typescript
  // Cache latest prices for 5 minutes
  await redis.setex(
    `price:${cardId}:${source}`,
    300,
    JSON.stringify(priceData)
  );

  // Cache user wishlist for 1 hour
  await redis.setex(
    `wishlist:${userId}`,
    3600,
    JSON.stringify(wishlistItems)
  );
  ```

- **Query Optimization:**
  ```typescript
  // Use partitioned queries for historical data
  // Only scan relevant partitions
  const prices = await this.priceRepo.find({
    where: {
      cardId,
      recordedAt: Between(startDate, endDate)
    },
    order: { recordedAt: 'DESC' }
  });
  ```

## Anti-Patterns

### Anti-Pattern 1: Synchronous Scraping in API Requests

**What people do:** Calling scraper functions directly from API endpoints when user requests price data.

**Why it's wrong:**
- Blocks API response while scraping (seconds to minutes)
- No rate limit control across concurrent users
- Scraping failure crashes API request
- Can't retry failed scrapes independently

**Do this instead:**
```typescript
// BAD: Synchronous scraping
@Get('cards/:id/price')
async getPrice(@Param('id') cardId: string) {
  const price = await this.scraper.scrape(cardId); // Blocks!
  return price;
}

// GOOD: Async queue with cache
@Get('cards/:id/price')
async getPrice(@Param('id') cardId: string) {
  // Return cached data immediately
  const cached = await this.redis.get(`price:${cardId}`);
  if (cached) return JSON.parse(cached);

  // Trigger background refresh if stale
  await this.priceQueue.add('refresh', { cardId });
  return this.getCachedPrice(cardId);
}
```

### Anti-Pattern 2: Monolithic Scraper Module

**What people do:** One giant scraper module that handles all sources with deeply nested conditionals.

**Why it's wrong:**
- Impossible to test individual sources
- Source-specific rate limiting is difficult
- One source failure can crash entire module
- Hard to add/remove sources

**Do this instead:**
```typescript
// GOOD: Separate adapters per source
interface PriceSourceAdapter {
  fetchPrices(cardIds: string[]): Promise<PriceData[]>;
}

class TCGPlayerAdapter implements PriceSourceAdapter { }
class CardMarketAdapter implements PriceSourceAdapter { }
class LigaMagicAdapter implements PriceSourceAdapter { }

// Orchestration service coordinates
class PriceCollectorService {
  constructor(
    private sources: PriceSourceAdapter[],
    private limiter: RateLimiter
  ) {}

  async collectFromAll(cardIds: string[]) {
    const results = await Promise.allSettled(
      this.sources.map(source => source.fetchPrices(cardIds))
    );
    return this.aggregateResults(results);
  }
}
```

### Anti-Pattern 3: No Partitioning for Time-Series Data

**What people do:** Storing all price history in a single table without partitioning.

**Why it's wrong:**
- Query performance degrades as data grows
- Expensive VACUUM operations on large tables
- Can't easily archive old data
- Index bloat slows down inserts

**Do this instead:**
```sql
-- GOOD: Partition by time range
CREATE TABLE prices (
  id BIGSERIAL,
  card_id VARCHAR(255) NOT NULL,
  price_cents INTEGER NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create partitions automatically
CREATE TABLE prices_2026_03 PARTITION OF prices
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### Anti-Pattern 4: Ignoring Rate Limits Until Blocked

**What people do:** Making as many requests as possible until getting 429 errors or IP banned.

**Why it's wrong:**
- Disrupts service when blocked
- Poor reputation with data sources
- Can't guarantee data freshness
- May violate ToS

**Do this instead:**
```typescript
// GOOD: Proactive rate limiting
class RateLimitedScraper {
  private limiter = new TokenBucketRateLimiter({
    capacity: 10,      // Max 10 requests
    refillRate: 1      // 1 request per second
  });

  async scrape(url: string) {
    await this.limiter.waitForToken();
    return axios.get(url);
  }
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Liga Magic** | Web scraping + rate limiting | No public API; use Puppeteer/Playwright |
| **TCGPlayer API** | REST API with authentication | Requires API key; implement token bucket rate limiter |
| **CardMarket API** | REST API with OAuth | Has rate limits; implement exponential backoff |
| **CardKingdom** | Web scraping | Check for API availability first |
| **Telegram Bot API** | Webhook or polling | Webhook preferred for real-time; use queue for message batching |
| **Exchange Rate APIs** | Cached REST calls | Cache rates for 1 hour; fallback to multiple providers |
| **Scryfall API** | REST API for card data | Generous rate limits; cache card metadata locally |
| **MTGTop8 / EDHREC** | Web scraping for metagame | Low frequency (daily/weekly) sufficient |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **API ↔ Scraper Workers** | Bull Queue (Redis) | Async job processing, retry logic, priority queues |
| **Scraper ↔ Opportunity Detector** | Bull Queue (Redis) | Event-driven: new price data triggers analysis |
| **Detector ↔ Notification Service** | Bull Queue (Redis) | Decouples detection from delivery |
| **Web Dashboard ↔ API** | REST (Fast HTTP) | Standard HTTP/JSON, consider GraphQL for complex queries |
| **Telegram Bot ↔ API** | REST (Fast HTTP) | Bot acts as API client with user token authentication |
| **All Services ↔ Database** | Connection pool | Use PgBouncer for connection pooling in production |

### Build Order Dependencies

```
Phase 1: Foundation
├── Database schema & migrations
├── Shared types package
├── Configuration setup
└── Authentication infrastructure

Phase 2: Core Data Collection
├── Price source adapters (one at a time)
├── Scraper scheduler
├── Price repository with partitioning
└── Currency converter

Phase 3: Intelligence
├── Opportunity detection engine
├── Alert generation logic
└── User preference management

Phase 4: User Interface
├── Web dashboard (basic views)
├── Telegram bot (basic commands)
└── User wishlist management

Phase 5: Enhancement
├── Advanced analytics & charts
├── Bot command expansion
└── Performance optimization
```

## Security Considerations

### API Security
- JWT-based authentication for web dashboard
- API key authentication for Telegram bot
- Rate limiting per user/IP
- HTTPS only in production
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

### Data Security
- Encrypt sensitive user data at rest
- Secure credential management (environment variables, secrets manager)
- Audit logging for user actions
- Regular security updates for dependencies

### External API Security
- Never expose external API keys to frontend
- Rotate API keys regularly
- Implement circuit breakers for failing external services
- Mask card numbers and sensitive data in logs

## Sources

### Web Scraper Scheduler Architecture
- [定时爬虫任务调度实战：用APScheduler或crontab定时抓取](https://m.blog.csdn.net/shanwei_spider/article/details/149109202)
- [玩转 webmagic 代码之 Scheduler](https://my.oschina.net/flashsword/blog/155961)
- [Python爬虫系列教程之爬虫项目部署、调度与监控系统](https://m.blog.csdn.net/qq_53762188/article/details/145768553)
- [PySpider Architecture and Design](https://www.jianshu.com/p/caea3ca21a2a)

### Time Series Data Storage
- [postgresql时间序列如何高效存储_postgresql时序建模技巧](https://m.php.cn/faq/1775394.html)
- [使用 pg_partman 扩展管理 PostgreSQL 分区](https://docs.aws.amazon.com/zh_cn/AmazonRDS/latest/AuroraUserGuide/PostgreSQL_Partitions.html)
- [怎样在 PostgreSQL 中优化对时间序列数据的存储和查询策略？](https://m.blog.csdn.net/zenson_g/article/details/140393459)
- [PostgreSQL中的大容量空间探索时间序列数据存储](https://cloud.tencent.com/developer/article/2074913)

### Multi-Source Data Aggregation
- [API Aggregation: Combining Multiple APIs - API7.ai](https://api7.ai/learning-center/api-101/api-aggregation-combining-multiple-apis)
- [Assembler: 多源数据聚合的解决方案](https://m.blog.csdn.net/gitblog_00587/article/details/145131286)
- [API聚合黑科技：百万接口一键归并，准确率99.9%](https://blog.csdn.net/SR_DFGP/article/details/155858651)

### Opportunity Detection & Alert Systems
- [RPA实战｜Temu价格监控自动化！秒级捕捉价格波动](https://m.blog.csdn.net/Ruanjianwang888/article/details/156024714)
- [智能购物利器：爱比价格跟踪器v1.078全面解析](https://m.blog.csdn.net/weixin_29496633/article/details/155439251)
- [Pricetrack：实现自动化价格监控与提醒系统](https://wenku.csdn.net/doc/6o9vb8669k)

### Event-Driven Architecture & Trading Systems
- [Hummingbot事件驱动交易：响应市场事件的自动化策略](https://m.blog.csdn.net/gitblog_00830/article/details/151428712)
- [Hummingbot事件驱动架构：理解机器人核心运行机制](https://m.blog.csdn.net/gitblog_00796/article/details/151083927)
- [事件驱动算法交易](https://blog.csdn.net/fengidea/article/details/142654127)
- [Botvana - Event-driven trading platform](https://github.com/featherenvy/botvana)

### Currency Conversion Service Architecture
- [基于Web的在线货币兑换平台系统设计与实现](https://blog.csdn.net/weixin_35696112/article/details/152456104)
- [跨境支付货币汇率转换助手](https://learnku.com/articles/88703?order_by=vote_count)
- [国际货币汇率转换API参考](https://juejin.cn/post/7435863055801778187)

### Node.js TypeScript Monorepo Best Practices
- [pnpm+ts-monorepo完美组合：解决TypeScript monorepo依赖管理难题](https://m.blog.csdn.net/gitblog_00702/article/details/141046780)
- [ts-monorepo项目结构深度解析：如何优雅管理多应用与共享包](https://m.blog.csdn.net/gitblog_00089/article/details/139285920)
- [2025 最强 TypeScript Monorepo 指南：从 0 到 1 构建企业级代码架构](https://m.blog.csdn.net/gitblog_01152/article/details/144236310)

### Web Dashboard Authentication
- [Web Dashboard Authentication Architecture Best Practices](https://m.blog.csdn.net/weixin_34216107/article/details/91665483)
- [Multi-User & Role-Based Access Control](https://docs.aws.amazon.com/zh_cn/AmazonRDS/latest/AuroraUserGuide/PostgreSQL_Partitions.html)

---
*Architecture research for: MTG Price Monitoring System*
*Researched: 2026-03-05*
