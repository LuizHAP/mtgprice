# MTG Price Monitor - Project State

**Last updated:** 2026-03-05
**Current phase:** Phase 1 (Foundation & Infrastructure)
**Status:** Planning complete, ready to start Phase 1

## Project Reference

**Core Value:** Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

**What we're building:**
Sistema inteligente de monitoramento de preços de cartas de Magic: The Gathering que:
- Monitora automaticamente cartas de múltiplos formatos (Standard, Modern, Pioneer, Legacy, Vintage, Pauper, Commander)
- Busca preços em fontes brasileiras (Liga Magic) e internacionais (TCGPlayer, CardMarket, CardKingdom)
- Converte moeda com IOF de 6.38% (cartão de crédito)
- Notifica oportunidades de compra via Telegram quando detecta tendências favoráveis
- Oferece dashboard web para gerenciamento e visualização

## Current Position

**Phase:** 1 - Foundation & Infrastructure
**Plan:** TBD (not yet planned)
**Status:** Not started

**Progress:**
```
[░░░░░░░░░░] 0% complete
```

**Current focus:** Establishing database schema, authentication system, and rate limiting infrastructure

## Performance Metrics

*No metrics yet — project hasn't started*

## Accumulated Context

### Key Decisions Made

**During project initialization (2026-03-05):**

1. **Telegram bot vs Discord bot:** Telegram selected — user preference, simpler for notifications
2. **Checagem 2-3x ao dia vs tempo real:** 2-3x daily selected — balances opportunity detection with API limits
3. **Lógica de oportunidade:** queda + abaixo da média — combines recent trend with historical context
4. **Interface web + bot:** Dual interface selected — flexibility for different use cases
5. **Histórico completo:** Full history with charts selected — users want data beyond notifications

**Technology stack (from research):**
- Python 3.11+ — Backend language, best-in-class scraping ecosystem
- FastAPI 0.115+ — Web framework, 3-5x faster than Flask
- PostgreSQL 16+ + TimescaleDB 2.15+ — Time-series database, 65% lower storage vs InfluxDB
- Scrapy 2.11+ + Playwright 1.41+ — Web scraping with built-in concurrency
- python-telegram-bot 22.6+ — Telegram integration, fully async
- APScheduler 3.10.4+ — Scheduled jobs, lightweight scheduling

### Known Constraints

1. **Cotação de câmbio:** Deve considerar IOF de cartão de crédito (6.38%) nas conversões dólar/euro → real
2. **Rate limiting:** APIs externas têm limites de requisição (Scryfall: 10 req/sec, Telegram: 100 req/60sec)
3. **Web scraping:** Algumas fontes podem não ter API pública, precisando de scraping
4. **Performance:** Sistema deve checar milhares de cartas 2-3x ao dia de forma eficiente
5. **Armazenamento:** Histórico de preços de milhares de cartas ao longo do tempo (4.4M rows/year expected)

### Critical Pitfalls to Avoid

1. **API Rate Limiting** — Scryfall bans IPs for excessive requests. Implement 50-100ms delays, use bulk data, cache 24h.
2. **Alert Fatigue** — 40% of users abandon apps after poor notification experience. Batch alerts, require multiple conditions.
3. **Legal/ToS Violations** — Scraping without permission can lead to cease & desist. Check robots.txt AND ToS.
4. **Wrong Card Version** — MTG has same card across dozens of sets with wildly different values. Use unique identifiers.
5. **Currency Conversion Without IOF** — International prices appear 6.38% too cheap without IOF tax.
6. **Time Series Bloat** — Use TimescaleDB partitioning, implement retention policies.
7. **Telegram Rate Limits** — 100 requests/60 seconds means batch sends fail during price drops.

### Research Gaps to Address

**Liga Magic integration approach:**
- Unknown if Liga Magic has official API or requires scraping only
- Handling: Phase 2 planning should include verification of robots.txt, ToS, and API access

**Opportunity detection algorithm thresholds:**
- Unknown optimal thresholds for "below historical average" detection
- Handling: Start with conservative defaults (15% drop + below 30-day average), plan for A/B testing

**Metagame data availability (Phase 5):**
- Unknown if MTGTop8/EDHREC have APIs or require scraping
- Handling: Phase 5 planning should include verification of metagame sources

**IOF calculation accuracy:**
- Need to verify 6.38% IOF is still current rate in 2026
- Handling: Verify with Brazilian Central Bank before Phase 1

### Active Todos

*None yet — project hasn't started*

### Blockers

*None currently*

## Session Continuity

### Last Work Completed

**2026-03-05:** Project initialization and roadmap creation
- Defined 24 v1 requirements across 6 phases
- Created roadmap with goal-backward success criteria
- Validated 100% requirement coverage
- Identified research gaps for Phase 2, 4, and 5

### Next Steps

1. Plan Phase 1 (Foundation & Infrastructure) with `/gsd:plan-phase 1`
2. Implement database schema with TimescaleDB hypertables
3. Implement authentication system (JWT + Telegram linking)
4. Implement rate limiting infrastructure (token bucket algorithm)
5. Verify IOF rate (6.38%) with Brazilian Central Bank

### Context for Next Session

The project is ready to start Phase 1 implementation. Focus on:
- Database schema design with time-series partitioning
- User authentication with Telegram integration
- Rate limiting to prevent API blocks
- Legal/ToS review for all price sources

**Important:** Phase 1 addresses critical pitfalls that cannot be retrofitted easily. Do not skip rate limiting or legal compliance.

---
*State initialized: 2026-03-05*
