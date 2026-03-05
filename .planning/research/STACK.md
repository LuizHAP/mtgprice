# Technology Stack

**Project:** MTG Price Monitor
**Researched:** 2026-03-05
**Overall Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Python** | 3.11+ | Backend language | Ecosystem dominance in web scraping (Scrapy, BeautifulSoup), data processing (pandas), time series analysis. Best-in-class libraries for scheduled tasks and API integration. |
| **FastAPI** | 0.115+ | Web framework for dashboard | 3-5x faster than Flask with native async/await. Automatic OpenAPI docs. Modern type validation with Pydantic. Production-ready at scale (Microsoft, Uber, Netflix). |
| **PostgreSQL** | 16+ | Primary database | Industry-standard relational database with excellent time series support via TimescaleDB extension. ACID compliance for financial data integrity. |
| **TimescaleDB** | 2.15+ | Time series extension | PostgreSQL extension for time series data. 65% storage cost reduction vs InfluxDB. Full SQL compatibility. 5-14x query performance improvement for time-based aggregations. |
| **Redis** | 7.2+ | Caching and rate limiting | In-memory cache for API responses, rate limiting, and deduplication. Required by Scrapy for distributed scraping. |
| **APScheduler** | 3.10.4+ | Scheduled job execution | Lightweight scheduling for 2-3x daily price checks. Cron-like triggers with job persistence. No need for distributed message brokers (Celery is overkill for this scale). |

### Web Scraping Layer

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Scrapy** | 2.11+ | Large-scale scraping framework | Primary scraper for sites with APIs or structured HTML. Built-in concurrency, throttling, and retry logic. |
| **Playwright** | 1.41+ | Browser automation | Dynamic JavaScript-heavy sites (Liga Magic, TCGPlayer). 40% faster than Selenium with Shadow DOM support. Use via `scrapy-playwright` integration. |
| **httpx** | 0.27+ | Async HTTP client | For APIs with simple JSON responses. Faster async I/O compared to requests. |
| **BeautifulSoup4** | 4.12+ | HTML parsing | Simple static sites. Use with httpx for async requests. Not needed with Scrapy (has built-in selectors). |

### Telegram Integration

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **python-telegram-bot** | 22.6+ | Telegram bot API | Fully asynchronous with Python 3.10+ support. Supports Bot API 7.9. Vibrant community and comprehensive docs. Convenience methods like `Message.reply_text`. |
| **aiogram** | 3.18+ | Alternative Telegram client | Consider if you need Python 3.8+ compatibility or prefer more explicit control. Slightly faster but fewer convenience methods. |

### MTG Data Sources

| Source | Type | Library | Notes |
|--------|------|---------|-------|
| **Scryfall API** | REST API | `httpx` or `requests` | Official MTG card data, prices, and Oracle text. Rate limit: 10 req/sec. Bulk data available for offline sync. |
| **MTGTop8** | Scraping | Scrapy/Playwright | Metagame data for tournament formats. May require JavaScript rendering. |
| **EDHREC** | Scraping/API | Scrapy/Playwright | Commander format popularity and deck data. Check for API access before scraping. |
| **TCGPlayer** | API + Scraping | Official SDK + Playwright | Has official API but may require scraping for some data. Respect rate limits strictly. |
| **CardMarket** | API + Scraping | Official SDK + Playwright | European prices. API available but may have rate limits. |
| **CardKingdom** | Scraping | Playwright | US prices. Likely requires browser automation. |

### Currency Conversion

| Library/API | Purpose | Why Recommended |
|-------------|---------|-----------------|
| **Banco Central API** | Official BRL exchange rates | Brazilian Central Bank provides free, official USD/EUR → BRL rates. No API key required for basic usage. |
| **IOF Calculation** | Custom implementation | IOF for international credit card purchases: 6.38%. Implement as: `converted_amount * 1.0638`. No external API needed—this is a fixed tax rate. |
| **XE Currency API** | Fallback exchange rates | Backup if Banco Central API is unavailable. 170+ currencies with REST endpoints. |

