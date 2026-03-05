# Project Research Summary

**Project:** MTG Price Monitor
**Domain:** Price monitoring system for Magic: The Gathering cards
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

This is a **price monitoring and alert system** for Magic: The Gathering cards, focused on the Brazilian market. Experts build these systems as **event-driven architectures** with async job queues, multi-source data collection (API + web scraping), time-series optimized databases, and dual interfaces (web dashboard + messaging bot). The system monitors prices 2-3x daily, detects opportunities (price drops below historical average), and sends notifications via Telegram.

The recommended approach is **Python + FastAPI + PostgreSQL/TimescaleDB + Scrapy + python-telegram-bot**, with careful attention to rate limiting, currency conversion including IOF (6.38% credit card tax), and proper card version tracking. The architecture should be modular with separate adapters for each price source, using message queues (Redis/Bull) for async processing, and implementing time-series partitioning for efficient historical data storage.

**Key risks:** API rate limits (Scryfall bans IPs), alert fatigue (40% user churn), legal/ToS violations from scraping, time-series database bloat, and incorrect currency conversion without IOF. Mitigation involves proactive rate limiting, notification batching with smart thresholds, legal review before scraping, data retention policies, and transparent fee disclosure. Critical differentiator: **Brazilian market focus with Liga Magic + IOF-inclusive pricing** — no major competitor addresses this.

## Key Findings

### Recommended Stack

Python 3.11+ ecosystem dominates web scraping and time-series analysis. FastAPI provides 3-5x better performance than Flask with native async. PostgreSQL + TimescaleDB extension offers 65% storage cost reduction vs InfluxDB with full SQL compatibility. APScheduler handles 2-3x daily checks without Celery's complexity. Scrapy + Playwright handles both static and JavaScript-heavy sites.

**Core technologies:**
- **Python 3.11+** — Backend language — Best-in-class scraping (Scrapy), data processing (pandas), async (APScheduler)
- **FastAPI 0.115+** — Web framework — 3-5x faster than Flask, native async, automatic OpenAPI docs
- **PostgreSQL 16+ + TimescaleDB 2.15+** — Time-series database — 65% lower storage vs InfluxDB, full SQL, optimized time-series queries
- **Scrapy 2.11+ + Playwright 1.41+** — Web scraping — Built-in concurrency, throttling, retry; 40% faster than Selenium
- **python-telegram-bot 22.6+** — Telegram integration — Fully async, Bot API 7.9 support, vibrant community
- **APScheduler 3.10.4+** — Scheduled jobs — Lightweight scheduling for 2-3x daily checks, no message broker needed

### Expected Features

**Must have (table stakes):**
- **Wishlist Management** — Users expect to add/remove cards to track
- **Price Alerts (Telegram)** — Core value: notify when prices drop
- **Multi-Source Price Tracking** — Compare across TCGPlayer, CardMarket, Liga Magic
- **Historical Price Charts** — Visual trends (7d, 30d, 90d) for informed decisions
- **Currency Conversion (USD→BRL with IOF)** — Brazilian users need landed cost (6.38% tax)
- **User Authentication** — Personalized wishlists and alert delivery

**Should have (competitive):**
- **Automatic Format-Based Monitoring** — Auto-add top cards from MTGTop8/EDHREC (major differentiator)
- **Opportunity Detection Algorithm** — Price dropped + below historical average (smarter than simple thresholds)
- **Collection Value Tracking** — Portfolio worth over time
- **Dual Interface (Web + Telegram)** — Flexibility for different use cases

**Defer (v2+):**
- **Camera Card Scanning** — Nice UX improvement, manual search works for MVP
- **Price Prediction (ML)** — High complexity, questionable accuracy
- **Real-Time Updates** — API rate limits make this impractical; 2-3x daily catches opportunities
- **Social Features** — Not core value prop, scope creep risk

### Architecture Approach

Event-driven architecture with message queues for decoupled components. Separate adapters for each price source (Liga Magic, TCGPlayer, CardMarket) normalize data. Time-series partitioning by month optimizes historical queries. Rate limiting with token bucket algorithm prevents API blocks. Opportunity detection triggers notification queue, which batches Telegram messages to respect rate limits.

**Major components:**
1. **Scraper Scheduler** — Coordinates periodic price collection (2-3x/day) via APScheduler
2. **Data Collector** — Multi-source aggregation via adapter pattern (TCGPlayer API, Liga Magic scraping)
3. **Opportunity Detector** — Analyzes price drops + historical averages via rule engine
4. **Notification Service** — Sends batched Telegram alerts via python-telegram-bot
5. **Currency Converter** — USD/EUR → BRL with 6.38% IOF for credit card purchases
6. **User Service** — Authentication, wishlist management via JWT + PostgreSQL
7. **Web Dashboard** — Price history, configuration UI via FastAPI + Plotly
8. **Telegram Bot** — Command-based user interactions via python-telegram-bot

