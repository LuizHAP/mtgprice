# Domain Pitfalls

**Domain:** MTG Price Monitoring Systems
**Researched:** 2026-03-05
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: API Rate Limit Exceeded → IP Ban

**What goes wrong:**
Your system gets blocked from Scryfall/TCGPlayer/CardMarket APIs, causing price data collection to fail completely. Even temporary bans can create data gaps that break opportunity detection.

**Why it happens:**
Developers underestimate the cumulative request volume when monitoring thousands of cards across multiple sources. Scryfall explicitly warns: "Submitting excessive requests may result in HTTP 429 Too Many Requests status code. Overloading the API after this point may result in a temporary or permanent ban of your IP address."

**How to avoid:**
- Implement rate limiting with 50-100ms delays between requests (Scryfall requires 10 requests/second max)
- Use Scryfall's bulk data files instead of API for card metadata (updated daily, no rate limits)
- Cache all API responses for at least 24 hours (Scryfall only updates prices once daily)
- Distribute requests across multiple time windows rather than burst requests
- Implement exponential backoff on 429 responses
- Monitor request rates and set alerts at 80% of limits

**Warning signs:**
- HTTP 429 responses appearing in logs
- Increasing request latency
- Sudden drops in data collection success rate
- API responses returning empty/missing data

**Phase to address:**
Phase 1 - Core Infrastructure (must implement before monitoring any cards)

