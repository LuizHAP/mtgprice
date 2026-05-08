import { describe, expect, it } from 'vitest'
import type { DetectionConfig } from '../config'

// We import evaluateCandidate — will fail at RED phase since detector.ts doesn't exist yet
import { evaluateCandidate } from '../detector'

const baseConfig: DetectionConfig = {
  dropThreshold: 0.15,
  lookbackDays: 7,
  baselineDays: 30,
  cooldownDays: 7,
  minHistoryDays: 30,
  cronMorning: '0 9 * * *',
  cronAfternoon: '0 15 * * *',
  cronEvening: '0 21 * * *',
  runTimesHuman: '09:00, 15:00, 21:00',
}

describe('evaluateCandidate', () => {
  it('Test 1: fires when latest ≤ baseline AND drop ≥ threshold (canonical case)', () => {
    // latest=5200 ≤ baseline=5500 AND 5200 ≤ 6500*0.85=5525 → fires
    // dropPercent = (6500-5200)/6500 = 20.00%
    const result = evaluateCandidate(
      { latest: 5200, baseline: 5500, sevenDayAgo: 6500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(true)
    expect(result.dropPercent).toBeCloseTo(20.0, 1)
    expect(result.reason).toBeUndefined()
  })

  it('Test 2: does NOT fire when drop is below threshold (~1.8%, needs ≥15%)', () => {
    // latest=5400 ≤ baseline=5500, but 5400 > 5500*0.85=4675 → NOT below threshold enough
    const result = evaluateCandidate(
      { latest: 5400, baseline: 5500, sevenDayAgo: 5500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('insufficient_drop')
  })

  it('Test 3: does NOT fire when latest > baseline (above_baseline)', () => {
    // latest=6000 > baseline=5500 → above_baseline
    const result = evaluateCandidate(
      { latest: 6000, baseline: 5500, sevenDayAgo: 7500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('above_baseline')
  })

  it('Test 4: does NOT fire when historyDays < minHistoryDays (cold_start)', () => {
    // historyDays=10 < minHistoryDays=30 → cold_start
    const result = evaluateCandidate(
      { latest: 5200, baseline: 5500, sevenDayAgo: 6500, historyDays: 10 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('cold_start')
  })

  it('Test 5: does NOT fire when sevenDayAgo is null (no_lookback_price)', () => {
    const result = evaluateCandidate(
      { latest: 5200, baseline: 5500, sevenDayAgo: null, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('no_lookback_price')
    expect(result.dropPercent).toBeNull()
  })

  it('Test 6: does NOT fire when latest is null (no_current_price)', () => {
    const result = evaluateCandidate(
      { latest: null, baseline: 5500, sevenDayAgo: 6500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('no_current_price')
    expect(result.dropPercent).toBeNull()
  })

  it('Test 7: does NOT fire when baseline is null (no_baseline)', () => {
    const result = evaluateCandidate(
      { latest: 5200, baseline: null, sevenDayAgo: 6500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('no_baseline')
    expect(result.dropPercent).toBeNull()
  })

  it('Test 8: fires at exact boundaries (≤ is inclusive on both sides)', () => {
    // latest=5500.00 ≤ baseline=5500 AND 5500 ≤ 6470.59*0.85≈5500 → fires
    // dropPercent = (6470.59-5500)/6470.59 ≈ 15.00%
    const result = evaluateCandidate(
      { latest: 5500.0, baseline: 5500, sevenDayAgo: 6470.59, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(true)
    expect(result.dropPercent).toBeCloseTo(15.0, 0)
  })

  it('Test 9: does NOT fire when latest is just above baseline (5525 > 5500)', () => {
    // latest=5525 > baseline=5500 → above_baseline
    const result = evaluateCandidate(
      { latest: 5525.0, baseline: 5500, sevenDayAgo: 6500, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('above_baseline')
  })

  it('Test 10: dropPercent is positive for a price drop and rounded to 2 decimals', () => {
    // latest=4700, sevenDayAgo=6000 → drop = (6000-4700)/6000 = 21.67%
    const result = evaluateCandidate(
      { latest: 4700, baseline: 5500, sevenDayAgo: 6000, historyDays: 45 },
      baseConfig,
    )
    expect(result.fires).toBe(true)
    expect(result.dropPercent).toBe(21.67)
  })

  it('Test 11: cold_start check precedes other checks (historyDays=0, even with null inputs)', () => {
    const result = evaluateCandidate(
      { latest: null, baseline: null, sevenDayAgo: null, historyDays: 0 },
      baseConfig,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('cold_start')
  })

  it('Test 12: fires with custom dropThreshold of 0.20 (20%)', () => {
    const config20 = { ...baseConfig, dropThreshold: 0.2 }
    // latest=4700 ≤ baseline=5500, 4700 ≤ 6000*0.80=4800 → fires
    const result = evaluateCandidate(
      { latest: 4700, baseline: 5500, sevenDayAgo: 6000, historyDays: 45 },
      config20,
    )
    expect(result.fires).toBe(true)
  })

  it('Test 13: does NOT fire with custom dropThreshold of 0.20 when drop is only 18%', () => {
    const config20 = { ...baseConfig, dropThreshold: 0.2 }
    // latest=4920, sevenDayAgo=6000 → drop=(6000-4920)/6000=18% < 20% threshold
    const result = evaluateCandidate(
      { latest: 4920, baseline: 5500, sevenDayAgo: 6000, historyDays: 45 },
      config20,
    )
    expect(result.fires).toBe(false)
    expect(result.reason).toBe('insufficient_drop')
  })

  it('Test 14: cold_start respects minHistoryDays exactly (historyDays === minHistoryDays fires)', () => {
    // historyDays=30 === minHistoryDays=30 → should pass cold_start check
    const result = evaluateCandidate(
      { latest: 5200, baseline: 5500, sevenDayAgo: 6500, historyDays: 30 },
      baseConfig,
    )
    expect(result.fires).toBe(true)
  })
})
