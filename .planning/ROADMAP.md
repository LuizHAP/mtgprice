# MTG Price Monitor Roadmap

**Created:** 2026-03-05
**Granularity:** Standard
**Phases:** 6
**Coverage:** 24/24 requirements mapped

## Phases

- [ ] **Phase 1: Foundation & Infrastructure** - Database, authentication, and base infrastructure
- [ ] **Phase 2: Core Data Collection** - Multi-source price collection with currency conversion
- [ ] **Phase 3: User Interface & Wishlist** - Web dashboard and Telegram bot for wishlist management
- [ ] **Phase 4: Opportunity Detection & Notifications** - Alert system with batching and smart thresholds
- [ ] **Phase 5: Metagame Integration** - Automatic format-based monitoring
- [ ] **Phase 6: Polish & Optimization** - Performance, UX improvements, and monitoring

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 0/5 | Planning complete | - |
| 2. Core Data Collection | 0/4 | Not started | - |
| 3. User Interface & Wishlist | 0/3 | Not started | - |
| 4. Opportunity Detection & Notifications | 0/3 | Not started | - |
| 5. Metagame Integration | 0/2 | Not started | - |
| 6. Polish & Optimization | 0/2 | Not started | - |

## Phase Details

### Phase 1: Foundation & Infrastructure

**Goal:** Sistema possui base de dados otimizada para séries temporais, autenticação de usuários funcionando, e infraestrutura de rate limiting implementada

**Depends on:** Nothing (first phase)

**Requirements:** AUTH-01, AUTH-02, PRICE-06, PRICE-08

**Success Criteria** (what must be TRUE):
1. User pode criar conta e vincular ao Telegram para receber notificações
2. User permanece logado no dashboard web entre sessões
3. Sistema respeita rate limits de APIs externas (ex: Scryfall 10 req/sec)
4. Sistema armazena histórico de preços com schema otimizado para consultas temporais

**Plans:** 5 plans in 3 waves

**Wave 1 (Parallel):**
- [ ] 01-01-PLAN.md — Initialize Next.js project with TypeScript, Biome, Vitest, and monorepo structure
- [ ] 01-02-PLAN.md — Create database schema with Drizzle ORM, TimescaleDB hypertables, and indexes

**Wave 2 (Parallel):**
- [ ] 01-03-PLAN.md — Implement Redis-backed token bucket rate limiting (TDD)
- [ ] 01-04-PLAN.md — Implement JWT authentication system with bcrypt and Telegram linking (TDD)

**Wave 3 (Sequential):**
- [ ] 01-05-PLAN.md — Implement Telegram bot with grammY, chat ID whitelist, and /start authentication

---

### Phase 2: Core Data Collection

**Goal:** Sistema coleta preços de múltiplas fontes (BR + internacional) automaticamente 2-3x ao dia com conversão de moeda correta

**Depends on:** Phase 1 (database schema, rate limiting infrastructure)

**Requirements:** PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-07, PRICE-08, NOTIF-03

**Success Criteria** (what must be TRUE):
1. Sistema coleta preços da Liga Magic, TCGPlayer, CardMarket, e CardKingdom
2. Preços internacionais são convertidos para BRL com IOF de 6.38% (cartão de crédito)
3. Sistema realiza checagens de preços 2-3x ao dia de forma agendada
4. Histórico de preços é armazenado para cada carta e fonte

**Plans:** TBD

---

### Phase 3: User Interface & Wishlist

**Goal:** User pode gerenciar wishlist e visualizar dados de preços através de dashboard web e bot do Telegram

**Depends on:** Phase 2 (price data available to display)

**Requirements:** WISH-01, WISH-02, WISH-03, WISH-04, WISH-05, DASH-01, DASH-02

**Success Criteria** (what must be TRUE):
1. User pode adicionar e remover cartas da wishlist via interface web
2. User pode adicionar e remover cartas da wishlist via comandos do Telegram bot
3. User pode buscar cartas por nome no sistema
4. User pode comparar preços da mesma carta entre múltiplas fontes (Liga Magic, TCGPlayer, CardMarket, CardKingdom)
5. User pode visualizar lista de cartas monitoradas via interface web

**Plans:** TBD

---

### Phase 4: Opportunity Detection & Notifications

**Goal:** Sistema detecta oportunidades de compra e envia alertas via Telegram sem causar alert fatigue

**Depends on:** Phase 2 (price history data), Phase 3 (user preferences exist)

**Requirements:** DETECT-01, DETECT-02, DETECT-03, DETECT-04, NOTIF-01, NOTIF-02

