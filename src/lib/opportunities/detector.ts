import type { DetectionConfig } from './config'

/**
 * Input data for the evaluateCandidate pure function.
 *
 * All price values are raw numbers (not strings) — the caller is responsible
 * for converting Drizzle `numeric` column strings to numbers before calling.
 */
export interface EvaluateInput {
  /** Most recent price for the (card, source) pair. null if no price row exists. */
  latest: number | null
  /** 30-day average price (baseline mean). null if fewer than baselineDays of data. */
  baseline: number | null
  /** Price approximately lookbackDays days ago (±6h tolerance). null if no row found. */
  sevenDayAgo: number | null
  /** Number of days of price history available for this (card, source) pair. */
  historyDays: number
}

/**
 * Result from evaluateCandidate.
 *
 * NOTE: This function implements D-01/D-02/D-03/D-04/D-06 only.
 * The D-07 two-consecutive-runs guard is implemented by the orchestrator
 * (detectOpportunitiesForWishlist) via the detection_candidates state machine —
 * NOT inside this pure function.
 */
export interface EvaluateResult {
  /** Whether this (card, source) pair qualifies as an opportunity on this run. */
  fires: boolean
  /**
   * The drop percentage as a positive number (e.g. 18.34 for an 18.34% drop).
   * Rounded to 2 decimal places. null when fires is false due to a precondition
   * failure (missing data or cold_start).
   */
  dropPercent: number | null
  /** Reason for not firing. Omitted when fires is true. */
  reason?:
    | 'above_baseline'
    | 'insufficient_drop'
    | 'cold_start'
    | 'no_lookback_price'
    | 'no_current_price'
    | 'no_baseline'
}

/**
 * Pure detection function implementing D-01/D-02/D-03/D-04/D-06.
 *
 * An opportunity fires when ALL of the following hold (AND semantics per D-04):
 *   1. historyDays ≥ config.minHistoryDays  (D-06 cold-start guard)
 *   2. latest is not null                   (D-01)
 *   3. baseline is not null                 (D-03)
 *   4. sevenDayAgo is not null and > 0      (D-02)
 *   5. latest ≤ baseline                    (D-03: price is below historical mean)
 *   6. latest ≤ sevenDayAgo * (1 - dropThreshold)  (D-04: drop ≥ threshold)
 *
 * Zero database access. Every call is deterministic given the same inputs.
 *
 * @param input  - Numeric price data for the (card, source) pair
 * @param config - Detection configuration (thresholds, lookback, etc.)
 * @returns EvaluateResult with fires flag, dropPercent, and optional reason
 */
export function evaluateCandidate(input: EvaluateInput, config: DetectionConfig): EvaluateResult {
  // D-06: cold-start guard — insufficient price history
  if (input.historyDays < config.minHistoryDays) {
    return { fires: false, dropPercent: null, reason: 'cold_start' }
  }

  // D-01: must have a current price
  if (input.latest === null) {
    return { fires: false, dropPercent: null, reason: 'no_current_price' }
  }

  // D-03: must have a baseline mean
  if (input.baseline === null) {
    return { fires: false, dropPercent: null, reason: 'no_baseline' }
  }

  // D-02: must have a valid lookback price (positive, non-null)
  if (input.sevenDayAgo === null || input.sevenDayAgo <= 0) {
    return { fires: false, dropPercent: null, reason: 'no_lookback_price' }
  }

  // Compute the drop percentage: positive means price fell
  const dropPercent = Math.round(((input.sevenDayAgo - input.latest) / input.sevenDayAgo) * 10000) / 100

  // D-03: latest must be at or below the 30-day baseline mean
  const meetsBaseline = input.latest <= input.baseline

  // D-04: drop must meet or exceed the configured threshold
  const meetsDrop = input.latest <= input.sevenDayAgo * (1 - config.dropThreshold)

  if (!meetsBaseline) {
    return { fires: false, dropPercent, reason: 'above_baseline' }
  }

  if (!meetsDrop) {
    return { fires: false, dropPercent, reason: 'insufficient_drop' }
  }

  return { fires: true, dropPercent }
}
