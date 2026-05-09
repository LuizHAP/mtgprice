# Phase 6: Polish & Optimization - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Tornar o sistema performático, confiável e pronto para produção. O sistema já está funcional — esta fase adiciona retry logic para garantir >95% de sucesso nas coletas, controle de concorrência para suportar 1000+ cartas sem degradação, e alertas de saúde via Telegram para que falhas críticas nunca passem despercebidas.

**Explicitly out of scope for Phase 6:**
- Price charts / visualizations (v2 — ANALY-01, ANALY-02)
- Per-format enable/disable toggle (adiado, não priorizado pelo usuário)
- Dashboard Redis caching (não selecionado, Claude tem discrição)
- Endpoint /health HTTP (não priorizado; Claude pode adicionar como bônus se simples)
- Multi-user support (OOS v1)

</domain>

<decisions>
## Implementation Decisions

### Health Monitoring — Alertas de Falha

- **D-01:** Alertas de saúde são entregues **exclusivamente via Telegram bot**. Nenhum endpoint `/health` HTTP é obrigatório — o canal já existente do bot é o único destino de alertas ativos.
- **D-02:** O trigger de alerta é **quando o circuit breaker de qualquer fonte abre** (100% offline para aquela fonte após atingir o error threshold). Este é o sinal de falha real, não falhas transitórias que o retry já cobre.
- **D-03:** O formato dos alertas segue o **padrão texto puro com emoji** já estabelecido nas fases anteriores (Phase 3/4). Exemplo: `⚠️ Circuit breaker aberto: TCGPlayer está offline (60s reset). Últimas tentativas falharam.`
- **D-04:** O alerta é enviado ao `chatId` da whitelist existente (single-user mode, Phase 1). Usa a mesma infraestrutura de `bot.api.sendMessage` do `src/lib/telegram.ts`.

### Retry Logic — >95% Success Rate

- **D-05:** Falhas individuais de coleta (timeout, 429, erro de rede) são **retentadas até 3 vezes com exponential backoff** antes de serem contadas como falha definitiva. Sugestão de delays: 1s, 2s, 4s — planner pode ajustar.
- **D-06:** O retry acontece **antes de o circuit breaker registrar a falha**. A sequência é: `fetch → falha → retry 1 → falha → retry 2 → falha → retry 3 → ainda falha → circuit breaker conta como 1 failure`. Assim o circuit só abre por falhas reais (persistentes), não transitórias.
- **D-07:** O circuit breaker existente (`src/scraper/circuit-breaker.ts`) e seus parâmetros (50% error threshold, 60s reset) são **mantidos** — o retry é uma camada adicional, não um substituto.

### Concorrência — Suporte a 1000+ Cartas

- **D-08:** O orquestrador de coleta deve usar **controle de concorrência por fonte** (ex: `p-limit` com ~5 requests simultâneos por fonte). Atualmente é sequencial — com 1000 cartas × 4 fontes = 4000 calls seria muito lento. Parallelismo controlado mantém a velocidade sem ultrapassar rate limits.
- **D-09:** A concorrência é por fonte (não global), pois cada fonte tem seu próprio rate limit e circuit breaker. O planner pode ajustar o número exato (5 é um ponto de partida razoável para os rate limits existentes).

### Claude's Discretion

