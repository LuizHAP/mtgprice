# Phase 6: Polish & Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 06-polish-optimization
**Areas discussed:** Health monitoring & alertas de falha, Retry & recovery (>95% success rate)

---

## Health Monitoring & Alertas de Falha

| Option | Description | Selected |
|--------|-------------|----------|
| Telegram + bot alerta você | Quando uma collection run tem muitas falhas, o bot envia mensagem. Já temos a infra do bot. | ✓ |
| Endpoint /health no Next.js | Rota /api/health retorna JSON com status de cada componente. Monitoramento externo (UptimeRobot). | |
| Ambos: Telegram + /health endpoint | Alerta ativo via bot + endpoint passivo para uptime monitoring externo. | |

**User's choice:** Telegram + bot alerta você

---

| Option | Description | Selected |
|--------|-------------|----------|
| Quando qualquer fonte ficar 100% offline (circuit aberto) | Alerta pontual: circuit breaker de uma fonte abre, bot avisa. Simples, pouco spam. | ✓ |
| Quando a run tém >30% das coletas falhando | Se 700/1000 cartas falharam, você recebe alerta. Cobre circuit breaker + falhas individuais. | |
| Ambos: circuit aberto + run com muitas falhas | Mais granular: avisa circuit aberto E run abaixo do threshold. | |

**User's choice:** Quando qualquer fonte ficar 100% offline (circuit aberto)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, texto puro com emoji | Ex: ⚠️ Circuit breaker aberto: TCGPlayer está offline. Consistente com estilo das fases anteriores. | ✓ |
| Texto puro mas com resumo de saúde diário | Além de alertas pontuais, bot envia resumo diário com status de cada fonte. | |

**User's choice:** Sim, texto puro com emoji

---

## Retry & Recovery (>95% Success Rate)

| Option | Description | Selected |
|--------|-------------|----------|
| Retry por carta/fonte com exponential backoff | Cada falha individual tenta até 3x com delay crescente (1s, 2s, 4s). | ✓ |
| Retry apenas no próximo cron (aceitar falhas individuais) | Sem retry inline. Smart-refresh cobre: se falhou, retenta no próximo run (6h depois). | |

**User's choice:** Retry por carta/fonte com exponential backoff

---

| Option | Description | Selected |
|--------|-------------|----------|
| Retry antes do circuit breaker registrar a falha | Tenta 3x antes de contar como 'failure' para o Opossum. Circuit só abre por falhas persistentes. | ✓ |
| Retry independente do circuit breaker | Retry em camada separada; circuit registra toda tentativa inclusive retries como potencial falha. | |

**User's choice:** Retry antes do circuit breaker registrar a falha

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, limitar concorrência por fonte (ex: 5 req/vez por fonte) | p-limit por fonte. Orquestrador atual é sequencial — parallelismo controlado muito mais rápido. | ✓ |
| Manter sequencial, confiar no rate limiter existente | Com 1000 cartas a 0.1s cada = 100s por fonte = 400s total. Simples mas lento. | |

**User's choice:** Sim, limitar concorrência por fonte (~5 req/vez)

---

## Claude's Discretion

- Dashboard Redis caching (não discutido — Claude tem discrição)
- Per-format enable/disable (não priorizado — implementação via env var como bonus)
- Endpoint /health HTTP (não priorizado — bonus opcional)
- Exact p-limit value per source
- Retry library choice (p-retry, axios-retry, ou manual)

## Deferred Ideas

- Per-format enable/disable via env var (Phase 5 deferred, não priorizado em Phase 6)
- Dashboard Redis caching (não selecionado pelo usuário)
- Endpoint /health HTTP (não selecionado)
- Resumo de saúde diário (não pedido)
