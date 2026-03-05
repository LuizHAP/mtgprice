# Feature Research

**Domain:** MTG (Magic: The Gathering) Price Monitoring System
**Researched:** 2026-03-05
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Wishlist Management** | Users want to track specific cards they're interested in | MEDIUM | Add/remove cards, organize by category/format |
| **Price Alerts/Notifications** | Core value proposition - users expect to be notified of opportunities | MEDIUM | Threshold-based alerts (% drop, below target price) |
| **Multi-Source Price Tracking** | Users expect comparison shopping across major marketplaces | HIGH | TCGPlayer, CardMarket, CardKingdom, Liga Magic (BR) |
| **Historical Price Charts** | Users need to see trends to make informed decisions | MEDIUM | Line charts showing price over time (7d, 30d, 90d, all-time) |
| **Card Search/Identification** | Users need to find cards quickly by name, set, or scanning | LOW-MEDIUM | Text search + optional camera scanning |
| **Collection Value Tracking** | Users want to know their portfolio's worth | MEDIUM | Sum value of tracked/owned cards |
| **Price History Data** | Historical context is essential for "below average" detection | HIGH | Store and query historical prices efficiently |
| **Basic User Authentication** | Users expect personalized data and privacy | LOW | Simple login to access their wishlist/settings |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic Format-Based Monitoring** | Eliminates manual setup - auto-track top cards by format | HIGH | Scrape metagame data (MTGTop8, EDHREC) to auto-add cards |
| **Brazilian Market Focus (Liga Magic + IOF)** | Unique value for Brazilian players - shows true landed cost | MEDIUM | Currency conversion with 6.38% IOF for credit card purchases |
| **Telegram Bot + Web Dashboard** | Flexibility to manage via mobile (Telegram) or desktop (web) | MEDIUM | Dual interface suits different user preferences |
| **Opportunity Detection Algorithm** | Combines trend analysis (price dropped) + context (below historical average) | HIGH | More sophisticated than simple threshold alerts |
| **Multi-Currency Price Comparison** | Compare international prices in local currency (BRL) | MEDIUM | Automatic USD/EUR → BRL conversion |
| **2-3x Daily Check Frequency** | Frequent enough to catch opportunities without overwhelming | LOW | Balance between timeliness and API rate limits |
| **Format-Specific Staple Detection** | Automatically identifies essential cards for each format | MEDIUM | "Staples of Pioneer, Legacy, Vintage, Pauper" |
| **Portfolio Trend Analysis** | See collection gaining/losing value over time | MEDIUM | Charts showing total portfolio value changes |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Price Updates** | Users fear missing opportunities | API rate limits, infrastructure costs, marginal benefit vs 2-3x daily | Check frequency 2-3x daily (catches opportunities without overwhelming) |
| **Automatic Purchase Execution** | "Buy when price drops" functionality | High complexity, payment processing, returns/refunds, user trust issues | Alert-only system (user decides when/where to buy) |
| **Price Prediction (ML)** | "Tell me which cards will spike" | Accuracy issues, false confidence, complex to build/maintain | Historical trend analysis + opportunity detection (present-focused) |
| **Physical Store Inventory Tracking** | "Find cards at local game stores" | No APIs, requires manual scraping, unreliable data | Online marketplace tracking only (TCGPlayer, CardMarket, etc.) |
| **Auction Monitoring** | "Track eBay auctions for deals" | Auction dynamics complex, time-critical, hard to automate | Fixed price tracking only (more predictable) |
| **Social Features (Sharing, Leaderboards)** | Community engagement, show off collection | Privacy concerns, scope creep, not core value proposition | Focus on individual user's price monitoring needs |
| **All-Format Coverage from Day 1** | "Support every MTG format immediately" | Data availability varies, dilutes focus, harder to validate | Start with Standard + Modern (user's primary formats), expand later |

## Feature Dependencies

```
[Price Data Collection]
    ├──requires──> [Multi-Source API Integration]
    │               ├──requires──> [Rate Limiting Strategy]
    │               └──requires──> [Currency Conversion API]
    ├──requires──> [Data Storage (PostgreSQL/TimescaleDB)]
    └──enhances──> [Historical Price Charts]

[Opportunity Detection Algorithm]
    ├──requires──> [Price History Data]
    ├──requires──> [Price Data Collection]
    └──enhances──> [Alert System]

[Alert System]
    ├──requires──> [Telegram Bot Integration]
    ├──requires──> [User Authentication]
    └──requires──> [Opportunity Detection Algorithm]

[Wishlist Management]
    ├──requires──> [User Authentication]
    ├──requires──> [Card Search/Identification]
    └──enhances──> [Alert System]

[Web Dashboard]
    ├──requires──> [User Authentication]
    ├──enhances──> [Wishlist Management]
    ├──enhances──> [Historical Price Charts]
    └──enhances──> [Collection Value Tracking]

[Automatic Format-Based Monitoring]
    ├──requires──> [Metagame Data Sources (MTGTop8, EDHREC)]
    ├──requires──> [Card Database (Scryfall)]
    └──enhances──> [Wishlist Management]

[Brazilian Market Focus]
    ├──requires──> [Currency Conversion API with IOF]
    └──enhances──> [Multi-Source Price Tracking]
```

### Dependency Notes

- **Price Data Collection requires Multi-Source API Integration**: Can't track prices without integrating TCGPlayer, CardMarket, CardKingdom, Liga Magic APIs. Rate limiting is critical to avoid being blocked.
- **Opportunity Detection Algorithm requires Price History Data**: Can't determine if price is "below average" without historical context.
- **Alert System requires User Authentication**: Need to know which user to notify and which cards they're tracking.
- **Web Dashboard enhances Wishlist Management**: While Telegram bot can manage wishlists, web interface provides better UX for bulk operations and visual management.
- **Automatic Format-Based Monitoring enhances Wishlist Management**: Reduces manual setup by auto-adding relevant cards based on formats user plays.
- **Brazilian Market Focus enhances Multi-Source Price Tracking**: Currency conversion with IOF makes international prices meaningful for Brazilian users.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **User Authentication** — Essential for personalized wishlists and alert delivery
- [ ] **Wishlist Management (Web + Telegram)** — Core user interaction: add/remove cards to track
- [ ] **Multi-Source Price Tracking (2 sources minimum)** — TCGPlayer + Liga Magic (BR) to start
- [ ] **Basic Price Alerts (Telegram)** — Simple threshold alerts (price dropped X%)
- [ ] **Historical Price Charts (Web)** — Visual confirmation of price trends
- [ ] **Currency Conversion (USD → BRL with IOF)** — Critical value for Brazilian users
- [ ] **Manual Card Addition** — Users add specific cards by name (no auto-format monitoring yet)

**MVP Validation Questions:**
- Are users actually buying when alerted?
- Is 2-3x daily check frequency sufficient?
- Are Liga Magic + TCGPlayer the right starting sources?
- Is IOF-inclusive currency conversion accurate?

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Automatic Format-Based Monitoring** — After validating manual wishlist usage, test automation
- [ ] **Additional Price Sources** — CardMarket, CardKingdom (based on user demand)
- [ ] **Opportunity Detection Algorithm** — Enhance alerts with "price dropped + below average" logic
- [ ] **Collection Value Tracking** — Add portfolio tracking after users have wishlist data
- [ ] **Advanced Alert Configuration** — Custom thresholds, time-based alerts, format filtering

**Triggers for adding:**
- Users request "can you auto-add Standard top cards?"
- Users ask "what's my collection worth?"
- Alert volume is manageable and users want more control

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Camera Card Scanning** — Nice-to-have UX improvement, manual search works for MVP
- [ ] **Portfolio Trend Analysis** — Advanced analytics, wait for base collection tracking usage
- [ ] **Social Features** — Share collections, leaderboards (not core value prop)
- [ ] **All Format Support** — Start with Standard/Modern, expand to Pioneer/Legacy/Vintage/Pauper/Commander later
- [ ] **Mobile App** — Web dashboard + Telegram bot sufficient initially
- [ ] **Price Prediction** — High complexity, questionable accuracy, defer indefinitely

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wishlist Management | HIGH | MEDIUM | P1 |
| Price Alerts (Telegram) | HIGH | MEDIUM | P1 |
| Multi-Source Price Tracking (2 sources) | HIGH | HIGH | P1 |
| Currency Conversion (USD→BRL with IOF) | HIGH | LOW | P1 |
| Historical Price Charts | HIGH | MEDIUM | P1 |
| User Authentication | MEDIUM | LOW | P1 |
| Opportunity Detection Algorithm | HIGH | HIGH | P2 |
| Automatic Format-Based Monitoring | HIGH | HIGH | P2 |
| Collection Value Tracking | MEDIUM | MEDIUM | P2 |
| Additional Price Sources | MEDIUM | MEDIUM | P2 |
| Advanced Alert Configuration | MEDIUM | MEDIUM | P2 |
| Portfolio Trend Analysis | LOW-MEDIUM | MEDIUM | P3 |
| Camera Card Scanning | LOW | HIGH | P3 |
| Social Features | LOW | HIGH | P3 |
| Mobile App | LOW | VERY HIGH | P3 |
| Price Prediction (ML) | LOW | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | MTGGoldfish Premium | TCGplayer App | Leviathan Magic Organizer | ManaBox | Our Approach |
|---------|---------------------|---------------|---------------------------|---------|--------------|
| **Price Alerts** | Unlimited (paid $6/mo) | Collection value tracking | Price mover notifications | Not specified | Telegram bot + web, 2-3x daily checks |
| **Multi-Source Tracking** | TCGPlayer primarily | TCGPlayer only | Multi-format integration | CardMarket, TCGPlayer, Card Kingdom | Liga Magic (BR) + international sources |
| **Currency Conversion** | USD only | USD only | USD only | Multiple currencies | USD/EUR → BRL with IOF (Brazilian focus) |
| **Wishlist Management** | Card tracking | Collection/deck lists | Collection/folder organization | Collection management | Wishlist via web + Telegram bot |
| **Historical Charts** | Yes (premium) | Price lookup | Price estimates & trends | Price checking | Historical charts (7d, 30d, 90d, all-time) |
| **Format-Based Monitoring** | Deck-focused | Collection-focused | Deck/cube management | Deck building | Auto-add top cards by format (differentiator) |
| **Pricing** | $6/month | Free | $15/mo or $598 one-time | Free | TBD (likely freemium) |
| **Platform** | Web | Mobile (iOS/Android) | iOS/iPadOS/macOS | Android | Web + Telegram bot (cross-platform) |
| **Notification Channel** | Email/in-app | In-app | iOS notifications | Not specified | Telegram bot (unique) |

**Key Differentiators:**
1. **Brazilian Market Focus**: No major competitor focuses on Brazilian market with Liga Magic + IOF-inclusive currency conversion
2. **Telegram Bot Integration**: Most competitors use in-app notifications or email; Telegram is more immediate and accessible
3. **Dual Interface**: Both web (for heavy management) and Telegram bot (for quick actions) - competitors usually focus on one
4. **Opportunity Detection Algorithm**: Combining trend analysis + historical average is more sophisticated than simple threshold alerts

**Market Gap Identified:**
- Most tools are US/EU-centric, ignoring Brazilian market specifics (IOF, Liga Magic)
- Limited automation for format-based monitoring (users manually add cards)
- Notification channels are traditional (email/in-app) vs. modern messaging platforms (Telegram)

## Sources

### Primary Research Sources
- **MTGGoldfish**: Premium features ($6/month), unlimited price alerts, collection tracking, SuperBrew deck finder - https://www.mtggoldfish.com/
- **MTG Scanner Apps**: Tiggra, ManaBox, Leviathan, TCG Scan - feature comparison across mobile apps (2025-2026)
- **Currency Conversion APIs**: Fixer.io, Exchange Rates API, XE Currency Data - features and capabilities for international pricing
- **Dashboard Visualization**: Price monitoring dashboard best practices (chart types, historical data visualization, interactive features)

### Competitor Analysis
- **MTGGoldfish Premium**: Price alerts, collection tracking, unlimited card tracking, price history downloads
- **TCGplayer**: Market price tracking, collection management, card scanning, direct shopping
- **Leviathan Magic Organizer**: Price mover notifications, collection management, iCloud sync, Scryfall integration
- **ManaBox**: Free, CardMarket/TCGPlayer/Card Kingdom pricing, deck building, statistics
- **MTGso+**: Price rise/fall rankings, format filtering (Standard, Pioneer, Modern, Legacy)
- **PriceCharting**: Wishlist notifications, photo search, price history, completely free
- **MTG Card Value Scanner**: Real-time pricing, portfolio value calculator, bulk scanning, export to CSV/JSON

### Industry Standards
- **Metagame Data Sources**: MTGTop8, EDHREC for format-based card popularity tracking
- **Price Data Sources**: TCGPlayer (US), CardMarket (EU), CardKingdom (US), Liga Magic (Brazil)
- **Currency APIs**: Xe Currency Data, Fixer.io, Exchange Rates API for USD/EUR → BRL conversion
- **Notification Best Practices**: Real-time alerts, threshold-based notifications, customizable frequency

### Confidence Assessment
- **Table Stakes Features**: HIGH confidence - based on comprehensive competitor analysis showing standard features across MTGGoldfish, TCGplayer, Leviathan, ManaBox
- **Differentiators**: MEDIUM confidence - Brazilian market focus is unique but unvalidated; Telegram bot approach is novel but needs user testing
- **Anti-Features**: MEDIUM confidence - based on common pitfalls in price tracking systems (rate limits, complexity vs value tradeoffs)
- **Feature Dependencies**: HIGH confidence - technical dependencies are well-understood (API integration → data collection → alerts)

---
*Feature research for: MTG Price Monitoring System*
*Researched: 2026-03-05*