**Success Criteria** (what must be TRUE):
1. Sistema detecta quando preço caiu X% na última semana E está abaixo da média histórica
2. Sistema gera alertas quando preço cai X% (threshold-based)
3. Sistema envia alertas de oportunidade via Telegram bot
4. Alertas são agrupados em batches para evitar spam (múltiplas cartas em uma mensagem)
5. Alertas contêm: nome da carta, preço atual, preço médio, % queda, fonte(s)
6. Telegram bot responde a comandos: /price (consultar preço), /history (histórico de alertas), /config (configurações)

**Plans:** TBD

---

### Phase 5: Metagame Integration

**Goal:** Sistema automaticamente monitora top cartas de formatos populares sem intervenção manual do usuário

**Depends on:** Phase 2 (data collection working), Phase 3 (wishlist infrastructure exists)

**Requirements:** META-01, META-02, META-03

**Success Criteria** (what must be TRUE):
1. Sistema auto-adiciona top cartas mais jogadas de Standard ao monitoramento
2. Sistema auto-adiciona top cartas mais jogadas de Modern ao monitoramento
3. Sistema auto-adiciona top X cartas mais populares de Commander ao monitoramento

**Plans:** TBD

---

### Phase 6: Polish & Optimization

**Goal:** Sistema é performático, confiável, e preparado para escalonamento

**Depends on:** All previous phases (core functionality complete)

**Requirements:** (None - optimization phase)

**Success Criteria** (what must be TRUE):
1. Sistema suporta monitoramento de 1000+ cartas sem degradação de performance
2. Taxa de sucesso de coleta de preços > 95% (com retry logic)
3. Dashboard carrega em < 2 segundos para consultas comuns
4. Sistema possui monitoramento de saúde e alertas de falhas

**Plans:** TBD

---

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| AUTH-01 | 1 | 01-04, 01-05 | Pending |
| AUTH-02 | 1 | 01-04 | Pending |
| PRICE-01 | 2 | - | Pending |
| PRICE-02 | 2 | - | Pending |
| PRICE-03 | 2 | - | Pending |
| PRICE-04 | 2 | - | Pending |
| PRICE-05 | 2 | - | Pending |
| PRICE-06 | 1 | 01-03 | Pending |
| PRICE-07 | 2 | - | Pending |
| PRICE-08 | 1 | 01-02 | Pending |
| WISH-01 | 3 | - | Pending |
| WISH-02 | 3 | - | Pending |
| WISH-03 | 3 | - | Pending |
| WISH-04 | 3 | - | Pending |
| WISH-05 | 3 | - | Pending |
| DETECT-01 | 4 | - | Pending |
| DETECT-02 | 4 | - | Pending |
| DETECT-03 | 4 | - | Pending |
| DETECT-04 | 4 | - | Pending |
| NOTIF-01 | 4 | - | Pending |
| NOTIF-02 | 4 | - | Pending |
| NOTIF-03 | 2 | - | Pending |
| META-01 | 5 | - | Pending |
| META-02 | 5 | - | Pending |
| META-03 | 5 | - | Pending |
| DASH-01 | 3 | - | Pending |
| DASH-02 | 3 | - | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Mapped to plans: 4/24 (AUTH-01, AUTH-02, PRICE-06, PRICE-08)
- Unmapped: 20 (Phase 2-6 requirements)

---

## Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Data Collection)
    ↓
    ├─→ Phase 3 (User Interface)
    └─→ Phase 4 (Notifications)
        ↓
    Phase 5 (Metagame)
        ↓
    Phase 6 (Polish)
```

**Key dependencies:**
- Phase 2 requires Phase 1's database schema and rate limiting
- Phase 3 requires Phase 2's price data to display
- Phase 4 requires Phase 2's historical data AND Phase 3's user preferences
- Phase 5 requires Phase 2's data collection and Phase 3's wishlist infrastructure
- Phase 6 requires all core functionality to be complete

---

## Research Considerations

From research/SUMMARY.md, the following areas need attention during planning:

**Phase 2 (Data Collection):**
- Liga Magic API availability — verify robots.txt and ToS
- TCGPlayer API pricing and rate limits

**Phase 4 (Opportunity Detection):**
- Algorithm tuning for "below historical average" threshold
- Optimal batching strategy to prevent alert fatigue

**Phase 5 (Metagame Integration):**
- MTGTop8 and EDHREC API availability — may require scraping
- Format-specific "staple" detection logic

---
*Roadmap created: 2026-03-05*
*Last updated: 2026-03-05*