### Critical Pitfalls

**API Rate Limiting** — Scryfall explicitly warns: excessive requests result in IP bans. Implement 50-100ms delays, use bulk data, cache 24h, monitor 429 errors.

**Alert Fatigue** — 40% of users abandon apps after poor notification experience. Require multiple conditions (price dropped X% + below average + sustained Y days), batch alerts 2-3x daily, allow customization.

**Legal/ToS Violations** — Scraping without permission can lead to cease & desist. Always check robots.txt AND Terms of Service, prefer APIs, obtain written permission for commercial scraping.

**Wrong Card Version** — MTG has same card across dozens of sets with wildly different values. Always use unique identifiers (Scryfall oracle_id, set + collector number), never name-only matching.

**Currency Conversion Without IOF** — International prices appear 6.38% too cheap without IOF tax. Always add IOF to USD/EUR → BRL conversions, clearly display "Price with IOF included."

**Time Series Bloat** — 1,000 cards × 4 sources × 3 checks/day × 365 days = 4.4M rows/year. Use TimescaleDB or PostgreSQL partitioning, implement retention (raw 90 days, aggregate older), downsample automatically.

**Telegram Rate Limits** — 100 requests/60 seconds limit means batch sends fail during price drops. Implement message queue, rate limit to 90/min, batch multiple cards per message.

**Scraping Layout Changes** — Website redesigns break hard-coded CSS selectors. Use adaptive scraping, content-based extraction, monitor success rates, prefer APIs when available.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Infrastructure
**Rationale:** Must address critical pitfalls before data collection begins. Rate limiting, legal compliance, and database design cannot be retrofitted easily.

**Delivers:**
- Database schema with time-series partitioning (PostgreSQL + TimescaleDB)
- Shared types and configuration packages
- Rate limiting infrastructure (token bucket algorithm)
- Legal/ToS review completed for all sources
- Authentication system (JWT)

**Addresses:** User Authentication, Currency Conversion Infrastructure

**Avoids:** API Rate Limiting (Phase 1), Legal/ToS Violations (Phase 0), Time Series Bloat (Phase 1), Wrong Card Version (Phase 1)

**Stack elements:** Python 3.11+, FastAPI, PostgreSQL 16+, TimescaleDB 2.15+

### Phase 2: Core Data Collection
**Rationale:** Cannot build features or detect opportunities without reliable price data. Multi-source adapters enable data independence and testability.

**Delivers:**
- Price source adapters (TCGPlayer, Liga Magic) with unified interface
- Scraper scheduler (APScheduler, 2-3x daily)
- Currency converter with IOF (6.38%)
- Price repository with partitioning
- Data retention and cleanup policies
- Redis caching for API responses

**Addresses:** Multi-Source Price Tracking, Currency Conversion (USD→BRL with IOF)

**Uses:** Scrapy 2.11+, Playwright 1.41+, httpx 0.27+, APScheduler 3.10.4+, Redis 7.2+

**Implements:** Adapter Pattern, Repository Pattern with Time-Series Partitioning, Rate Limiting with Token Bucket

**Avoids:** Scraping Layout Changes (adaptive scraping, API preference), Currency Conversion Without IOF

### Phase 3: Opportunity Detection & Notification System
**Rationale:** Alert infrastructure must be built before first user notification to prevent alert fatigue and Telegram rate limit issues.

**Delivers:**
- Opportunity detection engine (price drop + historical average)
- Alert generation logic with smart thresholds
- Notification queue (Redis/Bull) with batching
- Telegram bot integration (python-telegram-bot)
- User preference management (thresholds, quiet hours)
- Notification rate limiting (90 requests/minute)

**Addresses:** Price Alerts (Telegram), Opportunity Detection Algorithm

**Uses:** python-telegram-bot 22.6+, pandas 2.2+, NumPy 1.26+

**Implements:** Event-Driven Architecture with Message Queues

**Avoids:** Alert Fatigue (batching, smart thresholds), Telegram Rate Limits (queue with rate limiter)

### Phase 4: User Interfaces & Wishlist Management
**Rationale:** Now that data collection and alerting work, build user-facing features. Dual interface (web + Telegram) provides flexibility.