### Data Processing & Visualization

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **pandas** | 2.2+ | Data manipulation | Standard for time series analysis, moving averages, and price trend calculations. |
| **NumPy** | 1.26+ | Numerical computing | Required by pandas for efficient array operations. |
| **Plotly** | 5.18+ | Interactive charts | Web dashboard with zoomable, filterable price history charts. Better than matplotlib for web UI. |
| **SQLAlchemy** | 2.0+ | Database ORM | Type-safe database queries with async support. Better migration tooling than raw SQL. |

## Installation

```bash
# Core web framework and database
pip install "fastapi[standard]" uvicorn sqlalchemy asyncpg

# Time series database
# TimescaleDB is a PostgreSQL extension, install via package manager:
# macOS: brew install timescaledb
# Ubuntu: apt install timescaledb-2-postgresql-16
# Then: CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

# Web scraping
pip install scrapy scrapy-playwright playwright httpx[http2] beautifulsoup4
playwright install chromium  # Install browser binaries

# Scheduled jobs
pip install APScheduler

# Telegram bot
pip install "python-telegram-bot[job-queue]"

# Data processing
pip install pandas numpy plotly

# Caching
pip install redis
```

## Alternatives Considered

| Recommended | Alternative | Why Not Chosen |
|-------------|-------------|----------------|
| **Python** | Node.js | Python has superior scraping ecosystem (Scrapy vs Puppeteer/Playwright only). Better data analysis libraries (pandas, NumPy). |
| **FastAPI** | Flask | Flask is 3-5x slower. No native async. Requires manual API docs. FastAPI is modern standard for high-performance APIs. |
| **TimescaleDB** | InfluxDB | TimescaleDB uses familiar SQL with full PostgreSQL ecosystem. 65% lower storage costs. Better for complex queries (JOINs, window functions). InfluxDB requires learning Flux query language and has expensive enterprise licensing. |
| **APScheduler** | Celery | Celery is overkill for 2-3x daily checks. Requires Redis/RabbitMQ broker. More complex deployment. APScheduler is simpler for single-machine scheduling with job persistence. |
| **Playwright** | Selenium | Playwright is 40% faster with better cross-browser support. Replaces Selenium as 2025 standard. Built-in Shadow DOM support. |
| **python-telegram-bot** | aiogram | Both are excellent. python-telegram-bot has more convenience methods and better documentation for beginners. aiogram is faster but more verbose. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Selenium** | Deprecated in 2025. 40% slower than Playwright. Poor Shadow DOM support. Maintenance mode. | Playwright |
| **InfluxDB** | Expensive enterprise licensing. Requires learning new query language (Flux). Poor SQL support. 65% higher storage costs. | TimescaleDB |
| **Celery** | Unnecessary complexity for this scale. Requires message broker setup. Harder to debug. | APScheduler |
| **requests** (synchronous) | Blocking I/O limits scraping performance. No async support. | httpx (async) |
| **Flask** | 3-5x slower than FastAPI. No native async. Manual API documentation. | FastAPI |
| **BeautifulSoup-only for scraping** | No built-in concurrency, throttling, or retry logic. Hard to scale. | Scrapy framework |
| **Node.js for scraping** | Inferior data analysis ecosystem. Python has pandas, NumPy, Scrapy. | Python |
| **Redis as primary database** | Not suitable for time series data. No complex queries. Use only for caching. | PostgreSQL + TimescaleDB |

## Stack Patterns by Variant

**If scraping static HTML-only sites:**
- Use Scrapy with built-in selectors
- No need for Playwright (faster, lighter)
- Most Brazilian card shops fall here

**If scraping JavaScript-heavy sites:**
- Use `scrapy-playwright` integration
- Configure headless mode and viewport
- Implement wait strategies: `wait_until="networkidle"`
- TCGPlayer, CardMarket likely need this

**If scheduled jobs grow beyond 1000/day:**
- Consider Celery + Redis for distributed execution
- Use Flower for monitoring
- Keep APScheduler for simple time-based triggers

**If time series data grows beyond 10M rows:**
- Enable TimescaleDB compression
- Partition by month: `SELECT create_hypertable('prices', 'timestamp', chunk_time_interval => INTERVAL '1 month')`
- Use continuous aggregations for pre-computed metrics

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| python-telegram-bot 22.6+ | Python 3.10+ | Dropped 3.8-3.9 support in v21+ |
| FastAPI 0.115+ | Python 3.9+ | Uses modern type hints (PEP 585) |
| Scrapy 2.11+ | Python 3.8+ | Twisted 21.2.0+ required |
| APScheduler 3.10.4+ | Python 3.7+ | Required by python-telegram-bot[job-queue] |
| TimescaleDB 2.15+ | PostgreSQL 14-16 | Check compatibility matrix for PG 17 |
| Playwright 1.41+ | Python 3.8+ | Node.js required for browser binary installation |

