/**
 * CardMarket price fetching with API-first and scraping fallback
 *
 * Provides functions to:
 * - Fetch prices via CardMarket MKM API
 * - Scrape prices from cardmarket.com as fallback
 * - Fetch card prices using hybrid approach with circuit breaker
 *
 * CardMarket uses European decimal comma (€3,50 not €3.50)
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../../lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '../../lib/ratelimit/rate-limiter'
import { wrapWithCircuitBreaker } from '../circuit-breaker'

/**
 * Fetch card price via CardMarket API
 *
 * Uses CardMarket MKM API with app token/secret auth.
 * If no credentials configured, returns null immediately.
 *
 * @param cardName - Name of the card to search for
 * @returns Promise<number | null> - Price in EUR or null
 *
 * @example
 * ```ts
 * const price = await fetchViaAPI('Lightning Bolt')
 * ```
 */
async function fetchViaAPI(cardName: string): Promise<number | null> {
  const appToken = process.env.CARDMARKET_APP_TOKEN
  const appSecret = process.env.CARDMARKET_APP_SECRET

  if (!appToken || !appSecret) {
    logger.debug('CardMarket credentials not configured, skipping API')
    return null
  }

  try {
    // Check rate limit
    const { allowed } = await checkRateLimitPreset('cardmarket:api', RATE_LIMITS.CARDMARKET)

    if (!allowed) {
      throw new Error('CardMarket API rate limit exceeded')
    }

    // CardMarket MKM API endpoint
    // Note: Exact endpoint structure needs verification with API documentation
    const searchUrl = new URL('https://api.cardmarket.com/ws/v2.0/output.json/products/find')
    searchUrl.searchParams.append('search', cardName)
    searchUrl.searchParams.append('idGame', '1') // Magic: The Gathering

    const response = await axios.get(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${appToken}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    })

    // Parse response for price
    const data = response.data

    if (!data || !data.product || data.product.length === 0) {
      logger.warn(`No results found for card: ${cardName}`)
      return null
    }

    // Extract price guide from first result
    // Common fields: 'priceGuide' with 'avg', 'low', 'trend' prices
    const firstProduct = data.product[0]
    const priceGuide = firstProduct.priceGuide

    if (!priceGuide) {
      logger.warn(`No price guide found for card: ${cardName}`)
      return null
    }

    // Try avg price first, then low, then trend
    const price = priceGuide.avg ?? priceGuide.low ?? priceGuide.trend ?? null

    if (price === null) {
      logger.warn(`No price field found in price guide for card: ${cardName}`)
      return null
    }

    return Number.parseFloat(price)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        logger.error('CardMarket API authentication failed (invalid credentials)')
        return null
      }
      if (error.response?.status === 404) {
        logger.warn(`Card not found on CardMarket API: ${cardName}`)
        return null
      }
      logger.error(`CardMarket API error: ${error.message}`)
    } else {
      logger.error(`Error fetching from CardMarket API: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price via scraping from cardmarket.com
 *
 * Scrapes cardmarket.com as fallback when API is unavailable.
 * Builds search URL and extracts price from HTML using cheerio.
 * Handles European decimal comma format (€3,50 not €3.50).
 *
 * @param cardName - Name of the card to search for
 * @returns Promise<number | null> - Price in EUR or null
 *
 * @example
 * ```ts
 * const price = await fetchViaScraping('Lightning Bolt')
 * ```
 */
async function fetchViaScraping(cardName: string): Promise<number | null> {
  try {
    // Check rate limit
    const { allowed } = await checkRateLimitPreset('cardmarket:scrape', RATE_LIMITS.CARDMARKET)

    if (!allowed) {
      throw new Error('CardMarket scraping rate limit exceeded')
    }

    // Build CardMarket search URL
    const searchUrl = new URL('https://www.cardmarket.com/en/Products/Singles')
    searchUrl.searchParams.append('productName', cardName)
    searchUrl.searchParams.append('gameName', 'Magic')

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

    // Parse EUR string with European decimal comma (e.g., "€3,50" to 3.50)
    // Remove currency symbol and whitespace
    const cleanText = priceText.replace(/[€\s]/g, '')

    // Handle European decimal comma: replace comma with dot
    // Remove thousand separators (dots)
    const priceStr = cleanText.replace(/\./g, '').replace(',', '.')

    const price = Number.parseFloat(priceStr)

    if (Number.isNaN(price)) {
      logger.error(`Parsed price is NaN: "${priceStr}" from "${priceText}"`)
      return null
    }

    return price
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        logger.warn('Card not found on CardMarket (404)')
        return null
      }
      logger.error(`CardMarket scraping error: ${error.message}`)
    } else {
      logger.error(`Error scraping CardMarket: ${error}`)
    }
    return null
  }
}

/**
 * Fetch card price from CardMarket (hybrid approach)
 *
 * Tries API first, falls back to scraping if API returns null.
 * Uses database query to get card name from oracle_id.
 *
 * @param oracleId - Oracle ID of the card to fetch price for
 * @returns Promise<number | null> - Price in EUR or null
 *
 * @example
 * ```ts
 * const price = await fetchCardPrice('12345678-abcd-1234-abcd-1234567890ab')
 * ```
 */
async function fetchCardPrice(oracleId: string): Promise<number | null> {
  try {
    // Query cards table for card name
    const { db } = await import('../../db')
    const card = await db.query.cards.findFirst({
      where: (cards, { eq }) => eq(cards.oracleId, oracleId),
    })

    if (!card) {
      logger.error(`Card with oracle_id ${oracleId} not found in database`)
      return null
    }

    // Try API first
    const apiPrice = await fetchViaAPI(card.name)
    if (apiPrice !== null) {
      return apiPrice
    }

    // Fall back to scraping
    logger.debug(`CardMarket API unavailable, falling back to scraping for ${card.name}`)
    const scrapePrice = await fetchViaScraping(card.name)

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
export const fetchCardPriceWithBreaker = wrapWithCircuitBreaker(fetchCardPrice, 'CardMarket')

// Export the unwrapped function for testing
export { fetchCardPrice }

// Default export is the wrapped function
export default fetchCardPriceWithBreaker
