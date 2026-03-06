/**
 * Currency conversion utilities with IOF tax
 *
 * Provides functions to:
 * - Apply IOF (Imposto sobre Operações Financeiras) tax
 * - Fetch exchange rates from Brazilian Central Bank API
 * - Convert USD/EUR prices to BRL with correct IOF calculation
 *
 * IOF rate: 6.38% for credit card purchases per REQUIREMENTS.md PRICE-05
 */

import axios from 'axios'
import { logger } from './logger'

/**
 * IOF (Imposto sobre Operações Financeiras) rate for credit card purchases
 * Per REQUIREMENTS.md PRICE-05: 6.38%
 */
export const IOF_RATE = 0.0638 // 6.38%

/**
 * Exchange rate cache entry
 */
interface ExchangeRateCache {
  rate: number
  timestamp: Date
}

// Cache exchange rates for 2 hours (Claude's discretion)
const exchangeRateCache = new Map<string, ExchangeRateCache>()
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

/**
 * Apply IOF tax to an amount
 *
 * Formula: amount * (1 + IOF_RATE)
 * Rounds to 2 decimal places for currency precision.
 *
 * @param amount - Base amount to apply IOF to
 * @returns Amount with IOF applied, rounded to 2 decimals
 *
 * @example
 * ```ts
 * applyIOF(100)  // Returns: 106.38 (100 + 6.38%)
 * applyIOF(45.90)  // Returns: 48.83 (45.90 + 6.38%)
 * ```
 */
export function applyIOF(amount: number): number {
  const withIOF = amount * (1 + IOF_RATE)
  return Math.round(withIOF * 100) / 100
}

/**
 * Fetch exchange rate from Brazilian Central Bank API
 *
 * Fetches BRL per USD or BRL per EUR rate.
 * Caches exchange rates for 2 hours to reduce API calls.
 * Falls back to last cached rate if API fails.
 *
 * @param fromCurrency - Source currency ('USD' | 'EUR')
 * @returns Exchange rate (BRL per unit of fromCurrency)
 * @throws Error if no cache and API fails
 *
 * @example
 * ```ts
 * const usdRate = await getExchangeRate('USD')  // e.g., 5.00
 * const eurRate = await getExchangeRate('EUR')  // e.g., 5.40
 * ```
 */
export async function getExchangeRate(fromCurrency: 'USD' | 'EUR'): Promise<number> {
  const cacheKey = `BRL_${fromCurrency}`

  // Check cache first
  const cached = exchangeRateCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL) {
    logger.debug(`Using cached exchange rate for ${fromCurrency}`)
    return cached.rate
  }

  try {
    // Brazilian Central Bank API endpoint
    // Using the simplified endpoint for exchange rates
    const apiUrls = {
      USD: 'https://www.bcb.gov.br/api/servico/sitebcb/MyAltTaxasV1?chemeltaxa=1&formato=json',
      EUR: 'https://www.bcb.gov.br/api/servico/sitebcb/MyAltTaxasV1?chemeltaxa=2&formato=json',
    }

    const url = apiUrls[fromCurrency]

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
    })

    // Parse response
    // API returns: { "value": [{ "taxaCompra": "5.1234", "taxaVenda": "5.2345" }] }
    const data = response.data

    if (!data || !data.value || data.value.length === 0) {
      throw new Error(`Invalid response from Brazilian Central Bank API for ${fromCurrency}`)
    }

    // Use venda (sell) rate for converting foreign currency to BRL
    const rateStr = data.value[0].taxaVenda
    const rate = Number.parseFloat(rateStr.replace(',', '.'))

    if (Number.isNaN(rate)) {
      throw new Error(`Could not parse exchange rate from response: ${rateStr}`)
    }

    // Update cache
    exchangeRateCache.set(cacheKey, {
      rate,
      timestamp: new Date(),
    })

    logger.info(`Fetched exchange rate for ${fromCurrency}: ${rate}`)

    return rate
  } catch (error) {
    // If API fails but we have cached data, return it with warning
    if (cached) {
      logger.warn(
        `Brazilian Central Bank API failed for ${fromCurrency}, using stale cached rate from ${cached.timestamp.toISOString()}`,
      )
      return cached.rate
    }

    // No cache and API failed - throw error
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch exchange rate for ${fromCurrency}: ${error.message} (status: ${error.response?.status})`,
      )
    }
    throw new Error(`Failed to fetch exchange rate for ${fromCurrency}: ${error}`)
  }
}

/**
 * Clear stale cache entries
 *
 * Removes cache entries older than TTL to prevent memory leaks.
 * Called automatically on each getExchangeRate call.
 */
function clearStaleCacheEntries(): void {
  const now = Date.now()
  for (const [key, value] of exchangeRateCache.entries()) {
    if (now - value.timestamp.getTime() > CACHE_TTL) {
      exchangeRateCache.delete(key)
    }
  }
}

// Clear stale cache every 10 minutes
setInterval(clearStaleCacheEntries, 10 * 60 * 1000)
