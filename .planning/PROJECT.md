# MTG Price Monitor

## What This Is

Sistema inteligente de monitoramento de preços de cartas de Magic: The Gathering que ajuda jogadores a comprar no momento certo. O sistema monitora automaticamente cartas de múltiplos formatos (Standard, Modern, Pioneer, Legacy, Vintage, Pauper, Commander), busca preços em fontes brasileiras (Liga Magic) e internacionais (TCGPlayer, CardMarket, CardKingdom) com conversão de moeda, e notifica oportunidades de compra via Telegram quando detecta tendências favoráveis.

## Core Value

Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

## Requirements

### Validated

- [x] Detecção de oportunidades de compra — Validated in Phase 04: queda ≥15% vs baseline 30 dias, guarda two-consecutive-runs (D-07), cooldown por carta/fonte
- [x] Sistema de notificação via Telegram — Validated in Phase 04: digest agrupado enviado via bot após cada coleta, persist-first garantido
- [x] Bot do Telegram com comandos de gerenciamento (parcial) — Validated in Phase 04: /history (D-18), /config (D-20), whitelist herdada

### Active

- [ ] Monitoramento automático de cartas por formato
  - Top cartas mais jogadas de Standard e Modern (formatos que o usuário joga)
  - Staples de Pioneer, Legacy, Vintage, Pauper
  - Top X cartas mais populares de Commander
  - Wishlist pessoal de cartas específicas que o usuário deseja

- [ ] Coleta de preços de múltiplas fontes
  - Liga Magic (Brasil)
  - TCGPlayer (EUA)
  - CardMarket (Europa)
  - CardKingdom (EUA)
  - Conversão automática de dólar/euro para real (considerando compra via cartão de crédito)

- [ ] Detecção de oportunidades de compra
  - Preço caiu X% na última semana
  - E está abaixo da média histórica
  - Combinar com popularidade/demanda da carta

- [ ] Sistema de notificação via Telegram
  - Bot envia mensagens quando detecta oportunidade
  - Checagem de preços 2-3x ao dia
  - Notificações contêm: carta, preço atual, preço médio, % queda, fonte(s)

- [ ] Interface web para gerenciamento e visualização
  - Gerenciar wishlist pessoal (adicionar/remover cartas)
  - Configurar formatos monitorados
  - Ajustar parâmetros de detecção de oportunidade (% queda, período)
  - Visualizar histórico completo de preços (gráficos + tabelas + filtros)
  - Comparar preços entre fontes

- [ ] Bot do Telegram com comandos de gerenciamento
  - Adicionar/remover cartas da wishlist
  - Ver lista de cartas monitoradas
  - Consultar preço atual de uma carta
  - Ajustar configurações de notificação
  - Ver histórico recente de oportunidades

### Out of Scope

- **Compra automática de cartas** — O sistema só alerta, não executa compra
- **Previsão de preços futuros** — Análise baseada em histórico, não em machine learning
- **Monitoramento de card singles em lojas físicas** — Apenas lojas online com API/web scraping
- **Sistema de leilão** — Não acompanha leilões, apenas preços fixos

## Context

**O problema:**
Jogadores de Magic: The Gathering gastam muito money em cartas. Preços variam significativamente entre lojas (Brasil vs EUA/Europa) e ao longo do tempo. Comprar no momento certo pode economizar dezenas ou centenas de reais.

**Usuário alvo:**
Jogador de MTG que joga Standard e Modern, interessado em outros formatos. Quer automatizar o monitoramento de preços para não ter que ficar checando manualmente.

**Fontes de dados:**
- **Preços:** Liga Magic, TCGPlayer, CardMarket, CardKingdom
- **Metagame:** Necessário identificar top cartas de cada formato (provavelmente via APIs como MTGTop8, EDHREC, Scryfall)
- **Cotação:** API de câmbio para conversão dólar/euro → real (IOB/Banco Central)

**Conversão de moeda:**
Considerar IOF (Imposto sobre Operações Financeiras) de cartão de crédito: 6.38% para compras internacionais

## Constraints

- **Cotação de câmbio:** Deve considerar IOF de cartão de crédito (6.38%) nas conversões dólar/euro → real
- **Rate limiting:** APIs externas podem ter limites de requisição (TCGPlayer, CardMarket, etc.)
- **Web scraping:** Algumas fontes podem não ter API pública, precisando de scraping
- **Performance:** Sistema deve checar milhares de cartas 2-3x ao dia de forma eficiente
- **Telegram API:** Limites de rate limiting da API do Telegram
- **Armazenamento:** Histórico de preços de milhares de cartas ao longo do tempo

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram bot vs Discord bot | Usuário prefere Telegram, mais simples para notificações | — Pending |
| Checagem 2-3x ao dia vs tempo real | Usuário quer aproveitar oportunidades rápidas mas não precisa de tempo real | — Pending |
| Lógica de oportunidade: queda + abaixo da média | Combina tendência recente com contexto histórico | — Pending |
| Interface web + bot | Flexibilidade para gerenciar como preferir | — Pending |
| Histórico completo com gráficos | Usuário quer visualizar dados além das notificações | — Pending |

## Current State

Phase 09 complete — API & DB integration tests activated. All 11 previously-skipped integration stubs now pass against a real PostgreSQL database: 5 search tests (`src/api/__tests__/cards/search.test.ts`) and 6 wishlist action tests (`src/lib/wishlist/__tests__/actions.test.ts`). Key deliverables: credential fix in `test/setup.ts`, no-param DB helpers in `src/test/helpers/db.ts`, `searchCards` extracted into `src/lib/cards/queries.ts`, `fileParallelism: false` added to prevent DB data bleed between parallel test files. Full suite: 172 tests pass, 171 skipped, 38 todo. TEST-08 and TEST-09 validated. Phase 09 is the third phase of milestone v1.1 (Test Coverage & Quality Hardening).

---
*Last updated: 2026-05-13
