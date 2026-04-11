# Phase 4: Opportunity Detection & Notifications - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Detects buying opportunities from accumulated price history and delivers them to the user via Telegram without alert fatigue. Adds `/history` and `/config` bot commands. Covers requirements DETECT-01, DETECT-02, DETECT-03, DETECT-04, NOTIF-01, NOTIF-02.

**Explicitly out of scope for Phase 4:**
- Auto-monitoring based on metagame (Phase 5)
- Price charts / visualizations (v2 — ANALY-01)
- Mobile app, push notifications outside Telegram (v2)
- ML-based price prediction (OOS per REQUIREMENTS.md)
- Inline buttons / callback handlers (deferred — plain text is enough for v1)
- Editable settings via Telegram (deferred — /config is read-only in v1)

</domain>

<decisions>
## Implementation Decisions

### Detection Criteria

- **D-01:** Price-drop threshold is **15%**. A card/source pair is a candidate when the latest price is ≥15% below the price 7 days ago.
- **D-02:** Lookback window for the recent-drop comparison is **7 days** — matches DETECT-01's "última semana" and reuses the existing `calculatePriceTrend` helper in `src/lib/wishlist/queries.ts`.
- **D-03:** Historical baseline is the **30-day arithmetic mean** of `price_brl` per `(card_id, source)` from the `prices` hypertable. Query shape: `AVG(price_brl) WHERE timestamp > now() - interval '30 days'`.
- **D-04:** Both conditions must be true (**AND**) to fire an alert — literal reading of DETECT-01. `(latest ≤ baseline30d) AND (latest ≤ price_7d_ago * 0.85)`.
- **D-05:** Detection runs **per-source**, not on the aggregated best price. Each of the 4 sources is evaluated independently; a card can fire because TCGPlayer dropped even if Liga Magic is stable. DETECT-04's `fonte(s)` field is populated with the specific source that tripped.
- **D-06:** **Cold-start guard:** a `(card_id, source)` pair needs **at least 30 days** of price history before it becomes eligible for detection. Freshly-added cards wait ~1 month. Pairs with <30 days are silently skipped.
- **D-07:** **Outlier defense:** the criteria must be met on **two consecutive collection runs** for the same `(card_id, source)` before an alert fires. The scheduler runs 3x/day so confirmation lag is ~4–8h. Kills most one-off scraping glitches without new query complexity.

### Detection Scope

- **D-08:** Only **wishlist cards** are evaluated each run. Query joins `wishlists` → `cards` → `prices`. Phase 5 (metagame) will auto-add format staples into the wishlist table, so coverage expands naturally without changing this logic.
- **D-09:** Single-user mode from Phase 1 means a single wishlist owner; the detector does not need per-user sharding. The `user_id` from Phase 1's whitelisted user is the only subject of all alerts.

### Batching & Cooldowns (Alert Fatigue Defense)

- **D-10:** **One digest per collection run.** After the scheduler finishes `fetchAllPrices` (9AM, 3PM, 9PM), run detection, then send a single Telegram message listing every opportunity found in that run. Silence the message entirely if zero opportunities — do not send "nothing to report" spam.
- **D-11:** **At most 3 alert messages per day** — a direct consequence of D-10 since the cron runs 3x. No additional per-day cap needed.
- **D-12:** **Per-card/source cooldown: 7 days.** After firing an alert for a `(card_id, source)` pair, that pair is silenced for 7 days regardless of continued drops. This matches the lookback window and gives the user a clean "alerted this week / alerted again next week" mental model.
- **D-13:** Cooldown is **tracked via the opportunities table** (see D-16) — querying `WHERE detected_at > now() - interval '7 days'` is enough. No separate cooldown table.

### Notification Surface — Alert Message

- **D-14:** **Alert format** is emoji-header + one line per card, matching Phase 3 `/list` patterns. Example:
  ```
  🔥 3 oportunidades (15/04 15:00)
  ↓ Black Lotus — R$ 4250 (TCGPlayer) — ↓18% (média R$ 5200)
  ↓ Force of Will — R$ 180 (Liga Magic) — ↓22% (média R$ 240)
  ↓ Thoughtseize — R$ 95 (CardMarket) — ↓16% (média R$ 115)
  ```
  Dense, scannable, text-only. Fields per line satisfy DETECT-04: card name, current price, source, % drop vs 7d ago, 30-day mean baseline.
