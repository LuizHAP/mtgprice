/**
 * Exponential-backoff retry helper for flaky external calls.
 *
 * Per Phase 6 D-05/D-06: this wrapper retries a failing fetch up to
 * `maxAttempts` times with exponential backoff BEFORE the circuit breaker
 * sees the failure. The circuit breaker only counts the final exhausted
 * failure, not each transient retry.
 *
 * Backoff sequence (with default baseDelayMs=1000):
 *   attempt 1 fails → wait 1000ms
 *   attempt 2 fails → wait 2000ms
 *   attempt 3 fails → throw last error
 *
 * @param fn          Async function to invoke
 * @param maxAttempts Maximum total attempts (default: env SCRAPER_RETRY_ATTEMPTS or 3)
 * @param baseDelayMs Base delay in ms (default: env SCRAPER_RETRY_BASE_DELAY_MS or 1000)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts?: number,
  baseDelayMs?: number,
): Promise<T> {
  const envAttempts = Number(process.env.SCRAPER_RETRY_ATTEMPTS) || 3
  const envBaseDelay = Number(process.env.SCRAPER_RETRY_BASE_DELAY_MS) || 1000
  const attempts = maxAttempts ?? envAttempts
  const baseDelay = baseDelayMs ?? envBaseDelay

  let lastError: Error = new Error('withRetry: no attempts executed')

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < attempts) {
        const delay = baseDelay * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
