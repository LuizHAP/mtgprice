# Phase 5: Metagame Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 05-metagame-integration
**Areas discussed:** Card count & refresh cadence

---

## Card count & refresh cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Top 50 per format | Covers nearly all relevant staples without over-monitoring. ~150 cards total across 3 formats. | ✓ |
| Top 20 per format | Tight focus only, misses secondary staples | |
| Top 100 per format | Very broad, 300 cards total, significant fetch load | |
| Per-format custom | Different numbers per format (e.g. Standard 30, Modern 50, Commander 20) | |

**User's choice:** Top 50 per format

---

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly | Metagame shifts over days to weeks; weekly fits a Sunday cron job | ✓ |
| Daily | More responsive but 7x more API calls | |
| On-demand via bot command | Manual control, requires new /refresh-meta command | |
| Every price collection run (3x daily) | Always current but excessive external API traffic | |

**User's choice:** Weekly refresh

---

## Claude's Discretion

- Data source (MTGTop8 vs MTGGoldfish vs EDHREC): left to researcher/planner
- Storage approach (same wishlist table vs separate metagame_cards table): left to planner, defaulting to wishlist table per D-08 from Phase 4
- Removal policy (remove / keep / soft-delete when card leaves top-50): left to planner, default to remove for bounded list

## Deferred Ideas

- Pioneer/Legacy/Vintage/Pauper staples — v2 (META-04 through META-07)
- Per-format enable/disable toggle — Phase 6 polish