- **D-15:** **Timestamp format** is `DD/MM HH:mm` in server local time (America/Sao_Paulo), matching cron schedule timing. If the bot is started with a different `TZ`, log a warning.

### Notification Surface — /history Command

- **D-16:** `/history` shows the **10 most recent opportunities** across all time. Query `ORDER BY detected_at DESC LIMIT 10` against a new `opportunities` table.
- **D-17:** **New table `opportunities`** stores every detected alert for both /history and cooldown enforcement. Schema:
  ```
  id              serial PK
  card_id         varchar(255) FK -> cards.oracle_id
  source          varchar(20)                      -- 'liga_magic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'
  detected_at     timestamp NOT NULL DEFAULT now()
  current_price   numeric(10,2) NOT NULL           -- priceBrl at detection time
  baseline_price  numeric(10,2) NOT NULL           -- 30-day mean at detection time
  drop_percent    numeric(5,2) NOT NULL            -- e.g. 18.34
  sent_to_user    boolean NOT NULL DEFAULT false   -- delivery flag
  ```
- **D-18:** `/history` message format mirrors the digest format so users see a consistent display:
  ```
  📜 Últimas 10 oportunidades
  [03/04 15:00] ↓ Black Lotus — R$ 4250 (TCGPlayer) — ↓18%
  [02/04 21:00] ↓ Tarmogoyf — R$ 320 (CardMarket) — ↓15%
  ...
  ```

### Notification Surface — /config Command

- **D-19:** `/config` is **read-only in v1**. It displays the current detection configuration pulled from env vars and hardcoded constants. No write path from Telegram; tuning requires editing `.env` and restarting the bot.
- **D-20:** `/config` output format:
  ```
  ⚙️ Configuração atual
  Drop threshold: 15%
  Lookback: 7 dias
  Baseline: média de 30 dias
  Cooldown: 7 dias por carta/fonte
  Mínimo de histórico: 30 dias
  Runs diários: 09:00, 15:00, 21:00
  ```
