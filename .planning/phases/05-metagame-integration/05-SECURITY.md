---
phase: 5
slug: metagame-integration
status: verified
threats_open: 0
asvs_level: L1
created: 2026-05-08
---

# Phase 5 — Security: Metagame Integration

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Drizzle schema → live Postgres | `drizzle-kit push` applies DDL; unintended destructive changes if schema diverges | DDL (additive only — boolean column with DEFAULT) |
| External HTTP (EDHREC, MTGTop8) → process memory | Untrusted JSON/HTML responses parsed into card name strings | Public metagame data, no secrets |
| Card names → wishlists.cardId | Names flow to DB via orchestrator; varchar(255) limit must be honored | Plain text, length-capped |
| Card name strings → Scryfall API | Names sent in POST body; Scryfall sanitizes server-side | Public data, no auth tokens |
| Scryfall response → process memory | Untrusted JSON shaped into ResolvedCard[]; bounded by BATCH_SIZE | Card metadata (oracle_id, name) |
| Rate limit Redis → request gating | If Redis is down, checkRateLimitPreset throws | Internal gating signal |
| Removal logic → wishlists rows | Single point where user-added cards could be destroyed if isAutoAdded filter is missing | User wishlist rows |
| process.env → cron schedule string | Malformed CRON_METAGAME_REFRESH could crash scheduler at boot | Cron expression string |

---

## Threat Register

### Plan 01 — Schema & Rate Limit Primitives

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-5-01-01 | Tampering | `drizzle-kit push` against live DB | mitigate | Task 3 greps push output for `DROP TABLE`/`DROP COLUMN`; aborts if found. Change is purely additive (ADD COLUMN with DEFAULT). | closed |
| T-5-01-02 | Information Disclosure | Push output `/tmp/push-task3.out` | mitigate | Temp file, not committed; drizzle-kit redacts password in DATABASE_URL by default. | closed |
| T-5-01-03 | Denial of Service | `wishlists.is_auto_added` unbounded growth | accept | Phase 5 inserts at most 150 rows total (50 per format × 3 formats). DEFAULT false on existing rows is O(table size) but wishlists is ~tens of rows in v1. | closed |
| T-5-01-04 | Tampering | Removal logic in Plan 04 destroying user-added rows | mitigate | Column existence + NOT NULL + DEFAULT false is the foundation that makes Plan 04's `WHERE is_auto_added = true` filter meaningful. | closed |
| T-5-01-05 | Spoofing | External card name strings → `wishlists.cardId` | transfer | Card names validated downstream in Plans 02/03 (max 255 chars per varchar limit). Plan 01 only adds the column. | closed |
| T-5-01-06 | Information Disclosure | Test stubs leak environment details | mitigate | Stubs contain only `it.todo()` placeholders — no env-var reads, network calls, or DB writes. | closed |
| T-5-01-07 | Denial of Service | Scryfall HTTP 429 from heavy-endpoint abuse | mitigate | Added `RATE_LIMITS.SCRYFALL_HEAVY` preset (2 req/s) matching Scryfall's documented limit. Plan 03 uses it. | closed |

### Plan 02 — Metagame Fetchers (EDHREC, MTGTop8)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-5-02-01 | Tampering | EDHREC/MTGTop8 returning huge/malicious payloads | mitigate | Both fetchers cap each name at 255 chars (`slice(0, 255)`) and `slice(0, limit)` total entries. Memory bound ~12.5KB per fetch. | closed |
| T-5-02-02 | Spoofing | DNS poisoning / MITM to attacker host | accept | Standard HTTPS PKI; no certificate pinning required for read-only public metagame data. Low-value, no secrets. | closed |
| T-5-02-03 | Information Disclosure | axios error messages leaking internals | mitigate | Error logs include `error.message` only (not full stack or config). No env vars or DATABASE_URL serialized. | closed |
| T-5-02-04 | Denial of Service | EDHREC/MTGTop8 unavailable / slow | mitigate | try/catch returns `[]`; logger.error fires; orchestrator treats empty result as "skip this format." No retry storm. | closed |
| T-5-02-05 | Tampering | Stale MTGTop8 meta ID returning empty/wrong cards | mitigate | `MIN_EXPECTED_ROWS=20` guard — fewer rows returns empty result + warning log. | closed |
| T-5-02-06 | Input Validation | Card names containing SQL/HTML metacharacters | mitigate | DB writes via Drizzle parameterized queries (Plan 04). HTML rendering of names is plain text only. varchar(255) cap honored. | closed |
| T-5-02-07 | Repudiation | No audit log of which source returned which cards | accept | `logger.info("MTGTop8 ${format}: fetched N top cards")` provides sufficient observability for v1. Per-card audit out of scope. | closed |
| T-5-02-08 | Denial of Service | Massive HTML payload from compromised MTGTop8 | mitigate | axios default response size limit (10MB) protects process. cheerio handles malformed HTML gracefully. Slice-to-limit applied after parse. | closed |

