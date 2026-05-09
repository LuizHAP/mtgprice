import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { withRetry } from '../retry'

describe('withRetry', () => {
  // Save and restore env vars around each test
  let originalAttempts: string | undefined
  let originalBaseDelay: string | undefined

  beforeEach(() => {
    originalAttempts = process.env.SCRAPER_RETRY_ATTEMPTS
    originalBaseDelay = process.env.SCRAPER_RETRY_BASE_DELAY_MS
  })

  afterEach(() => {
    if (originalAttempts === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to string "undefined" in process.env
      delete process.env.SCRAPER_RETRY_ATTEMPTS
    } else {
      process.env.SCRAPER_RETRY_ATTEMPTS = originalAttempts
    }
    if (originalBaseDelay === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to string "undefined" in process.env
      delete process.env.SCRAPER_RETRY_BASE_DELAY_MS
    } else {
      process.env.SCRAPER_RETRY_BASE_DELAY_MS = originalBaseDelay
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('returns resolved value on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValueOnce('ok')
    const result = await withRetry(fn, 3, 1)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('retries on failure and returns success on second attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok')
    const result = await withRetry(fn, 3, 1)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('throws the last error after exhausting maxAttempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('persistent'))
      .mockRejectedValueOnce(new Error('persistent'))
      .mockRejectedValueOnce(new Error('persistent'))
    await expect(withRetry(fn, 3, 1)).rejects.toThrow('persistent')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('uses exponential backoff delays (1x, 2x, 4x baseDelayMs)', async () => {
    // Spy on setTimeout to capture delay values, let it still execute (real timers)
    // so there are no fake-timer/async unhandled-rejection conflicts.
    const delays: number[] = []
    const origSetTimeout = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (typeof delay === 'number') delays.push(delay)
        return origSetTimeout(handler as () => void, 0, ...args)
      },
    )

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))

    await expect(withRetry(fn, 3, 1000)).rejects.toThrow('x')

    // Verify exponential backoff: 1000ms, 2000ms
    expect(delays).toEqual([1000, 2000])
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('defaults maxAttempts from SCRAPER_RETRY_ATTEMPTS env var', async () => {
    process.env.SCRAPER_RETRY_ATTEMPTS = '5'
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
    await expect(withRetry(fn, undefined, 1)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(5)
  })

  test('defaults maxAttempts to 3 when SCRAPER_RETRY_ATTEMPTS is unset', async () => {
    // biome-ignore lint/performance/noDelete: assigning undefined coerces to string "undefined" in process.env
    delete process.env.SCRAPER_RETRY_ATTEMPTS
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
    await expect(withRetry(fn, undefined, 1)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('defaults baseDelayMs from SCRAPER_RETRY_BASE_DELAY_MS env var', async () => {
    process.env.SCRAPER_RETRY_BASE_DELAY_MS = '1'
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x'))
    await expect(withRetry(fn, 2, undefined)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('wraps non-Error throws into Error', async () => {
    const fn = vi.fn().mockRejectedValueOnce('string-not-error')
    const err = await withRetry(fn, 1, 1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('string-not-error')
  })
})