- **D-21:** Env vars that drive `/config` (all with sane defaults so missing values don't break the bot):
  ```
  DETECT_DROP_THRESHOLD      default 0.15
  DETECT_LOOKBACK_DAYS       default 7
  DETECT_BASELINE_DAYS       default 30
  DETECT_COOLDOWN_DAYS       default 7
  DETECT_MIN_HISTORY_DAYS    default 30
  ```
  Editable `/config` (writable commands) is deferred to v2 once multi-user support exists.

### Pipeline Integration

- **D-22:** Detection runs **synchronously inside `executePriceCollection`** in `src/scheduler/jobs.ts`, after `fetchAllPrices` completes and before the function returns. One new helper `detectOpportunities()` is called with the full set of just-collected `(card_id, source, price)` tuples. Any failure in detection is logged but must not mark the collection run as failed.
- **D-23:** Alert delivery happens **at the end of detection**, not inline per card. Detection collects opportunities into an array, then the Telegram sender takes the array and produces a single digest message. Respects Phase 1's Telegram rate limiter.
- **D-24:** If Telegram send fails, the opportunities are still persisted to the `opportunities` table with `sent_to_user = false`. Next collection run's digest will include any unsent opportunities from the last 24h before the cooldown window hides them.

### Claude's Discretion

- Exact query patterns for the 30-day mean and 7-day lookback (TimescaleDB continuous aggregates vs ad-hoc AVG) — researcher/planner can pick based on data volume at collection time.
- Logger field names and log levels for the detection pipeline.
- Whether detection runs as a dedicated function module or as inline code inside the scheduler — planner's call based on file-size constraints.
- Unit test organization for the detection algorithm (one test per rule vs table-driven).
- Exact UTC vs America/Sao_Paulo handling for the digest timestamp if `TZ` is unset.
- Whether to index the `opportunities` table on `(card_id, source, detected_at DESC)` from day one or wait for slow queries.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` §Detecção de Oportunidade (DETECT-01…DETECT-04) — the binding feature spec for this phase.
- `.planning/REQUIREMENTS.md` §Notificações (NOTIF-01, NOTIF-02, NOTIF-03) — delivery requirements; NOTIF-03 (2–3x daily, not real-time) is already satisfied by Phase 2's scheduler.
- `.planning/ROADMAP.md` §"Phase 4: Opportunity Detection & Notifications" — phase goal and dependencies.
- `.planning/PROJECT.md` §Context and §Constraints — alert fatigue (40% churn) and IOF-adjusted prices context.

### Prior Phase Context (locked decisions that Phase 4 depends on)
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` — single-user mode, chat-ID whitelist, JWT / Telegram bot auth.
- `.planning/phases/02-core-data-collection/02-CONTEXT.md` — cron schedule 9/15/21h, TimescaleDB hypertable, smart refresh, circuit breaker, orchestrator ordering.
- `.planning/phases/03-user-interface-wishlist/03-CONTEXT.md` — wishlist table semantics, `/list` text formatting conventions that D-14 mirrors.

### Existing Code to Reuse / Extend
- `src/scheduler/jobs.ts` — `executePriceCollection` is where detection hooks in (D-22).
- `src/scraper/orchestrator.ts` — returns the `(card_id, source, price)` tuples detection consumes.
- `src/lib/wishlist/queries.ts` — `getUserWishlist`, `getPriceHistory`, `getLatestPricesForCard`, `getBestPrice`, `calculatePriceTrend` — all reusable.
- `src/db/schema/prices.ts` — TimescaleDB hypertable schema (queried for 30-day mean and 7-day lookback).
- `src/db/schema/wishlists.ts` — join source for detection scope (D-08).
- `src/bot/index.ts`, `src/bot/commands/*.ts` — grammY registration pattern; `/history` and `/config` follow the same shape as existing `/list`, `/price`.
- `src/lib/telegram.ts` — bot instance for digest delivery (D-23).
- `src/lib/ratelimit/rate-limiter.ts` — Telegram preset already sized for 100 req/min.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/STACK.md` — fresh system maps generated 2026-04-11.

### Schema changes this phase introduces
- New Drizzle schema file `src/db/schema/opportunities.ts` — table defined in D-17.
- New Drizzle migration (auto-generated) — adds the `opportunities` table + FK to `cards.oracle_id`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/wishlist/queries.ts`** — already exports `calculatePriceTrend(cardId, source)` and `getPriceHistory(cardId, limit)`. The 7-day drop half of the detection criteria is essentially already implemented; Phase 4 adds the 30-day baseline query and the AND combiner.
- **`src/scheduler/jobs.ts` `executePriceCollection`** — single-flight guarded (`isRunning` flag), logs success/failure, runs exactly 3x/day. Perfect hook point for `detectOpportunities()` per D-22.
- **`src/scraper/orchestrator.ts` `fetchAllPrices`** — returns full `(card_id, source, price_brl)` results; detection reads directly from what orchestrator just wrote to `prices`.
- **grammY bot command pattern** — adding `/history` and `/config` follows the same structure as Phase 3's `/list` and `/price` commands (see `src/bot/commands/list.ts` for message composition reference).
- **`src/lib/telegram.ts`** — bot instance with `bot.api.sendMessage(chatId, text)` already tested in Phase 3.
- **Winston logger** (`src/lib/logger.ts`) — used by scheduler and orchestrator; detection pipeline uses the same interface.

### Established Patterns
- **Structured logging** of cron job runs — detection logs should match the "🕒 Starting price collection…" style from `jobs.ts`.
- **Text-first bot messages** with emoji headers — Phase 3 `/list` format is the established aesthetic (dense, no attachments, mobile-friendly).
- **Drizzle schema + auto-generated SQL migration** — new `opportunities` table follows the existing `drizzle/` migration workflow.
- **Env vars for tunables** — Phase 1 and Phase 2 already lean on `.env` for thresholds (`SCRAPING_DELAY_MS`, `IOF_RATE`), so D-21 matches house convention.
- **Circuit breaker + smart refresh are upstream of detection** — bad sources are already suppressed before detection sees them.

### Integration Points
- **Detection insertion point:** end of `executePriceCollection` in `src/scheduler/jobs.ts`.
- **New bot commands:** `src/bot/commands/history.ts` and `src/bot/commands/config.ts`, wired into `src/bot/index.ts`.
- **New queries module:** `src/lib/opportunities/queries.ts` (detection logic + `opportunities` table CRUD) and a matching test file.
- **New schema file:** `src/db/schema/opportunities.ts` exported from `src/db/schema/index.ts`.
- **Env var additions:** `.env.example` gains the 5 `DETECT_*` vars from D-21.

### Tech Stack Context
- Next.js 15 + TypeScript strict — already in place.
- Drizzle ORM 0.38 — use typed queries, not raw SQL, unless TimescaleDB requires it.
- node-cron + grammY — both working in production, no version changes needed.
- PostgreSQL 16 + TimescaleDB 2.15 — baseline query can use standard SQL AVG; continuous aggregates are a potential optimization (planner's call).

### Missing Infrastructure (To be built in Phase 4)
- No `opportunities` table — new schema + migration.
- No detection algorithm module — greenfield in `src/lib/opportunities/`.
- No `/history` or `/config` bot commands — follow Phase 3 command pattern.
- No detection hook in scheduler — one-line call from `executePriceCollection`.

</code_context>

<specifics>
## Specific Ideas

**User preferences explicitly confirmed during discussion:**
- Conservative default thresholds (accept recommendations across the board) — user wants a v1 that doesn't over-alert.
- Full alignment with the literal reading of DETECT-01 ("caiu X% na última semana E abaixo da média histórica") — both conditions required.
- Single-user mindset preserved — no multi-user config state, no per-user settings storage.
- Digest style alerts, not individual pings — matches the anti-fatigue spirit of DETECT-03.

**Carried forward from prior phases (re-stated here so planner/researcher don't need to re-check):**
- Cron schedule 9:00 / 15:00 / 21:00 local time (Phase 2 CONTEXT).
- Scryfall `oracle_id` is the canonical card identifier (Phase 1 CONTEXT).
- `prices` is a TimescaleDB hypertable with composite index on `(card_id, timestamp DESC)` (Phase 1 CONTEXT).
- Telegram bot runs in long-polling mode in dev and talks to a whitelisted chat ID (Phase 1 CONTEXT).
- Text-only bot messages with emoji are the established format (Phase 3 CONTEXT).

**What's NOT in Phase 4:**
- Chart rendering, sparklines, images, PDF exports.
- Price forecasting / ML-based signals (explicit REQUIREMENTS.md exclusion).
- Multi-user settings tables or per-user thresholds.
- Configurable alert thresholds from inside Telegram (v2).
- Metagame-based auto-population of wishlist (Phase 5).
- New surface areas in the web dashboard — the dashboard is not modified in Phase 4.

</specifics>

<deferred>
## Deferred Ideas

**Raised during this discussion, noted for future phases:**
- **Editable `/config`** — threshold / lookback / enable-disable commands from Telegram. Belongs in v2 once multi-user support lands.
- **Tiered alert severity** — "strong" vs "watchlist" based on whether one or both DETECT-01 conditions trip. Adds DB column and message complexity; revisit if single-severity alerts under-serve the user.
- **Inline keyboards / callback handlers** — Snooze, Mark Bought, Open Card buttons on alerts. Deferred; plain text is sufficient for v1.
- **Recovered-then-dropped-again cooldown** — smarter state machine that re-alerts only on fresh downtrends. Revisit if the flat 7-day cooldown misses meaningful re-entries.
- **30-day median (outlier-robust) baseline** — considered but rejected for 30-day mean in v1. Worth revisiting if scraping outliers leak through D-07's consecutive-runs guard.
- **Dashboard surface for opportunities** — a web view of `/history` with filtering and charts. Belongs with the v2 analytics requirements (ANALY-01, ANALY-02).
- **Per-source filtering in detection** (e.g., "only alert me for Liga Magic cards") — waits for editable `/config`.
- **Alert for cards the user does not own / not in wishlist** — waits for the Phase 5 metagame auto-population decision.

</deferred>

---

*Phase: 04-opportunity-detection-notifications*
*Context gathered: 2026-04-11*
