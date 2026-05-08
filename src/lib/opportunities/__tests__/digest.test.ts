import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all external dependencies
vi.mock('@/lib/telegram', () => ({
  bot: {
    api: {
      sendMessage: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ratelimit/rate-limiter', () => ({
  RATE_LIMITS: {
    TELEGRAM: { limit: 100, interval: 60 },
  },
  checkRateLimitPreset: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../queries', () => ({
  insertOpportunity: vi.fn(),
  markOpportunitySent: vi.fn(),
  getUnsentOpportunitiesLast24h: vi.fn(),
}))

import { bot } from '@/lib/telegram'
import { logger } from '@/lib/logger'
import { checkRateLimitPreset } from '@/lib/ratelimit/rate-limiter'
import { insertOpportunity, markOpportunitySent, getUnsentOpportunitiesLast24h } from '../queries'
import { buildDigest, formatSaoPauloTimestamp, sendDigestAndPersist } from '../digest'
import type { DetectedOpportunity } from '../queries'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const blackLotus: DetectedOpportunity = {
  cardId: 'black-lotus-id',
  cardName: 'Black Lotus',
  source: 'tcgplayer',
  currentPrice: 4250,
  baselinePrice: 5200,
  sevenDayAgoPrice: 5200,
  dropPercent: 18,
}

const forceOfWill: DetectedOpportunity = {
  cardId: 'force-of-will-id',
  cardName: 'Force of Will',
  source: 'ligamagic',
  currentPrice: 180,
  baselinePrice: 240,
  sevenDayAgoPrice: 240,
  dropPercent: 22,
}

const thoughtseize: DetectedOpportunity = {
  cardId: 'thoughtseize-id',
  cardName: 'Thoughtseize',
  source: 'cardmarket',
  currentPrice: 95,
  baselinePrice: 115,
  sevenDayAgoPrice: 115,
  dropPercent: 16,
}

// Fixed timestamp: 2026-04-15T18:00:00Z → 15:00 in America/Sao_Paulo (UTC-3)
const FIXED_NOW = new Date('2026-04-15T18:00:00Z')

// ─── beforeEach / afterEach ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Default mocks for happy path
  vi.mocked(insertOpportunity).mockResolvedValue({ id: 42, sentToUser: false })
  vi.mocked(markOpportunitySent).mockResolvedValue(undefined)
  vi.mocked(getUnsentOpportunitiesLast24h).mockResolvedValue([])
  vi.mocked(checkRateLimitPreset).mockResolvedValue({ allowed: true, remaining: 99 })
  vi.mocked(bot.api.sendMessage).mockResolvedValue({} as never)
  process.env.TELEGRAM_CHAT_ID = '12345'
})