**Delivers:**
- Web dashboard with price history charts (FastAPI + Plotly)
- Telegram bot commands (add/remove cards, check prices)
- Wishlist management (web + Telegram)
- Card search with version selection (oracle_id, set, collector number)
- Historical price visualization (7d, 30d, 90d, all-time)

**Addresses:** Wishlist Management, Historical Price Charts, Card Search/Identification

**Uses:** Plotly 5.18+, FastAPI 0.115+, python-telegram-bot 22.6+

**Implements:** Repository Pattern, Time-Series optimized queries with Redis caching

**Avoids:** Wrong Card Version (unique identifiers, card preview images)

### Phase 5: Intelligence & Automation
**Rationale:** After validating manual wishlist usage, add automation to reduce user friction. Depends on reliable metagame data integration.

**Delivers:**
- Automatic format-based monitoring (MTGTop8, EDHREC integration)
- Collection value tracking
- Advanced alert configuration (per-card thresholds, time-based)
- Portfolio trend analysis
- Enhanced dashboard with analytics

**Addresses:** Automatic Format-Based Monitoring, Collection Value Tracking, Opportunity Detection Algorithm (enhanced)

**Uses:** Scrapy (for MTGTop8/EDHREC), pandas (trend analysis)

**Research needed:** Metagame API availability, format-specific card popularity algorithms

### Phase 6: Polish & Optimization
**Rationale:** Performance and UX improvements after core functionality is stable.

**Delivers:**
- Performance optimization (query tuning, additional caching)
- Enhanced bot command expansion
- Monitoring and alerting for system health
- Documentation improvements
- User feedback incorporation

**Addresses:** UX enhancements, performance improvements

**Defers to v2+:** Camera Card Scanning, Price Prediction (ML), Real-Time Updates, Social Features

### Phase Ordering Rationale

**Why this order:**
1. **Foundation first** — Database, rate limiting, and legal compliance are prerequisites for everything. Cannot be retrofitted.
2. **Data before features** — Must collect prices reliably before detecting opportunities or building UIs.
3. **Notifications before users** — Alert infrastructure prevents fatigue and rate limit issues from day one.
4. **Manual before automatic** — Validate manual wishlist usage before investing in format-based automation.
5. **Core before polish** — Performance and UX improvements wait until functionality is stable.

**Why this grouping:**
- Phases 1-2 address all **critical pitfalls** (rate limits, legal, IOF, card versions, database bloat)
- Phases 3-4 deliver **complete MVP** with table stakes features
- Phases 5-6 add **competitive differentiators** and polish

**How this avoids pitfalls:**
- Phase 1 prevents legal issues and infrastructure failures
- Phase 2 prevents data collection problems and currency errors
- Phase 3 prevents alert fatigue and notification failures
- Phase 4 prevents UX issues (wrong card versions, no context)

### Research Flags

**Phases likely needing deeper research during planning:**

- **Phase 2 (Data Collection):** Liga Magic API availability — may require web scraping only. Verify robots.txt and ToS before implementation. TCGPlayer API pricing and rate limits need verification.

- **Phase 3 (Opportunity Detection):** Algorithm tuning — "below historical average" threshold requires research. What % drop constitutes opportunity? How many days of history needed? Research competitor algorithms or run A/B tests.

- **Phase 5 (Automation):** MTGTop8 and EDHREC API availability — both may require scraping. Verify metagame data accessibility. Format-specific "staple" detection logic needs domain expertise or ML approach.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** PostgreSQL + TimescaleDB setup is well-documented. JWT authentication is standard pattern. Rate limiting with token bucket is established algorithm.

- **Phase 4 (User Interfaces):** FastAPI + Plotly dashboard is standard stack. python-telegram-bot has excellent documentation. Card search with Scryfall API is straightforward.

- **Phase 6 (Polish):** Performance optimization, monitoring, and documentation are standard engineering practices with abundant resources.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified with official docs (Scryfall, FastAPI, python-telegram-bot, TimescaleDB). Python ecosystem dominance in scraping is well-established. |
| Features | MEDIUM | Table stakes based on comprehensive competitor analysis (MTGGoldfish, TCGplayer, Leviathan, ManaBox). Differentiators (Brazilian focus, Telegram bot) are unvalidated but logical. |
| Architecture | HIGH | Event-driven architecture, adapter pattern, time-series partitioning are standard patterns for this domain. Verified against multiple 2025-2026 sources. |
| Pitfalls | HIGH | API rate limits from official Scryfall docs. Alert fatigue research verified. Legal/ToS guidance from multiple legal sources. IOF requirement from project docs. |

**Overall confidence:** HIGH

