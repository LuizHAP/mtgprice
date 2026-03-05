# Requirements: MTG Price Monitor

**Defined:** 2026-03-05
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
- [ ] **PRICE-05**: Sistema converte preços USD/EUR → BRL com IOF de 6.38% (cartão de crédito)
- [x] **PRICE-06**: Sistema implementa rate limiting para respeitar limites das APIs e evitar bloqueios (ex: Scryfall 10 req/sec)
- [ ] **PRICE-07**: Sistema realiza checagens de preços 2-3x ao dia de forma agendada
- [x] **PRICE-08**: Sistema armazena histórico de preços para cada carta/fonte

### Wishlist

- [ ] **WISH-01**: User pode adicionar cartas específicas à wishlist manualmente
- [ ] **WISH-02**: User pode remover cartas da wishlist
- [ ] **WISH-03**: User pode buscar cartas por nome no sistema
- [ ] **WISH-04**: User pode gerenciar wishlist via comandos do Telegram bot (/add, /remove, /wishlist)
- [ ] **WISH-05**: User pode gerenciar wishlist via interface web dashboard

### Detecção de Oportunidade

- [ ] **DETECT-01**: Sistema detecta quando preço caiu X% na última semana E está abaixo da média histórica
- [ ] **DETECT-02**: Sistema gera alertas quando preço cai X% (threshold-based)
- [ ] **DETECT-03**: Sistema implementa batching de alertas para evitar alert fatigue (40% churn rate)
- [ ] **DETECT-04**: Alertas contêm: nome da carta, preço atual, preço médio, % queda, fonte(s)

### Notificações

- [ ] **NOTIF-01**: Sistema envia alertas de oportunidade via Telegram bot
- [ ] **NOTIF-02**: Telegram bot responde a comandos: /price (consultar preço), /history (histórico de alertas), /config (configurações)
- [ ] **NOTIF-03**: Sistema respeita frequência de checagem 2-3x ao dia (não real-time)

### Metagame

- [ ] **META-01**: Sistema auto-adiciona top cartas mais jogadas de Standard ao monitoramento
- [ ] **META-02**: Sistema auto-adiciona top cartas mais jogadas de Modern ao monitoramento
- [ ] **META-03**: Sistema auto-adiciona top X cartas mais populares de Commander ao monitoramento

### Dashboard

- [ ] **DASH-01**: User pode comparar preços da mesma carta entre múltiplas fontes (Liga Magic, TCGPlayer, CardMarket, CardKingdom)
- [ ] **DASH-02**: User pode visualizar lista de cartas monitoradas via interface web

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANALY-01**: User pode visualizar gráficos de histórico de preços (7d, 30d, 90d, all-time)
- **ANALY-02**: User pode ver valor total da sua wishlist/collection

### Formatos Expandidos

- **META-04**: Sistema auto-adiciona staples de Pioneer
- **META-05**: Sistema auto-adiciona staples de Legacy
- **META-06**: Sistema auto-adiciona staples de Vintage
- **META-07**: Sistema auto-adiciona staples de Pauper

### UX Enhancements

- **WISH-06**: User pode adicionar cartas escaneando com câmera
- **NOTIF-04**: User pode configurar thresholds customizados por carta
- **NOTIF-05**: User pode configurar filtros de notificação por formato

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Compra automática de cartas | Sistema alerta apenas, não executa compra. Alta complexidade, questões de pagamento/confiança. |
| Previsão de preços futuros (ML) | Análise baseada em histórico, não em machine learning. Alta complexidade, baixa precisão, falsa confiança. |
| Monitoramento de lojas físicas | Apenas lojas online com API/web scraping. Lojas físicas não têm APIs, scraping não confiável. |
| Leilões (eBay) | Apenas preços fixos. Leilões são dinâmicos, time-critical, difíceis de automatizar. |
| Atualizações em tempo real | 2-3x ao dia é suficiente. Real-time tem limites de API, custo de infra, beneficio marginal. |
| Features sociais (share, leaderboards) | Não é core value prop. Scope creep, privacidade. |
| Aplicativo mobile (iOS/Android) | Web dashboard + Telegram bot sufficient inicialmente. Custo muito alto para v1. |
| All-format coverage from day 1 | Start com Standard/Modern/Commander, expandir depois. Disponibilidade de dados varia. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| PRICE-01 | Phase 2 | Pending |
| PRICE-02 | Phase 2 | Pending |
| PRICE-03 | Phase 2 | Pending |
| PRICE-04 | Phase 2 | Pending |
| PRICE-05 | Phase 2 | Pending |
| PRICE-06 | Phase 1 | Complete |
| PRICE-07 | Phase 2 | Pending |
| PRICE-08 | Phase 1, 2 | Complete |
| WISH-01 | Phase 3 | Pending |
| WISH-02 | Phase 3 | Pending |
| WISH-03 | Phase 3 | Pending |
| WISH-04 | Phase 3 | Pending |
| WISH-05 | Phase 3 | Pending |
| DETECT-01 | Phase 4 | Pending |
| DETECT-02 | Phase 4 | Pending |
| DETECT-03 | Phase 4 | Pending |
| DETECT-04 | Phase 4 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 2 | Pending |
| META-01 | Phase 5 | Pending |
| META-02 | Phase 5 | Pending |
| META-03 | Phase 5 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