- Valor exato do concurrency limit por fonte (sugestão: 5 para TCGPlayer/CardMarket/CardKingdom, pode ser maior para Liga Magic se scraping permite).
- Se adicionar endpoint `/api/health` como bonus de observabilidade passiva (se for simples, pode incluir).
- Otimizações de dashboard (Redis caching de queries frequentes, índices adicionais no TimescaleDB) — Claude tem discrição se o benchmark mostrar necessidade.
- Implementação da biblioteca de retry (p-retry, axios-retry, ou implementação manual com setTimeout).
- Resumo de saúde diário via Telegram (não foi solicitado, mas Claude pode adicionar se simples).
- Per-format enable/disable via env var (simples, pode incluir como bonus — ex: `MONITOR_STANDARD=true MONITOR_MODERN=true MONITOR_COMMANDER=false`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Success Criteria
- `.planning/ROADMAP.md` §"Phase 6: Polish & Optimization" — success criteria obrigatórios (1000+ cartas, >95%, <2s, health monitoring)

### Prior Phase Decisions
- `.planning/phases/04-opportunity-detection-notifications/04-CONTEXT.md` — D-22 (detection integration point), D-24 (sent_to_user flag para retry de notificações), D-10/D-11/D-12 (cooldown logic)
- `.planning/phases/05-metagame-integration/05-CONTEXT.md` — D-01 (top 50 por formato), D-02 (weekly refresh cron), D-07 (userId = 1)
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` — single-user mode, Redis setup, chat ID whitelist
- `.planning/phases/02-core-data-collection/02-CONTEXT.md` — circuit breaker config, rate limiter presets, smart-refresh logic

### Existing Code to Modify / Extend
- `src/scraper/circuit-breaker.ts` — circuit breaker atual; retry layer wraps the function BEFORE wrapWithCircuitBreaker
- `src/scraper/orchestrator.ts` — orquestrador a ser modificado para suporte a concorrência (p-limit) e retry
- `src/scheduler/jobs.ts` — integração de health alerting (circuit breaker event → send Telegram alert)
- `src/lib/telegram.ts` — bot instance para envio de health alerts
- `src/lib/ratelimit/rate-limiter.ts` — rate limit presets existentes para calibrar p-limit

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — arquitetura do sistema para contexto
- `.planning/codebase/STRUCTURE.md` — estrutura de diretórios

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/scraper/circuit-breaker.ts` `wrapWithCircuitBreaker`**: wrapper genérico — o retry pode ser adicionado como wrapper externo que chama o fn original (antes de envolver com circuit breaker), mantendo a separação de concerns.
- **`src/lib/telegram.ts` `bot.api.sendMessage`**: já testado e usado pelas fases anteriores — usar para health alerts sem nova infraestrutura.
- **`src/scheduler/jobs.ts`**: os circuit breaker events (`breaker.on('open', ...)`) já logam via Winston — o hook de Telegram alert pode ser adicionado aqui ou nos circuit breaker configs.
- **`src/lib/ratelimit/rate-limiter.ts`**: rate limits configurados (Scryfall: 10/s, Telegram: 100/min, TCGPlayer: 50/min) — usados para calibrar concorrência máxima.

### Established Patterns
- **Circuit breaker events** (`breaker.on('open', ...)`) já existem em `circuit-breaker.ts` para logging — adicionar callback de Telegram alert ao evento `open` segue o mesmo padrão.
- **Env vars para tunables** — Phase 1/2/4 já usam `.env` para thresholds; concurrency limits e retry counts devem seguir o mesmo padrão (ex: `SCRAPER_CONCURRENCY_PER_SOURCE=5`, `SCRAPER_RETRY_ATTEMPTS=3`).
- **Sequential orchestration** — `src/scraper/orchestrator.ts` `fetchAllPrices` itera cartas sequencialmente por fonte; será refatorado para usar p-limit mantendo a mesma interface de retorno.

### Integration Points
- **Retry layer**: nova função `withRetry(fn, maxAttempts, baseDelayMs)` em `src/lib/` ou diretamente em `src/scraper/` — envolve o fetcher antes do circuit breaker.
- **Concurrency**: `p-limit` (ou similar) adicionado ao `fetchAllPrices` em `src/scraper/orchestrator.ts`.
- **Health alerts**: callback adicionado ao evento `open` do circuit breaker em cada provider, usando `bot.api.sendMessage` do `src/lib/telegram.ts`.

</code_context>

<specifics>
## Specific Ideas

- O alerta de circuit aberto deve incluir o nome da fonte (ex: "TCGPlayer") e ser claro que é temporário (60s reset) para não causar pânico.
- O retry com exponential backoff deve respeitar o rate limiter existente — se a falha for 429 (rate limit), o retry delay deve ser maior (talvez usar o Retry-After header se disponível).
- Com `p-limit` de 5 por fonte × 4 fontes = 20 requests simultâneos máximos no pico — razoável e dentro dos rate limits.

</specifics>

<deferred>
## Deferred Ideas

- **Per-format enable/disable toggle** — foi adiado da Phase 5 mas o usuário não priorizou em Phase 6. Claude pode implementar via env var como bonus simples (ex: `MONITOR_COMMANDER=false`). Se complexo, fica para v2.
- **Dashboard Redis caching** — usuário não priorizou. Claude tem discrição para adicionar se benchmark de página mostrar > 2s.
- **Endpoint /health HTTP** — não priorizado. Claude pode adicionar como bonus passivo (1 route handler) se simples.
- **Resumo de saúde diário** — não foi pedido, mas poderia ser útil (1x/dia, bot envia status de todas as fontes). Bônus opcional.
- **Retry-After header handling** — para sources que retornam 429 com header, usar o delay sugerido. Bonus de resiliência.

</deferred>

---

*Phase: 06-polish-optimization*
*Context gathered: 2026-05-09*
