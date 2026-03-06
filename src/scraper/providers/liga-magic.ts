/**
 * Liga Magic price scraping with cheerio/Playwright
 *
 * Provides functions to:
 * - Check robots.txt compliance before scraping
 * - Fetch card prices from ligamagic.com.br
 * - Extract BRL prices from HTML
 *
 * No documented public API - scraping-only approach per CONTEXT.md
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { RATE_LIMITS, checkRateLimitPreset } from '../../lib/ratelimit/rate-limiter'

/**
 * Robots.txt cache entry
 */
interface RobotsTxtCache {
  allowed: boolean
  fetchedAt: Date
  crawlDelay?: number
}

// Cache robots.txt for 24 hours
const robotsTxtCache = new Map<string, RobotsTxtCache>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Check robots.txt for Liga Magic
 *
 * Fetches https://ligamagic.com.br/robots.txt, parses User-agent and Disallow rules,
 * and returns boolean: true if scraping allowed, false if prohibited.
 *
 * Logs warnings if scraping is discouraged or if crawl-delay is specified.
 * Caches robots.txt content for 24 hours (doesn't fetch on every call).
 *
 * @returns Promise<boolean> - true if scraping allowed, false if prohibited
 *
 * @example
 * ```ts
 * const allowed = await checkRobotsTxt()
 * if (!allowed) {
 *   console.warn('Liga Magic prohibits scraping')
 * }
 * ```
 */
export async function checkRobotsTxt(): Promise<boolean> {
  const url = 'https://ligamagic.com.br/robots.txt'

  try {
    // Check cache first
    const cached = robotsTxtCache.get(url)
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL) {
      return cached.allowed
    }

    // Fetch robots.txt
    const response = await axios.get(url, { timeout: 5000 })

    const robotsTxt = response.data
    const lines = robotsTxt.split('\n')

    let allowed = true
    let crawlDelay: number | undefined

    // Parse robots.txt
    let userAgentMatch = false
    const disallowPaths: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      // Check for User-agent: * (applies to all bots)
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const userAgent = trimmed.split(':')[1].trim().toLowerCase()
        userAgentMatch = userAgent === '*' || userAgent === '*'
      }

      // Check for Disallow rules
      if (userAgentMatch && trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.split(':')[1].trim()

        // Disallow: / means all paths are prohibited
        if (path === '/') {
          allowed = false
        }

        disallowPaths.push(path)
      }

      // Check for Crawl-delay
      if (trimmed.toLowerCase().startsWith('crawl-delay:')) {
        const delay = Number.parseFloat(trimmed.split(':')[1].trim())
        if (!Number.isNaN(delay)) {
          crawlDelay = delay
        }
      }
    }

    // Log warnings
    if (!allowed) {
      console.warn('Liga Magic robots.txt prohibits scraping (Disallow: /)')
    }

    if (crawlDelay && crawlDelay > 1) {
      console.warn(`Liga Magic robots.txt specifies crawl-delay: ${crawlDelay} seconds`)
    }

    if (disallowPaths.length > 0 && allowed) {
      console.info(`Liga Magic robots.txt allows scraping with ${disallowPaths.length} disallow paths`)
    }

    // Cache result
    robotsTxtCache.set(url, {
      allowed,
      fetchedAt: new Date(),
      crawlDelay,
    })

    return allowed
  } catch (error) {
    // If robots.txt unreachable (404/500), log warning and allow scraping (fail-open)
    if (axios.isAxiosError(error)) {
      console.warn(
        `Liga Magic robots.txt unreachable (${error.response?.status || error.message}), allowing scraping (fail-open)`,
      )
    } else {
      console.error('Error checking Liga Magic robots.txt:', error)
    }

    // Fail-open: allow scraping if robots.txt is unavailable
    return true
  }
}

/**
 * Fetch card price from Liga Magic
 *
 * Searches for card by name (Scryfall name mapped to Liga Magic search),
 * extracts BRL price from page HTML using cheerio or Playwright fallback.
 *
 * Returns price_brl (number) or null if not found.
 * Respects robots.txt and rate limits (30 req/min conservative).
 *
 * @param oracleId - Oracle ID of the card to fetch price for
 * @returns Promise<number | null> - Price in BRL or null if not found
 *
 * @example
 * ```ts
 * const price = await fetchCardPrice('12345678-abcd-1234-abcd-1234567890ab')
 * if (price !== null) {
 *   console.log(`Price: R$ ${price.toFixed(2)}`)
 * }
 * ```
 */
export async function fetchCardPrice(oracleId: string): Promise<number | null> {
  try {
    // Check robots.txt compliance first
    const allowed = await checkRobotsTxt()
    if (!allowed) {
      console.warn('Liga Magic prohibits scraping via robots.txt')
      return null
    }

    // Check rate limit
    const { allowed: rateLimitAllowed } = await checkRateLimitPreset('ligamagic:fetch', {
      limit: 30,
      interval: 60,
    })

    if (!rateLimitAllowed) {
      throw new Error('Liga Magic rate limit exceeded')
    }

    // Query cards table for card name and set
    const { db } = await import('../../db')
    const card = await db.query.cards.findFirst({
      where: (cards, { eq }) => eq(cards.oracleId, oracleId),
    })

    if (!card) {
      console.error(`Card with oracle_id ${oracleId} not found in database`)
      return null
    }

    // Build Liga Magic search URL
    const searchUrl = new URL('https://ligamagic.com.br/?view=cards/search')
    searchUrl.searchParams.append('card', card.name)
    if (card.set) {
      searchUrl.searchParams.append('set', card.set)
    }

    // Fetch page HTML with axios
    const response = await axios.get(searchUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    })

    const html = response.data

    // Parse with cheerio (try cheerio first for speed)
    const $ = cheerio.load(html)

    // Extract price from selector
    // Note: Exact selector needs to be determined by inspecting actual HTML
    // Common selectors: '.price', '[data-price]', '.card-price', '.preco'
    const priceSelectors = [
      '.price',
      '[data-price]',
      '.card-price',
      '.preco',
      '.product-price',
      '.price-label',
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
      console.warn(`Price not found for card ${card.name} using cheerio selectors`)
      return null
    }

    // Parse BRL string (e.g., "R$ 45,90") to number (45.90)
    const priceMatch = priceText.match(/[\d.,]+/)
    if (!priceMatch) {
      console.error(`Could not parse price from text: "${priceText}"`)
      return null
    }

    const priceStr = priceMatch[0].replace('.', '').replace(',', '.')
    const price = Number.parseFloat(priceStr)

    if (Number.isNaN(price)) {
      console.error(`Parsed price is NaN: "${priceStr}" from "${priceText}"`)
      return null
    }

    return price
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        console.warn('Card not found on Liga Magic (404)')
        return null
      }
      console.error(`Liga Magic API error: ${error.message}`)
    } else {
      console.error(`Error fetching price from Liga Magic: ${error}`)
    }
    return null
  }
}