Stack and architecture are rock-solid. Pitfalls are well-documented. Features are based on thorough competitor analysis. Only uncertainty is around specific API availabilities (Liga Magic, MTGTop8, EDHREC) and algorithm tuning for opportunity detection.

### Gaps to Address

**Liga Magic integration approach:**
- Gap: Unknown if Liga Magic has official API or requires scraping only
- Handling: Phase 2 planning should include `/gsd:research-phase` for Liga Magic. Verify robots.txt, ToS, and contact for API access before implementing scrapers.

**Opportunity detection algorithm thresholds:**
- Gap: Unknown optimal thresholds for "below historical average" detection
- Handling: Start with conservative defaults (e.g., 15% drop + below 30-day average). Plan for A/B testing in Phase 5. Monitor alert engagement metrics and adjust.

**Metagame data availability (Phase 5):**
- Gap: Unknown if MTGTop8/EDHREC have APIs or require scraping
- Handling: Phase 5 planning should include `/gsd:research-phase` for metagame sources. May need to negotiate API access or implement adaptive scraping.

**IOF calculation accuracy:**
- Gap: Need to verify 6.38% IOF is still current rate in 2026
- Handling: Verify with Brazilian Central Bank or financial institution before Phase 1. Document rate and date of verification in codebase.

**Scraping legal compliance:**
- Gap: Specific ToS for Liga Magic, CardKingdom not yet reviewed
- Handling: Phase 0 pre-research should document legal review for each source. Prefer APIs, obtain written permission for scraping, document compliance evidence.

## Sources

### Primary (HIGH confidence)
- [Scryfall API Documentation](https://scryfall.com/docs/api) — Rate limits, bulk data, card objects, data usage guidelines
- [python-telegram-bot v21.5 Documentation](https://docs.python-telegram-bot.org) — Bot API 7.9, async support, rate limits
- [FastAPI Documentation](https://fastapi.tiangolo.com) — Benchmarks, async support, automatic OpenAPI
- [TimescaleDB Documentation](https://docs.timescale.com) — Hypertables, continuous aggregations, partitioning
- [Scrapy Documentation](https://docs.scrapy.org) — Built-in concurrency, throttling, retry logic
- [Playwright Documentation](https://playwright.dev) — Browser automation, headless mode, Shadow DOM support

### Secondary (MEDIUM confidence)
- [Web Scraping Legal Issues 2026](https://m.blog.csdn.net/shanwei_spider/article/details/156516332) — ToS compliance, robots.txt, commercial scraping legality
- [Notification Fatigue Research](https://www.woshipm.com/pd/5454417.html) — 40% user churn, batching strategies
- [Time Series Database Best Practices](https://m.blog.csdn.net/gitblog_00798/article/details/153854438) — Data retention, downsampling, partitioning
- [TimescaleDB vs InfluxDB 2025](https://m.blog.csdn.net/liumangtuzi888/article/details/154403509) — Storage costs, query performance, SQL support
- [APScheduler vs Celery 2025](https://blog.csdn.net/gitblog_00918/article/details/154099206) — Use cases, complexity tradeoffs
- [Flask vs FastAPI 2025](https://fastapi.tiangolo.com/benchmarks/) — Performance comparison, async support
- [Scrapy-Playwright Best Practices 2025](https://m.blog.csdn.net/gitblog_00678/article/details/154012125) — Integration patterns, configuration

### Tertiary (LOW confidence)
- [MTG Scanner Apps Comparison](https://apps.apple.com/cn/app/card-value-identifier-cardly/id6747571942) — Feature analysis, needs verification with actual apps
- [Currency Conversion APIs Brazil](https://www.cnblogs.com/mm12/p/19543543) — Exchange rate APIs, needs verification with Banco Central official docs
- [MTG Card Identification Best Practices](https://apps.apple.com/cn/app/card-value-identifier-cardly/id6747571942) — Version tracking, needs verification with Scryfall docs
- Competitor websites (MTGGoldfish, TCGplayer, Leviathan, ManaBox) — Feature analysis via public docs, needs verification with actual products

### Domain Sources
- **MTGGoldfish Premium** — Unlimited price alerts ($6/month), collection tracking, price history
- **MTGTop8** — Metagame data for tournament formats
- **EDHREC** — Commander format popularity and deck data
- **TCGPlayer** — US marketplace with API
- **CardMarket** — European marketplace with API
- **Liga Magic** — Brazilian card marketplace (API availability unknown)
- **CardKingdom** — US card retailer (API availability unknown)
- **Banco Central do Brasil** — Official USD/EUR → BRL exchange rates

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