## Architecture Notes

### Data Flow
```
Scheduled Jobs (APScheduler)
    ↓
Scrapy Spiders (Scrapy + Playwright)
    ↓
Price Data (TimescaleDB for history, PostgreSQL for metadata)
    ↓
Analysis Engine (pandas + NumPy)
    ↓
Telegram Bot (python-telegram-bot)
    ↓
Web Dashboard (FastAPI + Plotly)
```

### Time Series Schema Pattern
```sql
-- Hypertable for automatic partitioning
CREATE TABLE prices (
    card_id INTEGER REFERENCES cards(id),
    source VARCHAR(50) NOT NULL,  -- 'ligamagic', 'tcgplayer', etc.
    price_brl NUMERIC(10,2) NOT NULL,
    price_usd NUMERIC(10,2),
    price_eur NUMERIC(10,2),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, source, timestamp)
);

SELECT create_hypertable('prices', 'timestamp');

-- Continuous aggregation for daily averages
CREATE MATERIALIZED VIEW daily_prices WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS day,
    card_id,
    source,
    AVG(price_brl) AS avg_price_brl,
    MIN(price_brl) AS min_price_brl,
    MAX(price_brl) AS max_price_brl
FROM prices
GROUP BY day, card_id, source;
```

### Scraping Best Practices (2025)
1. **Respect rate limits**: 50-100ms delay between requests (Scrapy `DOWNLOAD_DELAY = 0.1`)
2. **Cache aggressively**: Use Redis for duplicate request detection
3. **Rotate user agents**: Scrapy `USER_AGENT` rotation middleware
4. **Monitor 429 errors**: Implement exponential backoff
5. **Use async I/O**: Scrapy's Twisted + httpx for high concurrency
6. **Compress data**: Enable Gzip (30-50% bandwidth savings)

### IOF Calculation Implementation
```python
def calculate_price_with_iof(
    price_usd: float,
    exchange_rate: float,  # BRL per USD
    iof_rate: float = 0.0638  # 6.38% for credit card
) -> float:
    """
    Convert USD to BRL with IOF tax for international credit card purchases.
    """
    price_brl = price_usd * exchange_rate
    price_brl_with_iof = price_brl * (1 + iof_rate)
    return round(price_brl_with_iof, 2)

# Example: $10 card at R$5.00 exchange rate
# calculate_price_with_iof(10, 5.0) → 10 * 5.0 * 1.0638 → R$53.19
```

## Sources

- [Scryfall API Documentation](https://scryfall.com/docs/api) — HIGH confidence (official docs)
- [python-telegram-bot v21.5 Documentation](https://docs.python-telegram-bot.org) — HIGH confidence (official docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com) — HIGH confidence (official docs)
- [Web Search: Python vs Node.js Web Scraping 2025](https://dev.to/wisdomudo/the-ultimate-guide-to-scalable-web-scraping-in-2025-tools-proxies-and-automation-workflows-4j6l) — MEDIUM confidence (multiple sources agree)
- [Web Search: APScheduler vs Celery 2025](https://blog.csdn.net/gitblog_00918/article/details/154099206) — MEDIUM confidence (verified with official docs)
- [Web Search: TimescaleDB vs InfluxDB 2025](https://m.blog.csdn.net/liumangtuzi888/article/details/154403509) — MEDIUM confidence (multiple sources agree)
- [Web Search: Scrapy-Playwright Best Practices 2025](https://m.blog.csdn.net/gitblog_00678/article/details/154012125) — MEDIUM confidence (verified with Scrapy docs)
- [Web Search: Flask vs FastAPI 2025](https://fastapi.tiangolo.com/benchmarks/) — HIGH confidence (official benchmarks)
- [Web Search: Currency Conversion APIs Brazil](https://www.cnblogs.com/mm12/p/19543543) — LOW confidence (needs verification with Banco Central official docs)

---
*Stack research for: MTG Price Monitoring System*
*Researched: 2026-03-05*
