/**
 * EDHREC Commander metagame fetcher.
 *
 * Fetches the top Commander cards from EDHREC's public JSON endpoint.
 * Per RESEARCH.md Pattern 1: https://json.edhrec.com/pages/top/week.json
 * Per CONTEXT.md D-03: EDHREC is the source of truth for Commander.
 *
 * Failures are logged and return an empty array (never throw) so the
 * orchestrator can continue with other formats — circuit-breaker semantics.
 *
 * IMPORTANT: The `id` field in EDHREC JSON is a Scryfall card id (printing-specific),
 * NOT oracle_id. Do NOT use it as oracle_id. Plan 03 resolves names → oracle_id
 * via Scryfall's /cards/collection batch endpoint.
 */

import axios from 'axios'
import { logger } from '@/lib/logger'

const EDHREC_TOP_WEEK_URL = 'https://json.edhrec.com/pages/top/week.json'
const MAX_CARD_NAME_LENGTH = 255 // matches wishlists.cardId varchar(255)

interface EDHRECCardview {
  name?: string
  // Other fields exist but are not used here.
}

interface EDHRECResponse {
  cardviews?: EDHRECCardview[]
  container?: {
    json_dict?: {
      cardlists?: Array<{ cardviews?: EDHRECCardview[] }>
    }
  }
}

/**
 * Fetch top Commander card names from EDHREC.
 *
 * @param limit Maximum number of card names to return (default 50 per CONTEXT.md D-01)
 * @returns Array of trimmed, length-capped card names; empty array on failure
 */
export async function fetchEDHRECTopCards(limit = 50): Promise<string[]> {
  try {
    const response = await axios.get<EDHRECResponse>(EDHREC_TOP_WEEK_URL)

    // Primary path: response.data.cardviews
    let cardviews: EDHRECCardview[] | undefined = response.data?.cardviews

    // Fallback path per RESEARCH.md Open Question 2
    if (!cardviews || cardviews.length === 0) {
      cardviews = response.data?.container?.json_dict?.cardlists?.[0]?.cardviews
    }

    if (!cardviews || cardviews.length === 0) {
      logger.warn(
        `EDHREC fetch succeeded but neither response.data.cardviews nor container.json_dict.cardlists[0].cardviews contained data; returning []`,
      )
      return []
    }

    const names = cardviews
      .map((c) => (typeof c?.name === 'string' ? c.name.trim().slice(0, MAX_CARD_NAME_LENGTH) : ''))
      .filter((name) => name.length > 0)
      .slice(0, limit)

    logger.info(`EDHREC: fetched ${names.length} Commander top cards`)
    return names
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`EDHREC fetch failed (Commander format will be skipped this run): ${message}`)
    return []
  }
}
