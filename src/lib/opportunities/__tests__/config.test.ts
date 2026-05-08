import { logger } from '@/lib/logger'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const ENV_VARS = [
  'DETECT_DROP_THRESHOLD',
  'DETECT_LOOKBACK_DAYS',
  'DETECT_BASELINE_DAYS',
  'DETECT_COOLDOWN_DAYS',
  'DETECT_MIN_HISTORY_DAYS',
  'CRON_MORNING',
  'CRON_AFTERNOON',
  'CRON_EVENING',
] as const

const savedEnv: Partial<Record<(typeof ENV_VARS)[number], string | undefined>> = {}

beforeEach(() => {
  // Snapshot current env vars
  for (const key of ENV_VARS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
  vi.clearAllMocks()
})

afterEach(() => {
  // Restore env vars
  for (const key of ENV_VARS) {
    const saved = savedEnv[key]
    if (saved === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = saved
    }
  }
})

describe('loadDetectionConfig', () => {
  it('Test 1: returns default numeric values when all DETECT_* env vars are unset', async () => {
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.dropThreshold).toBe(0.15)
    expect(config.lookbackDays).toBe(7)
    expect(config.baselineDays).toBe(30)
    expect(config.cooldownDays).toBe(7)
    expect(config.minHistoryDays).toBe(30)
  })

  it('Test 2: returns default cron expressions when CRON_* env vars are unset', async () => {
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.cronMorning).toBe('0 9 * * *')
    expect(config.cronAfternoon).toBe('0 15 * * *')
    expect(config.cronEvening).toBe('0 21 * * *')
  })

  it('Test 3: runTimesHuman is "09:00, 15:00, 21:00" for default cron strings', async () => {
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.runTimesHuman).toBe('09:00, 15:00, 21:00')
  })

  it('Test 4: parses DETECT_DROP_THRESHOLD="0.25" as number 0.25', async () => {
    process.env.DETECT_DROP_THRESHOLD = '0.25'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.dropThreshold).toBe(0.25)
  })

  it('Test 5: falls back to 0.15 and warns when DETECT_DROP_THRESHOLD is non-numeric ("abc")', async () => {
    process.env.DETECT_DROP_THRESHOLD = 'abc'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.dropThreshold).toBe(0.15)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DETECT_DROP_THRESHOLD'))
  })

  it('Test 6: falls back to 0.15 and warns when DETECT_DROP_THRESHOLD is negative ("-0.5")', async () => {
    process.env.DETECT_DROP_THRESHOLD = '-0.5'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.dropThreshold).toBe(0.15)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DETECT_DROP_THRESHOLD'))
  })

  it('Test 7: falls back to 7 and warns when DETECT_LOOKBACK_DAYS is "0" (zero is invalid)', async () => {
    process.env.DETECT_LOOKBACK_DAYS = '0'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.lookbackDays).toBe(7)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DETECT_LOOKBACK_DAYS'))
  })

  it('Test 8: parses DETECT_LOOKBACK_DAYS="14" as number 14', async () => {
    process.env.DETECT_LOOKBACK_DAYS = '14'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.lookbackDays).toBe(14)
  })

  it('Test 9: falls back to 0.15 and warns when DETECT_DROP_THRESHOLD is "NaN"', async () => {
    process.env.DETECT_DROP_THRESHOLD = 'NaN'
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(config.dropThreshold).toBe(0.15)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('DETECT_DROP_THRESHOLD'))
  })

  it('Test 10: DetectionConfig has exactly the 9 specified fields and nothing else', async () => {
    const { loadDetectionConfig } = await import('../config')
    const config = loadDetectionConfig()
    expect(Object.keys(config).sort()).toEqual([
      'baselineDays',
      'cooldownDays',
      'cronAfternoon',
      'cronEvening',
      'cronMorning',
      'dropThreshold',
      'lookbackDays',
      'minHistoryDays',
      'runTimesHuman',
    ])
  })
})
