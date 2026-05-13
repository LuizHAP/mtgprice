# Requirements: MTG Price Monitor

**Defined:** 2026-03-05
**Updated:** 2026-05-09 (Milestone v1.1)
**Core Value:** Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Autenticação

- [x] **AUTH-01**: User pode vincular conta ao Telegram para receber notificações
- [x] **AUTH-02**: Sessão do usuário persiste entre acessos ao dashboard web

### Coleta de Preços

- [ ] **PRICE-01**: Sistema coleta preços da Liga Magic (Brasil)
- [ ] **PRICE-02**: Sistema coleta preços da TCGPlayer (EUA)
- [ ] **PRICE-03**: Sistema coleta preços da CardMarket (Europa)
- [ ] **PRICE-04**: Sistema coleta preços da CardKingdom (EUA)
- [ ] **PRICE-05**: Preços internacionais são convertidos para BRL com IOF de 6.38%
- [x] **PRICE-06**: Sistema respeita rate limits de APIs externas
- [ ] **PRICE-07**: Sistema armazena histórico de preços com schema otimizado
- [ ] **PRICE-08**: Sistema realiza checagens de preços 2-3x ao dia de forma agendada

### Wishlist

- [ ] **WISH-01**: User pode adicionar cartas à wishlist via interface web
- [ ] **WISH-02**: User pode remover cartas da wishlist via interface web
- [ ] **WISH-03**: User pode buscar cartas por nome no sistema
- [ ] **WISH-04**: User pode adicionar/remover cartas via Telegram bot
- [ ] **WISH-05**: User pode visualizar lista de cartas monitoradas via interface web

### Detecção de Oportunidades

- [x] **DETECT-01**: Sistema detecta quando preço caiu ≥15% vs baseline 30 dias
- [x] **DETECT-02**: Sistema verifica duas execuções consecutivas antes de alertar
- [x] **DETECT-03**: Sistema aplica cooldown por carta/fonte após alertar
- [x] **DETECT-04**: Sistema ignora outliers estatísticos (zscore > 3)

### Notificações

- [x] **NOTIF-01**: Sistema envia alertas de oportunidade via Telegram bot
- [x] **NOTIF-02**: Alertas são agrupados em digest para evitar spam
- [x] **NOTIF-03**: Sistema executa coleta de preços 2-3x ao dia de forma agendada

### Metagame

- [ ] **META-01**: Sistema auto-adiciona top cartas de Standard ao monitoramento
- [ ] **META-02**: Sistema auto-adiciona top cartas de Modern ao monitoramento
- [ ] **META-03**: Sistema auto-adiciona top cartas de Commander ao monitoramento

### Dashboard

- [ ] **DASH-01**: User pode comparar preços entre múltiplas fontes
- [ ] **DASH-02**: User pode visualizar lista de cartas monitoradas via interface web

---

## v1.1 Requirements — Test Coverage & Quality Hardening

Requirements for milestone v1.1. Goal: ativar os 200 testes skipped e 54 todos.

### Auth Tests

- [x] **TEST-01**: Tests ativos para bcrypt hash (hash com 10 salt rounds, compare correto, rejeitar senha errada, unicidade de salt)
- [x] **TEST-02**: Tests ativos para JWT (sign com payload, verify válido, rejeitar token inválido, rejeitar token expirado, claims iat/exp)

### Rate Limit Tests

- [x] **TEST-03**: Tests ativos para Redis rate limiter (armazenar estado, Lua script atômico, erros de conexão, persistência, cluster HA, memory pressure, cache local)

### Circuit Breaker Tests

- [ ] **TEST-04**: Tests ativos para state transitions (closed→open→half-open→closed lifecycle)
- [ ] **TEST-05**: Tests ativos para fallback function (execute fallback, cached data, handle fallback errors)
- [ ] **TEST-06**: Tests ativos para event emission (open, close, halfOpen, fallback events)
- [ ] **TEST-07**: Tests ativos para per-source isolation (breakers independentes, timeouts por source, stats por source)

### API & DB Integration Tests

- [ ] **TEST-08**: Tests ativos para card search endpoint (match por nome, empty result, case-insensitive, limit 10, mínimo 2 chars)
- [ ] **TEST-09**: Tests ativos para wishlist server actions (addCard, FK violation, removeCard, searchCards variantes)

### Scheduler Tests

- [x] **TEST-10**: Tests ativos para schedulePriceCollection (cron registration, custom schedule, invalid expressions)
- [x] **TEST-11**: Tests ativos para executePriceCollection (run orchestration, error handling, duration metrics, concorrência)

### Orchestrator Tests

- [ ] **TEST-12**: Implementar `orchestrateFetch`, `handleSourceFailure`, `applyRateLimiting` + tests ativos
- [ ] **TEST-13**: Implementar `aggregateResults`, `batchOrchestrateFetch` + tests ativos

---

## Future Requirements

*Deferred to future milestones*

- Interface web completa com gráficos de histórico de preços
- Configuração de formatos monitorados via web
- A/B testing de thresholds de detecção de oportunidade
- Suporte a Redis cluster para alta disponibilidade

## Out of Scope

- **Compra automática de cartas** — O sistema só alerta, não executa compra
- **Previsão de preços futuros** — Análise baseada em histórico, não em machine learning
- **Monitoramento de card singles em lojas físicas** — Apenas lojas online com API/web scraping
- **Sistema de leilão** — Não acompanha leilões, apenas preços fixos

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | 1 | Complete |
| AUTH-02 | 1 | Complete |
| PRICE-01–08 | 2 | Complete |
| NOTIF-01–03 | 4 | Complete |
| DETECT-01–04 | 4 | Complete |
| META-01–03 | 5 | Complete |
| TEST-01–02 | v1.1 Phase 7 | Complete |
| TEST-03 | v1.1 Phase 7 | Complete |
| TEST-04–07 | v1.1 Phase 8 | Planned |
| TEST-08–09 | v1.1 Phase 9 | Planned |
| TEST-10–11 | v1.1 Phase 10 | Planned |
| TEST-12–13 | v1.1 Phase 11 | Planned |
