import { logger } from '@/lib/logger'
import CircuitBreaker from 'opossum'

/**
 * Circuit breaker configuration options
 * Based on CONTEXT.md decision: 50% error threshold, 60s reset timeout
 */
export interface CircuitBreakerConfig {
  /** Timeout for each call in milliseconds */
  timeout: number
  /** Error threshold percentage to open circuit (0-100) */
  errorThresholdPercentage: number
  /** Time in ms before attempting to close circuit */
  resetTimeout: number
  /** Rolling timeout window for statistical calculations */
  rollingCountTimeout: number
  /** Number of buckets in rolling window */
  rollingCountBuckets: number
}

/**
 * Default circuit breaker configuration
 * Per CONTEXT.md: 50% error threshold, 60s reset timeout, 10s call timeout
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50, // Open circuit when 50% fail
  resetTimeout: 60000, // Try again after 60 seconds
  rollingCountTimeout: 10000, // 10-second sliding window
  rollingCountBuckets: 10, // 1-second buckets
}

/**
 * Wraps an async function with Opossum circuit breaker
 *
 * Circuit breaker states:
 * - CLOSED: Requests pass through normally
 * - OPEN: Requests fail fast with fallback (circuit opened after 50% failures)
 * - HALF_OPEN: Test request allowed to check if service recovered
 *
 * @param fn - Async function to wrap
 * @param sourceName - Name of the data source (for logging)
 * @param config - Optional circuit breaker configuration
 * @returns Wrapped function with same signature as input, returning Promise<R | null>
 *
 * @example
 * ```typescript
 * const breakerFetch = wrapWithCircuitBreaker(fetchTCGPlayerPrice, 'TCGPlayer');
 * const price = await breakerFetch('card-id'); // Returns number | null
 * ```
 */
export function wrapWithCircuitBreaker<T, R>(
  fn: (arg: T) => Promise<R>,
  sourceName: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
): (arg: T) => Promise<R | null> {
  const breaker = new CircuitBreaker(fn, config)

  // Fallback function: returns null and logs warning when circuit is open
  breaker.fallback((arg: T) => {
    logger.warn(`Circuit breaker OPEN for ${sourceName}, skipping request`, {
      source: sourceName,
      input: typeof arg === 'string' ? arg : JSON.stringify(arg).slice(0, 100),
    })
    return null
  })

  // Log circuit state changes for monitoring
  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened for ${sourceName}`, {
      source: sourceName,
      state: 'OPEN',
    })
  })

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open for ${sourceName}, testing recovery`, {
      source: sourceName,
      state: 'HALF_OPEN',
    })
  })

  breaker.on('close', () => {
    logger.info(`Circuit breaker closed for ${sourceName}, service recovered`, {
      source: sourceName,
      state: 'CLOSED',
    })
  })

  // Log fallback executions (circuit is open)
  breaker.on('fallback', (result: unknown) => {
    logger.debug(`Fallback executed for ${sourceName}`, {
      source: sourceName,
      result,
    })
  })

  // Return wrapped function with same signature
  // Use .fire() to execute the circuit breaker
  return (arg: T) => breaker.fire(arg)
}

/**
 * Export types for use in other modules
 */
export type { CircuitBreaker as OpossumCircuitBreaker } from 'opossum'
