/**
 * Scryfall bulk data import and card metadata refresh
 *
 * Provides functions to:
 * - Download Scryfall bulk data (card metadata)
 * - Parse and decompress gzip files
 * - Upsert cards to database
 * - Refresh stale card metadata (>30 days old)
 *
 * Critical note: Do NOT use bulk data prices - they are "dangerously stale after 24 hours"
 * Use only metadata (oracle_id, name, set, rarity, image_uris)
 */

import zlib from 'node:zlib'
import axios from 'axios'
import { eq } from 'drizzle-orm'
import { cards, db } from '../../db'
import { RATE_LIMITS, checkRateLimitPreset } from '../../lib/ratelimit/rate-limiter'

/**
 * Scryfall bulk data item from API response
 */
interface ScryfallBulkDataItem {
  object: string
  id: string
  type: 'default_cards' | 'unique_artwork' | 'oracle_cards' | 'all_cards' | 'rulings'
  updated_at: string
  download_uri: string
  name: string
}

/**
 * Scryfall card object from bulk data
 */
export interface ScryfallCard {
  object: string
  id: string
  oracle_id: string
  name: string
  set: string
  set_name: string
  rarity: string
  colors: string[]
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
  card_faces?: Array<{
    name: string
    image_uris?: {
      small: string
      normal: string
      large: string
      png: string
      art_crop: string
      border_crop: string
    }
  }>
}

/**
 * Download Scryfall bulk data and parse card metadata
 *
 * Fetches bulk data metadata from Scryfall API, finds the "Unique Artwork" or
 * "Default Cards" file, downloads the gzip file, decompresses it, and returns
 * the parsed JSON array of card objects.
 *
 * Rate limits to 10 req/sec using existing rate limiter.
 *
 * @returns Promise<ScryfallCard[]> - Array of Scryfall card objects
 *
 * @throws Error if bulk data download fails or parsing fails
 *
 * @example
 * ```ts
 * const cards = await downloadBulkData()
 * console.log(`Downloaded ${cards.length} cards`)
 * ```
 */
