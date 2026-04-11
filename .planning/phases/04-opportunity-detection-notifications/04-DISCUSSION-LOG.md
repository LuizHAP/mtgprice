# Phase 4: Opportunity Detection & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 04-opportunity-detection-notifications
**Areas discussed:** Detection criteria, Detection scope, Batching & cooldowns, Notification surface (alerts + /history + /config)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Detection criteria | Thresholds, lookback, baseline, AND/OR | ✓ |
| Detection scope | Which cards get evaluated | ✓ (explored in round 2) |
| Batching & cooldowns | Anti-fatigue strategy | ✓ (explored in round 2) |
| Notification surface | Alert format, /history, /config | ✓ (explored in round 2) |

**User's choice:** Initially selected only "Detection criteria", then opted to continue exploring the remaining areas after criteria was locked.

---

## Detection Criteria — Round 1

### Q1: What % price drop should trigger an opportunity check?

| Option | Description | Selected |
|--------|-------------|----------|
| 15% (Recommended) | Conservative default; balances signal vs noise | ✓ |
| 10% | More aggressive, catches smaller dips, noisier | |
| 20% | Very conservative, only real crashes | |

**User's choice:** 15%

### Q2: What's the lookback window for the 'recent drop' comparison?

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days (Recommended) | Matches DETECT-01 literal reading; reuses calculatePriceTrend | ✓ |
| 3 days | Faster reaction, more outlier-sensitive | |
| 14 days | Smoother, less reactive | |

**User's choice:** 7 days

### Q3: How should 'historical average' be computed?

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day mean (Recommended) | Standard moving average, easy TimescaleDB query | ✓ |
| 30-day median | Robust to outliers, harder query | |
| All-time mean | Most stable, anchors to stale prices | |

**User's choice:** 30-day mean

### Q4: Should both conditions be required or does either fire an alert?

| Option | Description | Selected |
|--------|-------------|----------|
| Both required — AND (Recommended) | Literal DETECT-01; higher-quality alerts | ✓ |
| Either condition — OR | More alerts, higher fatigue | |
| Tiered — both=high, one=low | Two severity levels, more complexity | |

**User's choice:** Both required — AND

---

## Detection Criteria — Round 2 (follow-ups)

### Q5: Per-source or aggregated best-price detection?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-source (Recommended) | Independent evaluation per source; matches DETECT-04 'fonte(s)' | ✓ |
| Aggregated best-price only | Single best-price series, simpler, hides source | |
| Both tracked, alert on best-price | Middle ground, more complex | |

**User's choice:** Per-source

### Q6: Minimum price history before detection is eligible?

| Option | Description | Selected |
|--------|-------------|----------|
| At least 30 days (Recommended) | Aligns with 30-day baseline | ✓ |
| At least 7 days | Only needs drop-window filled | |
| At least 14 days | Middle ground | |

**User's choice:** At least 30 days

### Q7: Defense against single-run outliers?

| Option | Description | Selected |
|--------|-------------|----------|
| Require 2 consecutive runs (Recommended) | Cheap to implement, kills glitches | ✓ |
| Drop top/bottom 5% of baseline window | Protects baseline only | |
| No guard | Simplest, relies on circuit breaker | |

**User's choice:** Require 2 consecutive runs below threshold

---

## Detection Scope

### Q8: Which cards should be evaluated for opportunities each run?

| Option | Description | Selected |
|--------|-------------|----------|
| Wishlist cards only (Recommended) | Matches single-user mode; Phase 5 expands via wishlist | ✓ |
| All cards in DB | Broader, noisier | |
| Wishlist + tagged 'watchlist' | New schema, flexibility | |

**User's choice:** Wishlist cards only

---

## Batching & Cooldowns

### Q9: How should alerts be grouped to prevent fatigue (DETECT-03)?

| Option | Description | Selected |
|--------|-------------|----------|
| One digest per collection run (Recommended) | Max 3 alerts/day, predictable | ✓ |
| One digest per day | 1 alert/day, morning ops stale | |
| Per-card immediate | Highest responsiveness and fatigue | |

**User's choice:** One digest per collection run

### Q10: Same-card cooldown — how long before re-alerting?

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days (Recommended) | Matches lookback window, clean mental model | ✓ |
| 24 hours | More responsive, higher fatigue | |
| Until recovery then drop | Smartest, most complex state | |

**User's choice:** 7 days

---

## Notification Surface

### Q11: Telegram opportunity digest format?

| Option | Description | Selected |
|--------|-------------|----------|
| Emoji header + one line per card (Recommended) | Matches Phase 3 /list style, dense, mobile-friendly | ✓ |
| Multi-line block per card | Clearer but 4x longer | |
| MarkdownV2 with inline buttons | Rich, callback complexity, escape pitfalls | |

**User's choice:** Emoji header + one line per card

### Q12: What should /history show?

| Option | Description | Selected |
|--------|-------------|----------|
| Last 10 opportunities all time (Recommended) | Simple ORDER BY DESC LIMIT 10 | ✓ |
| All opportunities from last 7 days | Time-bound, can be noisy | |
| Summary stats only | Compact, less actionable | |

**User's choice:** Last 10 opportunities across all time

### Q13: What does /config expose as user-tunable?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only display (Recommended) | Simplest for single-user; tune via .env + restart | ✓ |
| Editable threshold + enable/disable | Requires settings table | |
| Full tunable | Maximum complexity, overkill for v1 | |

**User's choice:** Read-only display of current settings

---

## Claude's Discretion

Explicitly deferred to planner/implementer:
- TimescaleDB query pattern for 30-day mean (continuous aggregate vs ad-hoc AVG)
- Logger field names and log levels for detection pipeline
- Module structure (dedicated detection module vs inline in scheduler)
- Test organization (per-rule vs table-driven)
- UTC vs America/Sao_Paulo timestamp handling
- Index strategy on the new `opportunities` table

## Deferred Ideas

- Editable `/config` (v2, multi-user)
- Tiered alert severity (strong/watchlist)
- Inline keyboards (Snooze / Mark Bought / Open Card)
- Recovery-aware cooldown state machine
- 30-day median baseline (outlier-robust alternative)
- Web dashboard view of opportunities (v2 ANALY-01/02)
- Per-source filtering for alerts
- Alerts for cards not in wishlist (Phase 5 metagame decision)
