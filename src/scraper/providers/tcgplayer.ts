/**
 * TCGPlayer price fetching with API-first and scraping fallback
 *
 * Provides functions to:
 * - Fetch prices via TCGPlayer API (bearer token auth)
 * - Scrape prices from tcgplayer.com as fallback
 * - Fetch card prices using hybrid approach with circuit breaker
 *
 * API endpoint requires application for credentials per RESEARCH.md
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../../lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '../../lib/ratelimit/rate-limiter'
import { wrapWithCircuitBreaker } from '../circuit-breaker'

/**
 * Fetch card price via TCGPlayer API
 *
 * Uses TCGPlayer API with bearer token auth.
 * If no bearer token configured, returns null immediately.
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
  const bearerToken = process.env.TCGPLAYER_BEARER_TOKEN

  if (!bearerToken) {
    logger.debug('TCGPlayer bearer token not configured, skipping API')
    return null
  }

  try {
    // Check rate limit
    const { allowed } = await checkRateLimitPreset('tcgplayer:api', RATE_LIMITS.TCGPLAYER)

    if (!allowed) {
      throw new Error('TCGPlayer API rate limit exceeded')
    }

    // TCGPlayer API endpoint
    // Note: Exact endpoint structure needs verification with API documentation
    const searchUrl = new URL('https://api.tcgplayer.com/v1/catalog/products')
    searchUrl.searchParams.append('searchTerm', cardName)
    if (setCode) {
      searchUrl.searchParams.append('groupId', setCode)
    }

    const response = await axios.get(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
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

    // Extract lowest price from first result
    // Common fields: 'lowPrice', 'marketPrice', 'midPrice', 'price'
    const firstResult = data.results[0]
    const price =
      firstResult.lowPrice ?? firstResult.marketPrice ?? firstResult.midPrice ?? firstResult.price ?? null

    if (price === null) {
      logger.warn(`No price field found for card: ${cardName}`)
      return null
    }

    return Number.parseFloat(price)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        logger.error('TCGPlayer API authentication failed (invalid bearer token)')
        return null
      }
      if (error.response?.status === 404) {
        logger.warn(`Card not found on TCGPlayer API: ${cardName}`)
        return null
      }
      logger.error(`TCGPlayer API error: ${error.message}`)
    } else {
      logger.error(`Error fetching from TCGPlayer API: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price via scraping from tcgplayer.com
 *
 * Scrapes tcgplayer.com as fallback when API is unavailable.
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
    const { allowed } = await checkRateLimitPreset('tcgplayer:scrape', RATE_LIMITS.TCGPLAYER)

    if (!allowed) {
      throw new Error('TCGPlayer scraping rate limit exceeded')
    }

    // Build TCGPlayer search URL
    const searchUrl = new URL('https://www.tcgplayer.com/product/catalog/search')
    searchUrl.searchParams.append('productLineName', cardName)
    if (setCode) {
      searchUrl.searchParams.append('setName', setCode)
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
    const priceSelectors = ['.price', '[data-price]', '.product-price', '.sale-price', '.listing-price']

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

    // Parse USD string (e.g., "$4.99") to number (4.99)
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
        logger.warn('Card not found on TCGPlayer (404)')
        return null
      }
      logger.error(`TCGPlayer scraping error: ${error.message}`)
    } else {
      logger.error(`Error scraping TCGPlayer: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price from TCGPlayer (hybrid approach)
 *
 * Tries API first, falls back to scraping if API returns null.
 * Uses database query to get card name and set from oracle_id.
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

    // Try API first
    const apiPrice = await fetchViaAPI(card.name, card.set ?? undefined)
    if (apiPrice !== null) {
      return apiPrice
    }

    // Fall back to scraping
    logger.debug(`TCGPlayer API unavailable, falling back to scraping for ${card.name}`)
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
export const fetchCardPriceWithBreaker = wrapWithCircuitBreaker(fetchCardPrice, 'TCGPlayer')

// Export the unwrapped function for testing
export { fetchCardPrice }

// Default export is the wrapped function
export default fetchCardPriceWithBreaker
