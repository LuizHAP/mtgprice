/**
 * CardKingdom price fetching with API-first and scraping fallback
 *
 * Provides functions to:
 * - Fetch prices via CardKingdom API (if available)
 * - Scrape prices from cardkingdom.com as primary/fallback method
 * - Fetch card prices using hybrid approach with circuit breaker
 *
 * CardKingdom likely scraping-only per RESEARCH.md open questions
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../../lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '../../lib/ratelimit/rate-limiter'
import { wrapWithCircuitBreaker } from '../circuit-breaker'

/**
 * Fetch card price via CardKingdom API
 *
 * Attempts CardKingdom API (if exists).
 * If no API key configured or API unavailable, returns null immediately.
 *
 * Note: CardKingdom API availability unknown per RESEARCH.md.
 * This function may remain a stub if no public API exists.
 *
 * @param cardName - Name of the card to search for
 * @param setCode - Optional set code for more specific search
 * @returns Promise<number | null> - Price in USD or null
 *
 * @example
 * ```ts
 * const price = await fetchViaAPI('Lightning Bolt', '2XN')
 * ```
 */
async function fetchViaAPI(cardName: string, setCode?: string): Promise<number | null> {
  const apiKey = process.env.CARDKINGDOM_API_KEY

  if (!apiKey) {
    logger.debug('CardKingdom API key not configured, skipping API')
    return null
  }

  try {
    // Check rate limit
    const { allowed } = await checkRateLimitPreset('cardkingdom:api', RATE_LIMITS.CARDKINGDOM)

    if (!allowed) {
      throw new Error('CardKingdom API rate limit exceeded')
    }

    // CardKingdom API endpoint
    // Note: Endpoint structure TBD - inspect cardkingdom.com during implementation
    // Likely pattern: https://www.cardkingdom.com/api/{version}/search
    // This is a placeholder implementation
    const searchUrl = new URL('https://www.cardkingdom.com/api/search')
    searchUrl.searchParams.append('name', cardName)
    if (setCode) {
      searchUrl.searchParams.append('set', setCode)
    }

    const response = await axios.get(searchUrl.toString(), {
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
      },
      timeout: 10000,
    })

    // Parse response for price
    // Note: Response structure needs verification with API documentation
    const data = response.data

    if (!data || !data.results || data.results.length === 0) {
      logger.warn(`No results found for card: ${cardName}`)
      return null
    }

    // Extract price from first result
    // Common fields: 'price', 'lowPrice', 'marketPrice'
    const firstResult = data.results[0]
    const price = firstResult.price ?? firstResult.lowPrice ?? firstResult.marketPrice ?? null

    if (price === null) {
      logger.warn(`No price field found for card: ${cardName}`)
      return null
    }

    return Number.parseFloat(price)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        logger.error('CardKingdom API authentication failed (invalid API key)')
        return null
      }
      if (error.response?.status === 404) {
        // API endpoint might not exist - CardKingdom likely scraping-only
        logger.debug('CardKingdom API endpoint not found (404), likely scraping-only')
        return null
      }
      logger.debug(`CardKingdom API unavailable: ${error.message}`)
    } else {
      logger.debug(`Error fetching from CardKingdom API: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price via scraping from cardkingdom.com
 *
 * Scrapes cardkingdom.com as primary method (API likely doesn't exist).
 * Builds search URL and extracts price from HTML using cheerio.
 *
 * @param cardName - Name of the card to search for
 * @param setCode - Optional set code for more specific search
 * @returns Promise<number | null> - Price in USD or null
 *
 * @example
 * ```ts
 * const price = await fetchViaScraping('Lightning Bolt', '2XN')
 * ```
 */
async function fetchViaScraping(cardName: string, setCode?: string): Promise<number | null> {
  try {
    // Check rate limit
    const { allowed } = await checkRateLimitPreset('cardkingdom:scrape', RATE_LIMITS.CARDKINGDOM)

    if (!allowed) {
      throw new Error('CardKingdom scraping rate limit exceeded')
    }

    // Build CardKingdom search URL
    const searchUrl = new URL('https://www.cardkingdom.com/catalog')
    searchUrl.searchParams.append('filter[name]', cardName)
    if (setCode) {
      searchUrl.searchParams.append('filter[set]', setCode)
    }

    // Fetch page HTML
    const response = await axios.get(searchUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    })

    const html = response.data
    const $ = cheerio.load(html)

    // Extract price from selector
    // Note: Exact selector needs to be determined by inspecting actual HTML
    const priceSelectors = [
      '.price',
      '[data-price]',
      '.product-price',
      '.sale-price',
      '.listing-price',
      '.item-price',
    ]

    let priceText: string | undefined

    for (const selector of priceSelectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        priceText = element.text().trim()
        break
      }
    }

    if (!priceText) {
      logger.warn(`Price not found for card ${cardName} using cheerio selectors`)
      return null
    }

    // Parse USD string (e.g., "$5.99") to number (5.99)
    const priceMatch = priceText.match(/[\d.,]+/)
    if (!priceMatch) {
      logger.error(`Could not parse price from text: "${priceText}"`)
      return null
    }

    const priceStr = priceMatch[0].replace(/,/g, '')
    const price = Number.parseFloat(priceStr)

    if (Number.isNaN(price)) {
      logger.error(`Parsed price is NaN: "${priceStr}" from "${priceText}"`)
      return null
    }

    return price
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        logger.warn('Card not found on CardKingdom (404)')
        return null
      }
      logger.error(`CardKingdom scraping error: ${error.message}`)
    } else {
      logger.error(`Error scraping CardKingdom: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price from CardKingdom (hybrid approach)
 *
 * Tries API first, falls back to scraping if API returns null.
 * Uses database query to get card name and set from oracle_id.
 *
 * Note: CardKingdom likely scraping-only per RESEARCH.md.
 *
 * @param oracleId - Oracle ID of the card to fetch price for
 * @returns Promise<number | null> - Price in USD or null
 *
 * @example
 * ```ts
 * const price = await fetchCardPrice('12345678-abcd-1234-abcd-1234567890ab')
 * ```
 */
async function fetchCardPrice(oracleId: string): Promise<number | null> {
  try {
    // Query cards table for card name and set
    const { db } = await import('../../db')
    const card = await db.query.cards.findFirst({
      where: (cards, { eq }) => eq(cards.oracleId, oracleId),
    })

    if (!card) {
      logger.error(`Card with oracle_id ${oracleId} not found in database`)
      return null
    }

    // Try API first (will likely return null if no API exists)
    const apiPrice = await fetchViaAPI(card.name, card.set ?? undefined)
    if (apiPrice !== null) {
      return apiPrice
    }

    // Fall back to scraping
    logger.debug(`CardKingdom API unavailable, falling back to scraping for ${card.name}`)
    const scrapePrice = await fetchViaScraping(card.name, card.set ?? undefined)

    return scrapePrice
  } catch (error) {
    logger.error(`Error in fetchCardPrice for ${oracleId}: ${error}`)
    return null
  }
}

/**
 * Circuit-breaker wrapped fetch function
 *
 * Wraps fetchCardPrice with Opossum circuit breaker.
 * Returns null when circuit is open instead of throwing.
 */
export const fetchCardPriceWithBreaker = wrapWithCircuitBreaker(fetchCardPrice, 'CardKingdom')

// Export the unwrapped function for testing
export { fetchCardPrice }

// Default export is the wrapped function
export default fetchCardPriceWithBreaker