afterEach(() => {
  delete process.env.TELEGRAM_CHAT_ID
})

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('buildDigest', () => {
  it('Test 1: produces verbatim D-14 format for 3 opportunities', () => {
    const result = buildDigest([blackLotus, forceOfWill, thoughtseize], FIXED_NOW)
    const expected = [
      '🔥 3 oportunidades (15/04 15:00)',
      '↓ Black Lotus — R$ 4250 (TCGPlayer) — ↓18% (média R$ 5200)',
      '↓ Force of Will — R$ 180 (Liga Magic) — ↓22% (média R$ 240)',
      '↓ Thoughtseize — R$ 95 (CardMarket) — ↓16% (média R$ 115)',
    ].join('\n')
    expect(result).toBe(expected)
  })

  it('Test 2: singular form "oportunidade" when count is 1', () => {
    const result = buildDigest([blackLotus], FIXED_NOW)
    expect(result).toMatch(/^🔥 1 oportunidade \(/)
    expect(result).not.toMatch(/oportunidades/)
  })

  it('Test 3: throws Error with "empty" when opportunities is empty', () => {
    expect(() => buildDigest([], FIXED_NOW)).toThrow(/empty/i)
  })

  it('Test 4: formatSaoPauloTimestamp returns "15/04 15:00" for 2026-04-15T18:00:00Z', () => {
    const result = formatSaoPauloTimestamp(new Date('2026-04-15T18:00:00Z'))
    expect(result).toBe('15/04 15:00')
  })

  it('Test 5: each data line uses em-dash U+2014', () => {
    const result = buildDigest([blackLotus, forceOfWill, thoughtseize], FIXED_NOW)
    const lines = result.split('\n').slice(1) // skip header
    for (const line of lines) {
      expect(line).toMatch(/—/)
    }
  })
})

describe('sendDigestAndPersist', () => {
  it('Test 6: empty list returns { persisted: 0, sent: false } without calling bot.api.sendMessage', async () => {
    const result = await sendDigestAndPersist([])
    expect(result).toEqual({ persisted: 0, sent: false })
    expect(bot.api.sendMessage).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('silent per D-10'))
  })

  it('Test 7: happy path — inserts opportunity, sends digest, marks sent', async () => {
    const result = await sendDigestAndPersist([blackLotus])
    expect(result).toEqual({ persisted: 1, sent: true })
    expect(insertOpportunity).toHaveBeenCalledOnce()
    expect(bot.api.sendMessage).toHaveBeenCalledOnce()
    // Verify the message contains the card name
    const [, text] = vi.mocked(bot.api.sendMessage).mock.calls[0]
    expect(text).toContain('Black Lotus')
    expect(markOpportunitySent).toHaveBeenCalledWith(42)
  })

  it('Test 8: bot.api.sendMessage rejects — persist first, no markSent, returns sent: false', async () => {
    vi.mocked(bot.api.sendMessage).mockRejectedValue(new Error('Network'))
    const result = await sendDigestAndPersist([blackLotus])
    expect(insertOpportunity).toHaveBeenCalled()
    expect(markOpportunitySent).not.toHaveBeenCalled()
    expect(result.sent).toBe(false)
    expect(result.error).toBe('Network')
    expect(result.persisted).toBe(1)
  })

  it('Test 9: TZ mismatch warning when process.env.TZ differs from America/Sao_Paulo', async () => {
    const originalTZ = process.env.TZ
    process.env.TZ = 'UTC'
    try {
      await sendDigestAndPersist([blackLotus])
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/TZ mismatch/))
    } finally {
      if (originalTZ === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTZ
      }
    }
  })

  it('Test 10: rate-limited — inserts but does not send, returns { persisted: 1, sent: false, error: "rate_limited" }', async () => {
    vi.mocked(checkRateLimitPreset).mockResolvedValue({ allowed: false, remaining: 0 })
    const result = await sendDigestAndPersist([blackLotus])
    expect(insertOpportunity).toHaveBeenCalled()
    expect(bot.api.sendMessage).not.toHaveBeenCalled()
    expect(markOpportunitySent).not.toHaveBeenCalled()
    expect(result).toEqual({ persisted: 1, sent: false, error: 'rate_limited' })
  })

  it('Test 11: merge with unsent — digest contains both cards, both markOpportunitySent calls made', async () => {
    const unsentOp: DetectedOpportunity & { id: number } = {
      id: 99,
      cardId: 'force-of-will-id',
      cardName: 'Force of Will',
      source: 'ligamagic',
      currentPrice: 180,
      baselinePrice: 240,
      sevenDayAgoPrice: 240,
      dropPercent: 22,
    }
    vi.mocked(getUnsentOpportunitiesLast24h).mockResolvedValue([unsentOp])

    const result = await sendDigestAndPersist([blackLotus])
    expect(result.persisted).toBe(1)
    expect(result.sent).toBe(true)

    // Digest text should contain both card names
    const [, text] = vi.mocked(bot.api.sendMessage).mock.calls[0]
    expect(text).toContain('Black Lotus')
    expect(text).toContain('Force of Will')

    // markOpportunitySent called for both fresh (42) and retry (99)
    expect(markOpportunitySent).toHaveBeenCalledWith(42)
    expect(markOpportunitySent).toHaveBeenCalledWith(99)
  })
})