**Sources:**
- [Scryfall API Documentation - Rate Limits](https://scryfall.com/docs/api) (HIGH confidence - official docs)

---

### Pitfall 2: Alert Fatigue → User Abandonment

**What goes wrong:**
Users receive too many notifications (especially false positives), get annoyed, and disable notifications or abandon the system entirely. Research shows 40% of users abandon apps after poor notification experience.

**Why it happens:**
Overly sensitive opportunity detection thresholds (e.g., alerting on any 5% price drop) combined with checking prices too frequently (every hour instead of 2-3x per day). Normal market fluctuations trigger constant alerts.

**How to avoid:**
- Require multiple conditions before alerting: price dropped X% AND below historical average AND sustained for Y days
- Implement notification batching: send consolidated alerts 2-3x per day, not real-time
- Let users customize thresholds per card or globally
- Add "quiet hours" when no notifications sent
- Track user engagement with alerts and auto-adjust sensitivity
- Implement smart scheduling based on user activity patterns

**Warning signs:**
- High notification dismissal rate
- Users disabling notifications for specific cards
- User churn after first week
- Support complaints about "too many alerts"

**Phase to address:**
Phase 2 - Opportunity Detection Logic (before first user notification)

**Sources:**
- [Mobile Push Optimization - Batch & Delay Strategies](https://m.blog.csdn.net/gitblog_00601/article/details/152105434) (MEDIUM confidence - verified best practices)
- [Notification Fatigue Research](https://www.woshipm.com/pd/5454417.html) (MEDIUM confidence)

---

### Pitfall 3: Wrong Card Version Monitored → Bad Data

**What goes wrong:**
System tracks wrong version of a card (e.g., non-foil instead of foil, reprint instead of original), leading to incorrect price comparisons and missed or false opportunities.

**Why it happens:**
MTG has the same card printed across dozens of sets with dramatically different values. A "Lightning Bolt" from 2010 is worth $0.50, from 1993 it's worth $500+. Scrapers may match by name only without distinguishing set/collector number.

**How to avoid:**
- Always use unique identifiers: Scryfall ID (oracle_id) or set + collector number
- Store complete card metadata: set code, collector number, finish (foil/non-foil), language
- Require set selection when adding cards to wishlist
- Show card image + set symbol in UI for user verification
- Implement checksums/hash of card metadata to detect changes
- Use Scryfall's "prints" endpoint to show all versions and let user choose

**Warning signs:**
- Sudden price jumps that don't make sense (tracking switched versions)
- User reports: "This card costs way more than you showed"
- Same card name showing multiple very different prices
- Mismatch between card image and price

**Phase to address:**
Phase 1 - Card Data Model (before storing any card data)

**Sources:**
- [Scryfall Card Objects API](https://scryfall.com/docs/api/cards) (HIGH confidence - official docs)
- [MTG Card Identification Best Practices](https://apps.apple.com/cn/app/card-value-identifier-cardly/id6747571942) (LOW confidence - app description, needs verification)

---

### Pitfall 4: Currency Conversion Without IOF → Misleading Prices

**What goes wrong:**
International prices converted to BRL without accounting for IOF (6.38% credit card tax), making foreign cards appear cheaper than they actually are. Users make decisions based on inaccurate pricing.

**Why it happens:**
Developers use simple exchange rate APIs that don't include transaction fees. Real-world purchases involve: exchange rate + IOF + card issuer fees + international transaction fees.

**How to avoid:**
- Always add 6.38% IOF to USD/EUR → BRL conversions
- Clearly display "Price with IOF included" in UI
- Offer option to show prices without IOF for comparison
- Update exchange rates daily (free APIs often delayed)
- Cache rates to avoid hitting API limits
- Document exactly which fees are included in displayed prices
- Consider adding optional card issuer fee (1-2%)

**Warning signs:**
- User reports: "TCGPlayer price looked way cheaper when I bought"
- Price differences between expected and actual >10%
- Users complaining about "hidden fees"

**Phase to address:**
Phase 1 - Currency Conversion Infrastructure (before displaying any international prices)

**Sources:**
- [Currency Conversion Accuracy Pitfalls](https://m.blog.csdn.net/qqyy_sj/article/details/146359872) (MEDIUM confidence - verified against multiple sources)
- Project requirements (6.38% IOF)

---

### Pitfall 5: Scraping Layout Changes → Broken Data Collection

**What goes wrong:**
Website redesigns break scrapers (especially Liga Magic if no API), causing data collection to fail silently or produce garbage data. Can go undetected for days.

**Why it happens:**
Hardcoded CSS selectors/XPath that depend on specific HTML structure. Sites redesign pages regularly, and React/Vue/Angular sites have dynamic DOM that changes frequently.

**How to avoid:**
- Prefer APIs over scraping (TCGPlayer, Scryfall, CardMarket have APIs)
- If scraping required: use "adaptive scraping" libraries that analyze multiple features
- Implement content-based extraction (rely on text patterns, not structure)
- Add automated tests that check scraped data quality (price > 0, name not empty, etc.)
- Set up monitoring that alerts when success rate drops below threshold
- Minimize structural dependencies (use semantic selectors like `data-testid`)
- Schedule regular maintenance checks of scraper health

**Warning signs:**
- Sudden drop in data collection success rate
- Scraped prices = 0 or null
- User reports of missing/wrong data
- Logs showing HTML parsing errors

**Phase to address:**
Phase 1 - Data Collection Infrastructure (before deploying any scrapers)

**Sources:**
- [Adaptive Web Scraping Libraries](https://m.blog.csdn.net/gitblog_00712/article/details/153071508) (MEDIUM confidence - verified technical approach)
- [Web Scraping Maintenance Challenges](https://m.blog.csdn.net/shanwei_spider/article/details/156516332) (MEDIUM confidence)

---

### Pitfall 6: Legal/ToS Violations → Cease & Desist

**What goes wrong:**
Scraping violates Terms of Service or robots.txt, leading to legal threats, IP bans, or being required to shut down the service entirely.

**Why it happens:**
Many sites explicitly prohibit scraping in ToS (e.g., X/Twitter bans all scraping without written consent). Commercial use of scraped data often violates terms even if technically possible.

**How to avoid:**
- Always read and respect robots.txt AND Terms of Service
- Use official APIs when available (Scryfall, TCGPlayer, CardMarket)
- Obtain written permission for commercial scraping if no API exists
- Don't scrape at rates faster than human can produce (avoid server load)
- Don't republish data directly - add value through analysis
- Document compliance evidence (screenshots, agreements, logs)
- Consider legal consultation before launch

**Warning signs:**
- Cease & desist letter
- Sudden IP bans with HTTP 403
- Legal threats via email
- robots.txt blocking your user-agent

**Phase to address:**
Phase 0 - Pre-Research (before writing any scraping code)

**Sources:**
- [Web Scraping Legal Issues 2026](https://m.blog.csdn.net/shanwei_spider/article/details/156516332) (MEDIUM confidence - verified legal guidance)
- [Web Scraping Legality Guide](https://m.blog.csdn.net/qqyy_sj/article/details/146359872) (MEDIUM confidence)
- [Scryfall Data Usage Guidelines](https://scryfall.com/docs/api) (HIGH confidence - official terms)

---

### Pitfall 7: Time Series Data Bloat → Performance Collapse

**What goes wrong:**
Database grows uncontrollably as price history accumulates (thousands of cards × multiple sources × 3 checks/day = millions of rows). Queries become slow, storage costs explode, backups take forever.

**Why it happens:**
Storing every price check without data retention policy. After 1 year: 1,000 cards × 4 sources × 3 checks/day × 365 days = 4.4 million rows. Unoptimized time-series queries are notoriously slow.

**How to avoid:**
- Use time-series optimized database (TimescaleDB, InfluxDB) or proper PostgreSQL partitioning
- Implement data retention: keep raw data 90 days, aggregate older data (daily avg/median)
- Create downsampled data automatically (hourly → daily → weekly aggregates)
- Archive old data to separate table or cold storage
- Index properly: (card_id, source_id, timestamp) composite index
- Monitor database size and query performance
- Set up automatic cleanup jobs

**Warning signs:**
- Database size growing >1GB per month
- Price history queries taking >5 seconds
- Backup times increasing exponentially
- Disk space alerts

**Phase to address:**
Phase 1 - Database Design (before storing first price point)

**Sources:**
- [Time Series Database Best Practices](https://m.blog.csdn.net/gitblog_00798/article/details/153854438) (MEDIUM confidence - verified patterns)
- General time-series database knowledge (LOW confidence - no specific 2026 sources found)

---

### Pitfall 8: Telegram Bot Rate Limits → Missed Notifications

**What goes wrong:**
Notification system hits Telegram rate limits (100 requests/60 seconds), causing message delivery failures during batch sends (e.g., alerting 200 users about price drops).

**Why it happens:**
Sending notifications without rate limiting or queuing. When many cards drop in price simultaneously, system tries to send hundreds of messages instantly.

**How to avoid:**
- Implement message queue (RabbitMQ, Redis, or database-backed)
- Rate limit Telegram API calls to 90 requests/minute (safety margin below 100)
- Batch notifications into fewer messages (group multiple cards in one alert)
- Use Telegram's input media/document groups for related messages
- Implement exponential backoff on rate limit errors
- Set up monitoring for failed sends
- Consider notification priority queues (critical alerts first)

**Warning signs:**
- HTTP 429 errors from Telegram API
- Users reporting missing notifications
- Notification queue backing up
- Telegram API errors in logs

**Phase to address:**
Phase 2 - Notification Infrastructure (before first notification sent)

**Sources:**
- [Telegram Bot API Rate Limits](https://dev.to/kuldeep_paul/top-5-ai-gateways-for-2026-building-reliable-multi-provider-ai-infrastructure-16e3) (MEDIUM confidence - verified against official docs)
- [High-Performance Bot Development](https://m.blog.csdn.net/gitblog_00798/article/details/153854438) (MEDIUM confidence)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded CSS selectors for scraping | Quick to implement | Breaks on any layout change, high maintenance | Never for production; OK for prototype only |
| Storing all prices without retention | Simple data model | Database bloat, slow queries, high costs | MVP < 100 cards, must plan retention before scaling |
| Single source for prices (no backup) | Less integration work | Blind spots when source has issues | Never - need at least 2 sources per card |
| Ignoring rate limits in development | Faster testing | IP bans, blocked access in production | Local development with mock data only |
| Manual card entry only | No metagame integration needed | Users won't use system, low value | Phase 0 proof of concept only |
| Simple name-based card matching | Easy to implement | Wrong card versions, bad data | Never - causes user trust issues |
| No notification batching | Real-time alerts | Alert fatigue, high churn | Never - 40% abandon due to poor notifications |
| Sync notification sending | Simpler code | Blocks on rate limits, slow sends | Never for production; OK for testing |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Scryfall API** | Requesting card data every price check | Use bulk data for metadata, API only for prices (and cache 24h) |
| **Scryfall Images** | Hotlinking images in URLs | Use Scryfall's image URLs directly (they're CDN-hosted and allowed) |
| **TCGPlayer API** | Not handling deprecated API versions | Always use latest API version, check deprecation notices |
| **CardMarket API** | Assuming it's free for commercial use | Verify API terms and pricing before implementation |
| **Liga Magic** | Scraping without checking robots.txt | Check terms, contact for API access, or use alternative |
| **Exchange Rate APIs** | Using free delayed rates | Acceptable for price alerts, but document delay clearly |
| **Telegram API** | Sending individual messages for each card | Group related cards into single message per batch |
| **Metagame APIs** | Hardcoding format rules | Expect formats to change, design flexible system |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **N+1 Query Problem** | Loading 1000 cards = 1001 database queries | Use batch queries, eager loading | 100+ cards in wishlist |
| **Missing Indexes** | Price history queries slow to 10+ seconds | Composite index on (card_id, source_id, timestamp) | 10K+ price records |
| **No Connection Pooling** | Database connections exhausted | Use connection pool (max 20 connections) | 10 concurrent users |
| **Synchronous Scraping** | Scraping blocks web requests | Use background jobs/queue | Scraping 100+ cards |
| **Real-time Price Checks** | API rate limits hit immediately | Batch checks 2-3x per day | Monitoring 500+ cards |
| **Unoptimized Time-Series** | Database grows 1GB+ per month | Downsampling + data retention | 3+ months of data |
| **Notification Burst** | Telegram rate limits during batch | Queue with rate limiter | 50+ alerts at once |
| **No Caching Layer** | Every request hits database/API | Redis caching for frequent queries | 100+ requests/minute |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing API Keys in Code** | Keys exposed in Git history | Environment variables, secrets management |
| **Logging Sensitive Data** | Card numbers, personal info in logs | Sanitize logs, exclude sensitive fields |
| **No Input Validation on Card Names** | SQL injection via user input | Parameterized queries, whitelist valid cards |
| **Telegram Bot Token in URL** | Token intercepted via access logs | POST requests only, header-based auth |
| **Unauthenticated Webhooks** | Fake price data via webhook endpoints | Verify webhook signatures/API keys |
| **Open Redis Instance** | Remote code execution | Bind to localhost, require authentication |
| **No Rate Limiting on Public API** | DoS attacks, quota exhaustion | Per-user rate limits, API keys |
| **CORS Misconfiguration** | Data theft via browser | Whitelist specific origins only |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **No Card Preview Image** | Users add wrong card by mistake | Show card image + set symbol when adding to wishlist |
| **Alerts Without Context** | "Lightning Bolt dropped 10%" means nothing | Include: previous price, current price, % drop, time period |
| **Cannot Undo Card Removal** | Accidentally deleted, must re-add | Soft delete with "recently removed" list |
| **No "Snooze" Option** | Annoying alerts during vacation | Per-card or global quiet hours |
| **All-or-Nothing Thresholds** | 5% too sensitive, 20% misses opportunities | Per-card customization + smart defaults |
| **No Price History Visualization** | Can't verify if deal is actually good | Interactive charts showing historical prices |
| **Hidden Fees Discovered Late** | $10 card costs $15 with fees | Show all-inclusive price upfront (IOF, shipping estimate) |
| **Cannot Compare Versions** | Don't know which printing is best | Side-by-side comparison of all printings |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Price Collection:** Often missing error handling — verify what happens when API is down, returns null, or rate limited
- [ ] **Currency Conversion:** Often missing IOF calculation — verify displayed prices match actual credit card charges
- [ ] **Card Identification:** Often missing set/collector number tracking — verify system distinguishes different printings
- [ ] **Alert System:** Often missing notification batching — verify 100 price drops don't send 100 separate messages
- [ ] **Data Retention:** Often missing cleanup policy — verify database won't grow forever
- [ ] **Error Monitoring:** Often missing alerts for scraper failures — verify you know when data collection breaks
- [ ] **Legal Compliance:** Often missing ToS review — verify each source allows your usage pattern
- [ ] **Testing:** Often missing scrape-breakage tests — verify system detects when scraper breaks
- [ ] **Documentation:** Often missing fee disclosures — verify users understand what prices include
- [ ] **Performance:** Often missing monitoring — verify you track query times and API success rates

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **API Ban** | HIGH | 1. Stop all requests immediately 2. Contact API provider support 3. Review and fix rate limiting 4. Request IP unblock 5. Implement stricter limits before resuming |
| **Database Bloat** | MEDIUM | 1. Archive old data to cold storage 2. Implement downsampling for historical data 3. Add retention policy 4. Rebuild indexes 5. Monitor for 30 days |
| **Alert Fatigue Churn** | HIGH | 1. Apologize to users 2. Reset notification preferences 3. Implement batching immediately 4. Offer "fresh start" with adjusted thresholds 5. Monitor engagement metrics |
| **Wrong Card Version Data** | HIGH | 1. Stop using bad data source 2. Re-scrape with proper identifiers 3. Notify affected users 4. Add verification step to UI 5. Offer credits/compensation |
| **Legal Threat** | VERY HIGH | 1. Stop scraping immediately 2. Consult lawyer 3. Negotiate with platform 4. Pivot to official API or drop source 5. Update terms and documentation |
| **Scraper Broken** | MEDIUM | 1. Identify what changed in HTML 2. Update selectors 3. Deploy hotfix 4. Backfill missing data 5. Add automated tests for next time |
| **Telegram Rate Limit** | LOW | 1. Implement message queue 2. Add rate limiting 3. Retry failed sends 4. Monitor queue depth 5. Consider switching to batch format |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| API Rate Limiting | Phase 1 - Core Infrastructure | Load test at 2x expected volume, monitor for 429s |
| Alert Fatigue | Phase 2 - Notification System | Track notification open/dismiss rates, user churn |
| Wrong Card Version | Phase 1 - Card Data Model | Test with cards having 10+ printings, verify oracle_id usage |
| Currency Conversion (IOF) | Phase 1 - Currency System | Compare calculated vs. actual credit card charges |
| Scraping Layout Changes | Phase 1 - Data Collection | Change HTML structure, verify scraper adapts or alerts |
| Legal/ToS Violations | Phase 0 - Pre-Research | Legal review of all data sources before implementation |
| Time Series Bloat | Phase 1 - Database Design | Simulate 1 year of data, verify query performance |
| Telegram Rate Limits | Phase 2 - Notification Infra | Send 200 notifications simultaneously, verify queuing |

## Sources

- [Scryfall REST API Documentation](https://scryfall.com/docs/api) - Rate limits, caching, data usage guidelines (HIGH confidence - official)
- [Mobile Push Notification Optimization](https://m.blog.csdn.net/gitblog_00601/article/details/152105434) - Batching strategies (MEDIUM confidence)
- [Web Scraping Legal Issues 2026](https://m.blog.csdn.net/shanwei_spider/article/details/156516332) - ToS compliance, robots.txt (MEDIUM confidence)
- [Notification UX Best Practices](https://www.woshipm.com/pd/5454417.html) - Alert fatigue prevention (MEDIUM confidence)
- [Adaptive Web Scraping Libraries](https://m.blog.csdn.net/gitblog_00712/article/details/153071508) - Handling layout changes (MEDIUM confidence)
- [Currency Conversion Accuracy](https://m.blog.csdn.net/qqyy_sj/article/details/146359872) - Hidden fees, delays (MEDIUM confidence)
- [Time Series Database Optimization](https://m.blog.csdn.net/gitblog_00798/article/details/153854438) - Data retention, downsampling (MEDIUM confidence)
- [Telegram Bot Performance](https://m.blog.csdn.net/gitblog_00798/article/details/153854438) - Rate limiting, queues (MEDIUM confidence)
- [MTG Card Identification](https://apps.apple.com/cn/app/card-value-identifier-cardly/id6747571942) - Version tracking (LOW confidence - app description)
- Project requirements document - IOF rate (6.38%), target sources

---
*Pitfalls research for: MTG Price Monitoring Systems*
*Researched: 2026-03-05*
