/**
 * Digest builder and sender for opportunity notifications.
 *
 * Provides:
 * - formatSaoPauloTimestamp: pure timestamp formatter for America/Sao_Paulo
 * - buildDigest: pure function producing verbatim D-14 plain-text format
 * - sendDigestAndPersist: orchestrates persist-first, rate-limited Telegram send with D-24 retry
 *
 * Security notes (T-04-04-01): bot.api.sendMessage is called without parse_mode,
 * so card names are never interpreted as Markdown.
 * Security notes (T-04-04-08): errors are logged via Winston only; never echoed to chat.
 */

import { logger } from '@/lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '@/lib/ratelimit/rate-limiter'
import { bot } from '@/lib/telegram'
import type { DetectedOpportunity } from './queries'
import { getUnsentOpportunitiesLast24h, insertOpportunity, markOpportunitySent } from './queries'

// ─── Source display names ─────────────────────────────────────────────────────

const SOURCE_DISPLAY_NAMES = {
  ligamagic: 'Liga Magic',
  tcgplayer: 'TCGPlayer',
  cardmarket: 'CardMarket',
  cardkingdom: 'CardKingdom',
} as const

// ─── formatSaoPauloTimestamp ──────────────────────────────────────────────────

/**
 * Format a Date as "DD/MM HH:mm" in the America/Sao_Paulo timezone.
 *
 * Pure function — no side effects. Uses Intl.DateTimeFormat to force
 * America/Sao_Paulo regardless of process.env.TZ (T-04-04-09 mitigation).
 *
 * @param now - The Date to format
 * @returns String in "DD/MM HH:mm" format, e.g. "15/04 15:00"
 */