### Plan 03 — Scryfall Resolver

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-5-03-01 | Denial of Service | HTTP 429 from Scryfall (rate limit abuse) | mitigate | `RATE_LIMITS.SCRYFALL_HEAVY` (2 req/s) gates each batch; retry once with 500ms sleep; skip batch on persistent denial. | closed |
| T-5-03-02 | Tampering | Malicious Scryfall response | accept | Risk tolerance: Scryfall is a known authoritative source for MTG card metadata. OWASP IL2 trust level. | closed |
| T-5-03-03 | Information Disclosure | axios error messages exposing request shape | mitigate | logger.error logs `error.message` only (not `error.config` or stack). No bearer tokens or DATABASE_URL in context. | closed |
| T-5-03-04 | Repudiation | No log of names sent to Scryfall | accept | `logger.info("Scryfall resolver: resolved N/M names")` provides counts; per-name audit not required for v1. | closed |
| T-5-03-05 | Tampering | Empty `oracle_id` from Scryfall response | mitigate | Code filters: `if (card.oracle_id && card.name)` before pushing results. Empty oracle_ids silently dropped. | closed |
| T-5-03-06 | Denial of Service | Adversarial input causing many tiny batches | mitigate | `BATCH_SIZE=75` means 1000 names → 14 batches; rate limit gate (2 req/s) → ~7s end-to-end. Bounded resource use. | closed |
| T-5-03-07 | Spoofing | DNS/MITM redirecting api.scryfall.com | accept | Standard HTTPS PKI; consistent with Phase 2 Scryfall calls. No certificate pinning required. | closed |
| T-5-03-08 | Input Validation | Names with newlines/control chars sent to Scryfall | mitigate | Plan 02 fetchers already trim; resolver re-applies `.trim()` and filters empty (defense in depth). Names in JSON body (no URL encoding concerns). | closed |

### Plan 04 — Metagame Orchestrator

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-5-04-01 | Tampering (data loss) | Removal query missing `isAutoAdded` filter destroys user rows | mitigate | Delete clause: `and(eq(wishlists.userId, 1), eq(wishlists.isAutoAdded, true), notInArray(...))`. Test verifies WHERE clause applied. Acceptance grep confirms `eq(wishlists.isAutoAdded, true)`. | closed |
| T-5-04-02 | Tampering | FK violation inserting wishlist row before card exists | mitigate | D-06: query existing oracleIds via inArray; missing ones go through `upsertResolvedCards` BEFORE wishlist insert. Test verifies ordering. | closed |
| T-5-04-03 | Denial of Service | One bad source aborts the whole refresh | mitigate | All three fetchers return `[]` on failure (Plan 02 guarantee). Orchestrator try/catch wraps DB activity. Test verifies continue-with-remaining behavior. | closed |
| T-5-04-04 | Spoofing | `source` value in ScryfallCard | N/A | Plan 04 does not write to opportunities or prices — only cards and wishlists keyed on oracle_id. | closed |
| T-5-04-05 | Information Disclosure | DB error messages leak schema info | mitigate | `logger.error` logs `error.message` only. Production Winston redacts via formatter. | closed |
| T-5-04-06 | Denial of Service | Massive resolved array (>>150 cards) due to bug | mitigate | Hard cap: each fetcher returns at most `TOP_LIMIT_PER_FORMAT=50`. Set deduplication ensures combined.size ≤ 150. | closed |
| T-5-04-07 | Tampering | Race between concurrent refreshes | accept | Weekly cron (Sunday 2AM) is single-flight; node-cron does not retrigger before previous run completes. No concurrent invocation in v1. | closed |
| T-5-04-08 | Repudiation | No audit trail of cards added/removed per run | mitigate | `logger.info` logs perFormat counts and addedCount; structured summary returned to caller for further logging. | closed |
| T-5-04-09 | Input Validation | Card names with SQL/HTML metacharacters | mitigate | All DB writes via Drizzle parameterized queries. Names stored as plain text in varchar(255). | closed |