export async function downloadBulkData(): Promise<ScryfallCard[]> {
  try {
    // Check rate limit before API call
    const { allowed } = await checkRateLimitPreset('scryfall:bulk', RATE_LIMITS.SCRYFALL)
    if (!allowed) {
      throw new Error('Scryfall rate limit exceeded')
    }

    // 1. Fetch bulk data metadata
    const metadataResponse = await axios.get<{ data: ScryfallBulkDataItem[] }>(
      'https://api.scryfall.com/bulk-data',
    )

    const bulkItems = metadataResponse.data.data

    // 2. Find "Unique Artwork" or "Default Cards" file
    const uniqueArtwork = bulkItems.find((item) => item.type === 'unique_artwork')
    const defaultCards = bulkItems.find((item) => item.type === 'default_cards')

    const downloadUri = uniqueArtwork?.download_uri || defaultCards?.download_uri

    if (!downloadUri) {
      throw new Error('No suitable bulk data file found (expected unique_artwork or default_cards)')
    }

    // 3. Download gzip file
    const { data: gzipBuffer } = await axios.get<Buffer>(downloadUri, {
      responseType: 'arraybuffer',
      headers: {
        'Accept-Encoding': 'gzip',
      },
    })

    // 4. Decompress gzip
    const gunzipPromise = new Promise<Buffer>((resolve, reject) => {
      zlib.gunzip(gzipBuffer, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })

    const jsonString = (await gunzipPromise).toString('utf-8')

    // 5. Parse JSON
    const cards = JSON.parse(jsonString) as ScryfallCard[]

    return cards
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Scryfall API error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Upsert Scryfall cards to database
 *
 * Performs batch upsert (insert or update on conflict) to cards table.
 * Maps Scryfall card fields to database columns.
 *
 * Filters to recent core/expansion sets for initial seed (100-500 cards).
 * This is temporary until Phase 5 metagame auto-discovery.
 *
 * @param scryfallCards - Array of Scryfall card objects
 * @returns Promise<number> - Number of cards upserted
 *
 * @example
 * ```ts
 * const cards = await downloadBulkData()
 * const count = await upsertCards(cards)
 * console.log(`Upserted ${count} cards`)
 * ```
 */
export async function upsertCards(scryfallCards: ScryfallCard[]): Promise<number> {
  if (!scryfallCards.length) {
    return 0
  }

  try {
    // Filter to recent core/expansion sets (last 2 years)
    // This is temporary manual seed until Phase 5 metagame auto-discovery
    const recentSetCodes = new Set([
      'MKM', // Murders at Karlov Manor (2024)
      'OTJ', // Outlaws of Thunder Junction (2024)
      'BLB', // Bloomburrow (2024)
      'DSK', // Duskmourn (2024)
      'FDN', // Foundation (2024)
      'SPG', // Spinning (2024)
      'MMT', // Modern Masters (2024)
      'MAT', // Modern Masters (2024)
    ])

    const filteredCards = scryfallCards.filter((card) => card.oracle_id && recentSetCodes.has(card.set))

    // Map Scryfall cards to database schema
    const cardsToInsert = filteredCards.map((card) => {
      // Handle single-face and transform cards
      let imageUrl: string | undefined

      if (card.image_uris?.normal) {
        // Single-face card
        imageUrl = card.image_uris.normal
      } else if (card.card_faces?.[0]?.image_uris?.normal) {
        // Transform card (use first face)
        imageUrl = card.card_faces[0].image_uris.normal
      }

      return {
        oracleId: card.oracle_id,
        name: card.name,
        set: card.set,
        rarity: card.rarity,
        color: card.colors?.join(',') || null,
        imageUrl: imageUrl || null,
        lastFetched: new Date(),
      }
    })

    // Batch upsert in chunks of 100 (PostgreSQL parameter limit)
    const chunkSize = 100
    let upsertedCount = 0

    for (let i = 0; i < cardsToInsert.length; i += chunkSize) {
      const chunk = cardsToInsert.slice(i, i + chunkSize)

      for (const cardData of chunk) {
        await db
          .insert(cards)
          .values(cardData)
          .onConflictDoUpdate({
            target: cards.oracleId,
            set: {
              name: cardData.name,
              set: cardData.set,
              rarity: cardData.rarity,
              color: cardData.color,
              imageUrl: cardData.imageUrl,
              lastFetched: cardData.lastFetched,
            },
          })
        upsertedCount++
      }
    }

    return upsertedCount
  } catch (error) {
    console.error('Error upserting cards:', error)
    throw error
  }
}

/**
 * Refresh card metadata for cards older than 30 days
 *
 * Queries cards table for cards where lastFetched is NULL or > 30 days ago,
 * re-fetches card data from Scryfall API (not bulk data), and updates the
 * cards table with fresh metadata.
 *
 * Uses date-fns differenceInDays for calculation.
 * Rate limits to 10 req/sec.
 *
 * Note: Scryfall API endpoint for single card returns TCGPlayer prices -
 * DO NOT use those prices (per RESEARCH.md).
 *
 * @returns Promise<{ refreshed: number; failed: number }> - Statistics
 *
 * @example
 * ```ts
 * const { refreshed, failed } = await refreshCardMetadata()
 * console.log(`Refreshed ${refreshed} cards, ${failed} failed`)
 * ```
 */
export async function refreshCardMetadata(): Promise<{
  refreshed: number
  failed: number
}> {
  const { differenceInDays } = await import('date-fns')

  try {
    // Query cards where lastFetched is NULL or > 30 days ago
    const allCards = await db.query.cards.findMany()

    const staleCards = allCards.filter((card) => {
      if (!card.lastFetched) return true
      const daysSince = differenceInDays(new Date(), card.lastFetched)
      return daysSince > 30
    })

    if (staleCards.length === 0) {
      return { refreshed: 0, failed: 0 }
    }

    let refreshed = 0
    let failed = 0

    for (const card of staleCards) {
      try {
        // Check rate limit before each API call
        const { allowed } = await checkRateLimitPreset('scryfall:refresh', RATE_LIMITS.SCRYFALL)
        if (!allowed) {
          throw new Error('Scryfall rate limit exceeded')
        }

        // Fetch single card from Scryfall API
        const response = await axios.get<ScryfallCard>(`https://api.scryfall.com/cards/${card.oracleId}`)

        const scryfallCard = response.data

        // Extract image URL
        let imageUrl: string | undefined
        if (scryfallCard.image_uris?.normal) {
          imageUrl = scryfallCard.image_uris.normal
        } else if (scryfallCard.card_faces?.[0]?.image_uris?.normal) {
          imageUrl = scryfallCard.card_faces[0].image_uris.normal
        }

        // Update card in database
        await db
          .update(cards)
          .set({
            name: scryfallCard.name,
            set: scryfallCard.set,
            rarity: scryfallCard.rarity,
            color: scryfallCard.colors?.join(',') || null,
            imageUrl: imageUrl || null,
            lastFetched: new Date(),
          })
          .where(eq(cards.oracleId, card.oracleId))

        refreshed++
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // Card removed from Scryfall - log and skip
          console.warn(`Card ${card.oracleId} not found on Scryfall (404)`)
        } else {
          console.error(`Error refreshing card ${card.oracleId}:`, error)
        }
        failed++
      }
    }

    return { refreshed, failed }
  } catch (error) {
    console.error('Error in refreshCardMetadata:', error)
    throw error
  }
}
