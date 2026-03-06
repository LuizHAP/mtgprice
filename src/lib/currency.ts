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
