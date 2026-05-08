/**
 * Tests for /history bot command handler.
 *
 * Mocking strategy:
 * - @/lib/telegram: stubbed bot that captures command handlers via bot.command(name, fn)
 * - @/lib/opportunities/queries: mocked getRecentOpportunities
 * - @/lib/logger: silenced
 *
 * NO mock for @/lib/opportunities/digest — history.ts does NOT import from digest.ts.
 * The formatSaoPauloTimestamp and SOURCE_DISPLAY_NAMES are inlined in history.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Map of registered command handlers: command name → handler fn
const commandHandlers: Record<string, (ctx: unknown) => Promise<void>> = {}

// Stub bot that captures bot.command('name', fn) registrations
const botStub = {
  command: vi.fn((name: string, handler: (ctx: unknown) => Promise<void>) => {
    commandHandlers[name] = handler
  }),
}

vi.mock('@/lib/telegram', () => ({ bot: botStub }))

vi.mock('@/lib/opportunities/queries', () => ({
  getRecentOpportunities: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { getRecentOpportunities } from '@/lib/opportunities/queries'
import type { OpportunityHistoryRow } from '@/lib/opportunities/queries'

// Importing the module registers the handler as a side effect
import '@/bot/commands/history'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockCtx() {
  return { reply: vi.fn().mockResolvedValue(undefined) }
}

/** Invoke the captured /history handler */
async function invokeHistory(ctx: ReturnType<typeof createMockCtx>) {
  const handler = commandHandlers.history
  if (!handler) throw new Error('/history handler was not registered')
  await handler(ctx)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('replies with empty message when no opportunities', async () => {
    vi.mocked(getRecentOpportunities).mockResolvedValue([])
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    expect(ctx.reply).toHaveBeenCalledWith('📜 Nenhuma oportunidade registrada ainda.')
  })

  it('replies with singular header and formatted row for a single opportunity', async () => {
    const rows: OpportunityHistoryRow[] = [
      {
        detectedAt: new Date('2026-04-15T18:00:00Z'), // UTC 18:00 → SP (UTC-3) 15:00
        cardName: 'Black Lotus',
        source: 'tcgplayer',
        currentPrice: 4250,
        dropPercent: 18,
      },
    ]
    vi.mocked(getRecentOpportunities).mockResolvedValue(rows)
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toBe('📜 Última 1 oportunidade\n[15/04 15:00] ↓ Black Lotus — R$ 4250 (TCGPlayer) — ↓18%')
  })

  it('replies with plural header and multiple rows in order for 3 opportunities', async () => {
    const rows: OpportunityHistoryRow[] = [
      {
        detectedAt: new Date('2026-04-03T18:00:00Z'), // 15:00 SP
        cardName: 'Black Lotus',
        source: 'tcgplayer',
        currentPrice: 4250,
        dropPercent: 18,
      },
      {
        detectedAt: new Date('2026-04-02T00:00:00Z'), // 21:00 SP (prev day)
        cardName: 'Tarmogoyf',
        source: 'cardmarket',
        currentPrice: 320,
        dropPercent: 15,
      },
      {
        detectedAt: new Date('2026-04-01T12:00:00Z'), // 09:00 SP
        cardName: 'Thoughtseize',
        source: 'ligamagic',
        currentPrice: 180,
        dropPercent: 20,
      },
    ]
    vi.mocked(getRecentOpportunities).mockResolvedValue(rows)
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toContain('📜 Últimas 3 oportunidades')
    expect(text).toContain('Black Lotus')
    expect(text).toContain('Tarmogoyf')
    expect(text).toContain('Thoughtseize')
    // First row appears before second
    expect(text.indexOf('Black Lotus')).toBeLessThan(text.indexOf('Tarmogoyf'))
    expect(text.indexOf('Tarmogoyf')).toBeLessThan(text.indexOf('Thoughtseize'))
  })

  it('maps source display names correctly for all 4 sources', async () => {
    const sources = [
      { source: 'ligamagic' as const, expected: 'Liga Magic' },
      { source: 'tcgplayer' as const, expected: 'TCGPlayer' },
      { source: 'cardmarket' as const, expected: 'CardMarket' },
      { source: 'cardkingdom' as const, expected: 'CardKingdom' },
    ]

    for (const { source, expected } of sources) {
      const rows: OpportunityHistoryRow[] = [
        {
          detectedAt: new Date('2026-04-15T18:00:00Z'),
          cardName: 'Test Card',
          source,
          currentPrice: 100,
          dropPercent: 15,
        },
      ]
      vi.mocked(getRecentOpportunities).mockResolvedValue(rows)
      const ctx = createMockCtx()
      await invokeHistory(ctx)
      const text: string = ctx.reply.mock.calls[0][0]
      expect(text).toContain(expected)
      vi.clearAllMocks()
    }
  })

  it('uses em-dash U+2014 in every data row', async () => {
    const rows: OpportunityHistoryRow[] = [
      {
        detectedAt: new Date('2026-04-15T18:00:00Z'),
        cardName: 'Black Lotus',
        source: 'tcgplayer',
        currentPrice: 4250,
        dropPercent: 18,
      },
      {
        detectedAt: new Date('2026-04-14T18:00:00Z'),
        cardName: 'Tarmogoyf',
        source: 'cardmarket',
        currentPrice: 320,
        dropPercent: 15,
      },
    ]
    vi.mocked(getRecentOpportunities).mockResolvedValue(rows)
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toMatch(/—/)
    // Every data row (non-header) contains em-dash
    const lines = text.split('\n').slice(1) // skip header line
    for (const line of lines) {
      expect(line).toMatch(/—/)
    }
  })

  it('rounds currentPrice and dropPercent with Math.round', async () => {
    const rows: OpportunityHistoryRow[] = [
      {
        detectedAt: new Date('2026-04-15T18:00:00Z'),
        cardName: 'Test Card',
        source: 'tcgplayer',
        currentPrice: 4250.67,
        dropPercent: 17.51,
      },
    ]
    vi.mocked(getRecentOpportunities).mockResolvedValue(rows)
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    // currentPrice: 4250.67 → 4251
    expect(text).toContain('R$ 4251')
    // dropPercent: 17.51 → 18
    expect(text).toContain('↓18%')
  })

  it('replies with generic error message and does not expose error details', async () => {
    vi.mocked(getRecentOpportunities).mockRejectedValue(new Error('DB down'))
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toBe('Erro ao buscar histórico. Tente novamente.')
    expect(text).not.toContain('DB down')
  })

  it('calls getRecentOpportunities with limit 10', async () => {
    vi.mocked(getRecentOpportunities).mockResolvedValue([])
    const ctx = createMockCtx()
    await invokeHistory(ctx)
    expect(getRecentOpportunities).toHaveBeenCalledWith(10)
  })
})
