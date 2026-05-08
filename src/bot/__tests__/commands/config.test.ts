/**
 * Tests for /config bot command handler.
 *
 * Mocking strategy:
 * - @/lib/telegram: stubbed bot that captures command handlers via bot.command(name, fn)
 * - @/lib/opportunities/config: mocked loadDetectionConfig
 * - @/lib/logger: silenced
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Hoisted stubs (must be hoisted so vi.mock factory can reference them) ────

const commandHandlers = vi.hoisted(() => ({}) as Record<string, (ctx: unknown) => Promise<void>>)

const botStub = vi.hoisted(() => ({
  command: vi.fn((name: string, handler: (ctx: unknown) => Promise<void>) => {
    commandHandlers[name] = handler
  }),
}))

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/telegram', () => ({ bot: botStub }))

vi.mock('@/lib/opportunities/config', () => ({
  loadDetectionConfig: vi.fn(),
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

import { loadDetectionConfig } from '@/lib/opportunities/config'
import type { DetectionConfig } from '@/lib/opportunities/config'

// Importing the module registers the handler as a side effect
import '@/bot/commands/config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockCtx(match?: string) {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    match: match ?? '',
  }
}

/** Invoke the captured /config handler */
async function invokeConfig(ctx: ReturnType<typeof createMockCtx>) {
  const handler = commandHandlers.config
  if (!handler) throw new Error('/config handler was not registered')
  await handler(ctx)
}

const defaultConfig: DetectionConfig = {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('replies with exact D-20 output for default config values', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue(defaultConfig)
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toBe(
      '⚙️ Configuração atual\n' +
        'Drop threshold: 15%\n' +
        'Lookback: 7 dias\n' +
        'Baseline: média de 30 dias\n' +
        'Cooldown: 7 dias por carta/fonte\n' +
        'Mínimo de histórico: 30 dias\n' +
        'Runs diários: 09:00, 15:00, 21:00',
    )
  })

  it('shows correct threshold for custom dropThreshold 0.20', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue({ ...defaultConfig, dropThreshold: 0.2 })
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toContain('Drop threshold: 20%')
  })

  it('rounds threshold with Math.round for 0.154', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue({ ...defaultConfig, dropThreshold: 0.154 })
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toContain('Drop threshold: 15%')
  })

  it('shows correct lookback for custom lookbackDays 14', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue({ ...defaultConfig, lookbackDays: 14 })
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toContain('Lookback: 14 dias')
  })

  it('shows correct run times for custom runTimesHuman', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue({ ...defaultConfig, runTimesHuman: '08:00, 14:00, 20:00' })
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toContain('Runs diários: 08:00, 14:00, 20:00')
  })

  it('ignores ctx.match args and still replies with config output (read-only)', async () => {
    vi.mocked(loadDetectionConfig).mockReturnValue(defaultConfig)
    const ctx = createMockCtx('drop_threshold 0.25')
    await invokeConfig(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    // Still shows normal output — args silently ignored
    expect(text).toContain('Drop threshold: 15%')
    // loadDetectionConfig called once — no mutation attempted
    expect(loadDetectionConfig).toHaveBeenCalledTimes(1)
  })

  it('replies with generic error message and does not expose error details', async () => {
    vi.mocked(loadDetectionConfig).mockImplementation(() => {
      throw new Error('boom')
    })
    const ctx = createMockCtx()
    await invokeConfig(ctx)
    expect(ctx.reply).toHaveBeenCalledTimes(1)
    const text: string = ctx.reply.mock.calls[0][0]
    expect(text).toBe('Erro ao carregar configuração.')
    expect(text).not.toContain('boom')
  })
})