export function formatSaoPauloTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`
}

// ─── buildDigest ──────────────────────────────────────────────────────────────

/**
 * Build the plain-text digest string matching D-14 format verbatim.
 *
 * Header: "🔥 N oportunidades (DD/MM HH:mm)" (singular "oportunidade" when N===1)
 * Lines: "↓ CardName — R$ price (Source) — ↓drop% (média R$ baseline)"
 *
 * Uses em-dash — (U+2014), NOT hyphen. Prices are Math.round()'d to integers.
 *
 * @param opportunities - Non-empty array of DetectedOpportunity objects
 * @param now - Timestamp for the digest header (formatted in America/Sao_Paulo)
 * @returns Plain-text digest string
 * @throws Error if opportunities is empty (caller must check length)
 */
export function buildDigest(opportunities: DetectedOpportunity[], now: Date): string {
  if (opportunities.length === 0) {
    throw new Error('buildDigest called with empty opportunities array; caller must check length')
  }
  const noun = opportunities.length === 1 ? 'oportunidade' : 'oportunidades'
  const header = `🔥 ${opportunities.length} ${noun} (${formatSaoPauloTimestamp(now)})`
  const lines = opportunities.map((op) => {
    const sourceDisplay = SOURCE_DISPLAY_NAMES[op.source]
    const priceInt = Math.round(op.currentPrice)
    const baselineInt = Math.round(op.baselinePrice)
    const dropInt = Math.round(op.dropPercent)
    return `↓ ${op.cardName} — R$ ${priceInt} (${sourceDisplay}) — ↓${dropInt}% (média R$ ${baselineInt})`
  })
  return [header, ...lines].join('\n')
}

// ─── sendDigestAndPersist ─────────────────────────────────────────────────────

/**
 * Persist opportunities then send a single rate-limited Telegram digest.
 *
 * Flow (D-24 persist-first, D-23 rate limit, D-10 silent on empty):
 * 1. Empty list → log info and return { persisted: 0, sent: false } without sending.
 * 2. TZ mismatch check → logger.warn if process.env.TZ !== 'America/Sao_Paulo'.
 * 3. Merge fresh opportunities with unsent rows from last 24h (D-24 retry), de-dup by (cardId, source).
 * 4. Persist each fresh opportunity via insertOpportunity (errors logged, not re-thrown).
 * 5. Rate limit check (D-23) → if !allowed, return { persisted, sent: false, error: 'rate_limited' }.
 * 6. Build digest text and call bot.api.sendMessage (plain text, no parse_mode — T-04-04-01).
 * 7. On send success: mark all freshly inserted rows AND retry rows as sent.
 *
 * @param opportunities - Fresh DetectedOpportunity objects from this run
 * @returns { persisted, sent, error? }
 */
export async function sendDigestAndPersist(
  opportunities: DetectedOpportunity[],
): Promise<{ persisted: number; sent: boolean; error?: string }> {
  // D-10: silent when empty
  if (opportunities.length === 0) {
    logger.info('No opportunities detected this run (silent per D-10)')
    return { persisted: 0, sent: false }
  }

  // T-04-04-09: warn if server TZ differs from America/Sao_Paulo
  if (process.env.TZ && process.env.TZ !== 'America/Sao_Paulo') {
    logger.warn(
      `TZ mismatch: process.env.TZ=${process.env.TZ}, digest timestamps forced to America/Sao_Paulo`,
    )
  }

  // D-24: merge with unsent opportunities from last 24h (retry path)
  const unsent = await getUnsentOpportunitiesLast24h()
  const makeKey = (o: { cardId: string; source: string }) => `${o.cardId}|${o.source}`
  const freshKeys = new Set(opportunities.map(makeKey))
  const retryOps = unsent.filter((u) => !freshKeys.has(makeKey(u)))
  const merged: DetectedOpportunity[] = [...opportunities, ...retryOps]

  // D-24: persist FIRST — rows remain with sent_to_user=false if send fails
  const insertedIds: number[] = []
  let persisted = 0
  for (const op of opportunities) {
    try {
      const row = await insertOpportunity(op)
      if (row !== null) {
        insertedIds.push(row.id)
        persisted += 1
      } else {
        logger.warn(
          `insertOpportunity skipped for ${op.cardId}/${op.source}: duplicate unsent row (concurrent insert)`,
        )
      }
    } catch (err) {
      logger.error(
        `insertOpportunity failed for ${op.cardId}/${op.source}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // D-23: single rate-limited send
  const { allowed } = await checkRateLimitPreset('telegram:digest', RATE_LIMITS.TELEGRAM)
  if (!allowed) {
    logger.warn(
      'Telegram rate limit exceeded for digest; opportunities persisted with sent_to_user=false for retry on next run',
    )
    return { persisted, sent: false, error: 'rate_limited' }
  }

  // Validate chat ID (T-04-04-05: only TELEGRAM_CHAT_ID, not the bot token)
  const chatIdRaw = process.env.TELEGRAM_CHAT_ID
  if (!chatIdRaw) {
    logger.error('TELEGRAM_CHAT_ID is not set; cannot send digest')
    return { persisted, sent: false, error: 'chat_id_missing' }
  }
  const chatId = Number(chatIdRaw)
  if (!Number.isFinite(chatId)) {
    logger.error(`TELEGRAM_CHAT_ID="${chatIdRaw}" is not a valid integer; cannot send digest`)
    return { persisted, sent: false, error: 'chat_id_invalid' }
  }

  // Build and send digest (T-04-04-01: plain text, no parse_mode)
  const digestText = buildDigest(merged, new Date())

  try {
    await bot.api.sendMessage(chatId, digestText)
  } catch (err) {
    // T-04-04-08: errors logged via Winston only, never echoed to chat
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(`Telegram sendMessage failed: ${errMsg}`)
    return { persisted, sent: false, error: errMsg }
  }

  // Mark freshly inserted rows as sent
  for (const id of insertedIds) {
    try {
      await markOpportunitySent(id)
    } catch (err) {
      logger.error(
        `markOpportunitySent failed for id=${id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // Mark retried unsent rows as sent (D-24 retry completion)
  for (const u of retryOps) {
    if ('id' in u && typeof u.id === 'number') {
      try {
        await markOpportunitySent(u.id)
      } catch (err) {
        logger.error(
          `markOpportunitySent failed for retry id=${u.id}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  logger.info(`Digest sent: ${opportunities.length} fresh + ${retryOps.length} retried`)
  return { persisted, sent: true }
}