### Plan 05 — Metagame Scheduler

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-5-05-01 | Denial of Service | Malformed `CRON_METAGAME_REFRESH` env var crashes scheduler at boot | mitigate | node-cron validates expression and throws on registration. Default `'0 2 * * 0'` hardcoded as fallback when env var unset. | closed |
| T-5-05-02 | Tampering | Cron firing more often than weekly | mitigate | Even if misconfigured, orchestrator removal logic STILL filters `isAutoAdded=true` (Plan 04) — user-added rows never destroyed. Operational risk only. | closed |
| T-5-05-03 | Information Disclosure | Logged summary contains card names | accept | logger.info logs addedCount, removedCount, perFormat counts (numbers only) — NOT card names. Schedule string logged in plaintext but not sensitive. | closed |
| T-5-05-04 | Tampering | Multiple `scheduleMetagameRefresh()` invocations leak orphaned tasks | accept | Consistent with existing scheduler pattern (`schedulePriceCollection`). Bot bootstrap calls each scheduler exactly once. Operational concern only. | closed |
| T-5-05-05 | Repudiation | No log when cron is registered or fires | mitigate | Three log points: registration, trigger, and completion with summary. | closed |
| T-5-05-06 | Spoofing | Env var injection via `.env.local` with malicious schedule | accept | Single-user mode; `.env.local` is not user-supplied data. `.env.example` documents the safe default. | closed |
| T-5-05-07 | Denial of Service | Scheduler callback throws unhandled rejection | mitigate | Outer try/catch in cron callback (in addition to orchestrator's inner try/catch). Verified by "does NOT throw" test. | closed |
| T-5-05-08 | Denial of Service | TZ env var unset causes cron to fire at unexpected UTC time | accept | node-cron uses system TZ. Default `'0 2 * * 0'` interpreted in server local time. Operational concern; documented in code comment. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party) · N/A*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-5-01 | T-5-01-03 | Wishlists table is ~tens of rows in v1; O(table size) DEFAULT backfill is negligible. Revisit at scale. | Phase 5 review | 2026-05-08 |
| AR-5-02 | T-5-02-02 | HTTPS PKI sufficient for read-only public metagame data. No secrets transmitted. | Phase 5 review | 2026-05-08 |
| AR-5-03 | T-5-02-07 | Per-card audit log is v2 scope. logger.info per-format counts are sufficient for v1 observability. | Phase 5 review | 2026-05-08 |
| AR-5-04 | T-5-03-02 | Scryfall is a known authoritative MTG data source. Treating responses as authoritative is standard practice. | Phase 5 review | 2026-05-08 |
| AR-5-05 | T-5-03-04 | Per-name audit not required for v1. Aggregated counts sufficient. | Phase 5 review | 2026-05-08 |
| AR-5-06 | T-5-03-07 | Standard HTTPS PKI; consistent with other Scryfall calls in codebase. | Phase 5 review | 2026-05-08 |
| AR-5-07 | T-5-04-07 | Single-flight weekly cron; no concurrent invocation in v1. isRunning guard deferred to v2 if needed. | Phase 5 review | 2026-05-08 |
| AR-5-08 | T-5-05-03 | Summary log contains counts only (addedCount, removedCount) — not card names. Schedule string is non-sensitive. | Phase 5 review | 2026-05-08 |
| AR-5-09 | T-5-05-04 | Consistent with existing `schedulePriceCollection` pattern. Bot bootstrap prevents double-registration in practice. | Phase 5 review | 2026-05-08 |
| AR-5-10 | T-5-05-06 | `.env.local` is developer-controlled; not user-supplied input. | Phase 5 review | 2026-05-08 |
| AR-5-11 | T-5-05-08 | Operational concern only. Default `'0 2 * * 0'` is predictable. Explicit TZ handling deferred to v2. | Phase 5 review | 2026-05-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-08 | 40 | 40 | 0 | gsd-secure-phase (artifact-based) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-08
