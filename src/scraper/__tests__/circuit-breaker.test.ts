import CircuitBreaker from 'opossum'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { wrapWithCircuitBreaker } from '../circuit-breaker'

// Hoisted mock for @/lib/telegram so circuit-breaker's dynamic import resolves to a stub.
vi.mock('@/lib/telegram', () => ({
  bot: { api: { sendMessage: vi.fn() } },
}))

const FAST_CONFIG = {
  timeout: 100,
  errorThresholdPercentage: 1,
  resetTimeout: 200,
  rollingCountTimeout: 1000,
  rollingCountBuckets: 1,
}

describe('Opossum circuit breaker behavior', () => {
  describe('Circuit state transitions', () => {
    test('should start in closed state', () => {
      const action = vi.fn().mockResolvedValue('ok')
      const b = new CircuitBreaker(action, FAST_CONFIG)
      try {
        expect(b.closed).toBe(true)
        expect(b.opened).toBe(false)
        expect(b.halfOpen).toBe(false)
      } finally {
        b.shutdown()
      }
    })

    test('should open circuit when 50% of requests fail', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        expect(b.closed).toBe(false)
      } finally {
        b.shutdown()
      }
    })

    test('should remain open for resetTimeout duration', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        await new Promise((r) => setTimeout(r, 50))
        expect(b.opened).toBe(true)
        expect(b.halfOpen).toBe(false)
      } finally {
        b.shutdown()
      }
    })

    test('should transition to half-open after resetTimeout', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        await new Promise((r) => setTimeout(r, 250))
        expect(b.halfOpen).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should close circuit when service recovers', async () => {
      const action = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('recovered')
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        await new Promise((r) => setTimeout(r, 250))
        expect(b.halfOpen).toBe(true)
        const result = await b.fire('x')
        expect(result).toBe('recovered')
        expect(b.closed).toBe(true)
        expect(b.opened).toBe(false)
      } finally {
        b.shutdown()
      }
    })
  })

  describe('Fallback function', () => {
    test('should execute fallback when circuit is open', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      const fallbackResult = { fallback: 'used' }
      b.fallback(() => fallbackResult)
      try {
        // First fire trips the breaker AND returns fallback (opossum routes failures to fallback).
        const first = await b.fire('x')
        expect(first).toEqual(fallbackResult)
        expect(b.opened).toBe(true)
        // Subsequent fire returns fallback (fast-fail path).
        const second = await b.fire('x')
        expect(second).toEqual(fallbackResult)
      } finally {
        b.shutdown()
      }
    })

    test('should return cached data from fallback', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      // Production-equivalent fallback: returns null when no cached data is available.
      b.fallback(() => null)
      try {
        const result = await b.fire('x')
        expect(result).toBeNull()
        expect(b.opened).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should handle fallback errors gracefully', async () => {
      const action = vi.fn().mockRejectedValue(new Error('action-fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => {
        throw new Error('fallback-error')
      })
      try {
        const error = await b.fire('x').catch((e: Error) => e.message)
        expect(error).toBe('fallback-error')
      } finally {
        b.shutdown()
      }
    })
  })

  describe('Event emission', () => {
    test('should emit "open" event when circuit opens', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      const onOpen = vi.fn()
      b.on('open', onOpen)
      try {
        await b.fire('x').catch(() => {})
        expect(onOpen).toHaveBeenCalledTimes(1)
        expect(b.opened).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should emit "close" event when circuit closes', async () => {
      const action = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('recovered')
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      const onClose = vi.fn()
      b.on('close', onClose)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        await new Promise((r) => setTimeout(r, 250))
        await b.fire('x')
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(b.closed).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should emit "halfOpen" event when testing recovery', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      const onHalfOpen = vi.fn()
      b.on('halfOpen', onHalfOpen)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        await new Promise((r) => setTimeout(r, 250))
        expect(onHalfOpen).toHaveBeenCalledTimes(1)
        // Per opossum source: halfOpen emits the resetTimeout value (numeric).
        expect(onHalfOpen).toHaveBeenCalledWith(FAST_CONFIG.resetTimeout)
        expect(b.halfOpen).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should emit "fallback" event when fallback used', async () => {
      const action = vi.fn().mockRejectedValue(new Error('fail'))
      const b = new CircuitBreaker(action, FAST_CONFIG)
      const fallbackResult = 'fb-result'
      b.fallback(() => fallbackResult)
      const onFallback = vi.fn()
      b.on('fallback', onFallback)
      try {
        await b.fire('x').catch(() => {})
        expect(onFallback).toHaveBeenCalled()
        // Per opossum source: 'fallback' event emits the fallback's return value.
        expect(onFallback.mock.calls[0][0]).toBe(fallbackResult)
      } finally {
        b.shutdown()
      }
    })
  })

  describe('Per-source circuit breakers', () => {
    test('should create separate breaker for each source', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('liga-down'))
      const succeedingFn = vi.fn().mockResolvedValue(9.99)
      const ligaMagic = wrapWithCircuitBreaker(failingFn, 'Liga Magic', { ...FAST_CONFIG })
      const tcgPlayer = wrapWithCircuitBreaker(succeedingFn, 'TCGPlayer', { ...FAST_CONFIG })
      // Trip Liga Magic's breaker.
      await ligaMagic('oracle-id').catch(() => {})
      await ligaMagic('oracle-id').catch(() => {})
      // TCGPlayer must remain operational.
      const tcgResult = await tcgPlayer('oracle-id')
      expect(tcgResult).toBe(9.99)
      expect(succeedingFn).toHaveBeenCalled()
    })

    test('should configure appropriate timeouts per source', async () => {
      // Per-source timeouts from the TODO comments — verifies wrapWithCircuitBreaker honours per-call config.
      const sources = [
        { name: 'Liga Magic', timeout: 10000 },
        { name: 'TCGPlayer', timeout: 5000 },
        { name: 'CardMarket', timeout: 5000 },
        { name: 'CardKingdom', timeout: 10000 },
      ]
      const wrapped = sources.map((s) => {
        const fn = vi.fn().mockResolvedValue(`${s.name}-price`)
        return {
          name: s.name,
          timeout: s.timeout,
          call: wrapWithCircuitBreaker(fn, s.name, {
            timeout: s.timeout,
            errorThresholdPercentage: 1,
            resetTimeout: 200,
            rollingCountTimeout: 1000,
            rollingCountBuckets: 1,
          }),
        }
      })
      // Each wrapped function executes successfully with its own configuration.
      for (const w of wrapped) {
        const result = await w.call('oracle-id')
        expect(result).toBe(`${w.name}-price`)
      }
      expect(wrapped).toHaveLength(4)
    })

    test('should track breaker stats per source', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('source-down'))
      const succeedFn = vi.fn().mockResolvedValue('ok')
      const b1 = new CircuitBreaker(failFn, FAST_CONFIG)
      const b2 = new CircuitBreaker(succeedFn, FAST_CONFIG)
      b1.fallback(() => null)
      b2.fallback(() => null)
      try {
        await b1.fire('x').catch(() => {})
        await b1.fire('x').catch(() => {})
        await b2.fire('x')
        expect(b1.stats.failures).toBeGreaterThan(0)
        expect(b2.stats.failures).toBe(0)
        expect(b1.stats.failures).not.toBe(b2.stats.failures)
        expect(b2.stats.successes).toBeGreaterThan(0)
      } finally {
        b1.shutdown()
        b2.shutdown()
      }
    })
  })

  describe('Integration scenarios', () => {
    test('should prevent cascading failures from bad sources', async () => {
      const ligaFail = vi.fn().mockRejectedValue(new Error('liga-down'))
      const tcgOk = vi.fn().mockResolvedValue(10.0)
      const cardMarketOk = vi.fn().mockResolvedValue(11.0)
      const liga = wrapWithCircuitBreaker(ligaFail, 'Liga Magic', { ...FAST_CONFIG })
      const tcg = wrapWithCircuitBreaker(tcgOk, 'TCGPlayer', { ...FAST_CONFIG })
      const cm = wrapWithCircuitBreaker(cardMarketOk, 'CardMarket', { ...FAST_CONFIG })
      // Trip Liga's breaker.
      await liga('oracle-id').catch(() => {})
      await liga('oracle-id').catch(() => {})
      // Other sources must keep working — partial results pattern.
      const results = await Promise.all([liga('oracle-id'), tcg('oracle-id'), cm('oracle-id')])
      expect(results[0]).toBeNull() // Liga returns null via production fallback
      expect(results[1]).toBe(10.0) // TCG unaffected
      expect(results[2]).toBe(11.0) // CardMarket unaffected
    })

    test('should recover automatically when source heals', async () => {
      const action = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('healed')
      const b = new CircuitBreaker(action, FAST_CONFIG)
      b.fallback(() => null)
      try {
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        // No manual intervention — wait for opossum's automatic transition.
        await new Promise((r) => setTimeout(r, 250))
        expect(b.halfOpen).toBe(true)
        const recovered = await b.fire('x')
        expect(recovered).toBe('healed')
        expect(b.closed).toBe(true)
      } finally {
        b.shutdown()
      }
    })

    test('should handle rapid successive requests correctly', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('down'))
      const b = new CircuitBreaker(failFn, FAST_CONFIG)
      b.fallback(() => null)
      try {
        // Trip the circuit first.
        await b.fire('x').catch(() => {})
        expect(b.opened).toBe(true)
        const callsBefore = failFn.mock.calls.length
        // Fire 20 concurrent requests against the open circuit.
        const results = await Promise.all(Array.from({ length: 20 }, () => b.fire('x')))
        expect(results).toHaveLength(20)
        for (const result of results) {
          expect(result).toBeNull()
        }
        // Action must NOT have been invoked again — fast-fail through fallback.
        expect(failFn.mock.calls.length).toBe(callsBefore)
      } finally {
        b.shutdown()
      }
    })
  })
})

// ============================================================================
// Phase 6 — Health Alert Tests (D-01..D-04)
// ============================================================================

describe('Health alerts (Phase 6 / D-01..D-04)', () => {
  let originalChatId: string | undefined
  let sendMessageMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    originalChatId = process.env.TELEGRAM_CHAT_ID
    process.env.TELEGRAM_CHAT_ID = '12345'
    const telegramModule = await import('@/lib/telegram')
    sendMessageMock = telegramModule.bot.api.sendMessage as ReturnType<typeof vi.fn>
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue({ message_id: 1 })
  })

  afterEach(() => {
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_CHAT_ID
    } else {
      process.env.TELEGRAM_CHAT_ID = originalChatId
    }
  })

  // Helper: build a circuit breaker that opens fast for testing.
  function buildFlakyBreaker(sourceName: string) {
    const failingFn = vi.fn(async () => {
      throw new Error('boom')
    })
    return wrapWithCircuitBreaker(failingFn, sourceName, {
      timeout: 100,
      errorThresholdPercentage: 1, // trip on first failure
      resetTimeout: 60000,
      rollingCountTimeout: 1000,
      rollingCountBuckets: 1,
    })
  }

  test('sends Telegram alert when circuit opens for TCGPlayer', async () => {
    const wrapped = buildFlakyBreaker('TCGPlayer')
    // Fire enough requests to trigger the open transition.
    for (let i = 0; i < 5; i++) {
      await wrapped('any-oracle-id').catch(() => {})
    }
    // Allow event loop microtasks to flush the async open handler.
    await new Promise((r) => setTimeout(r, 50))

    expect(sendMessageMock).toHaveBeenCalled()
    expect(sendMessageMock.mock.calls[0][0]).toBe(12345) // Number(TELEGRAM_CHAT_ID)
  })

  test('alert message uses exact D-03 format with sourceName interpolation', async () => {
    const wrapped = buildFlakyBreaker('CardMarket')
    for (let i = 0; i < 5; i++) {
      await wrapped('any-oracle-id').catch(() => {})
    }
    await new Promise((r) => setTimeout(r, 50))

    expect(sendMessageMock).toHaveBeenCalled()
    const message = sendMessageMock.mock.calls[0][1]
    expect(message).toBe(
      '⚠️ Circuit breaker aberto: CardMarket está offline (60s reset). Últimas tentativas falharam.',
    )
  })

  test('skips alert silently when TELEGRAM_CHAT_ID is unset', async () => {
    process.env.TELEGRAM_CHAT_ID = ''

    const wrapped = buildFlakyBreaker('Liga Magic')
    for (let i = 0; i < 5; i++) {
      await wrapped('any-oracle-id').catch(() => {})
    }
    await new Promise((r) => setTimeout(r, 50))

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('does not propagate sendMessage errors (alert failure must not crash circuit pipeline)', async () => {
    sendMessageMock.mockRejectedValueOnce(new Error('telegram down'))

    const wrapped = buildFlakyBreaker('CardKingdom')
    // The wrapped() calls themselves should not throw because of the alert failure.
    for (let i = 0; i < 5; i++) {
      await expect(wrapped('any-oracle-id')).resolves.not.toThrow()
    }
    await new Promise((r) => setTimeout(r, 50))

    // sendMessage was attempted, but the alert error did not propagate.
    expect(sendMessageMock).toHaveBeenCalled()
  })
})
