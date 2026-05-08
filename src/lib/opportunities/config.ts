import { logger } from '@/lib/logger'

/**
 * Typed configuration object for the opportunity detection system.
 *
 * All numeric values are validated on load — malformed env vars fall back to
 * safe defaults rather than crashing the process.
 */
export interface DetectionConfig {
  /** Minimum price drop ratio to qualify as an opportunity (e.g. 0.15 = 15%) */
  dropThreshold: number
  /** Number of days to look back for the recent price drop comparison */
  lookbackDays: number
  /** Number of days used to compute the 30-day historical baseline mean */
  baselineDays: number
  /** Days a (card, source) pair is silenced after an alert fires */
  cooldownDays: number
  /** Minimum days of price history required before a pair becomes eligible */
  minHistoryDays: number
  /** Raw cron expression for the morning collection run */
  cronMorning: string
  /** Raw cron expression for the afternoon collection run */
  cronAfternoon: string
  /** Raw cron expression for the evening collection run */
  cronEvening: string
  /** Human-readable run times derived from the cron expressions, e.g. "09:00, 15:00, 21:00" */
  runTimesHuman: string
}

/**
 * Convert a standard 5-field cron expression to an HH:MM string.
 *
 * Cron field order: minute hour dom month dow
 * The scheduled-task crons look like "0 9 * * *" → hour=9, minute=0 → "09:00"
 *
 * @param cron - A cron expression string
 * @returns Padded "HH:MM" string, or "??" if the expression cannot be parsed
 */
function cronToHHMM(cron: string): string {
  const fields = cron.trim().split(/\s+/)
  if (fields.length < 2) return '??'
  const minuteStr = fields[0]
  const hourStr = fields[1]
  const minute = Number(minuteStr)
  const hour = Number(hourStr)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '??'
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Parse a float env var with a safe default fallback.
 *
 * A value is considered invalid when it is non-finite or non-positive.
 *
 * @param raw       - Raw string from process.env (may be undefined)
 * @param varName   - Env var name used in the warning message
 * @param defaultVal - Default to return on invalid input
 * @returns Parsed float or defaultVal
 */
function parseFloatEnv(raw: string | undefined, varName: string, defaultVal: number): number {
  if (raw === undefined) return defaultVal
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(`Invalid ${varName}="${raw}"; falling back to default ${defaultVal}`)
    return defaultVal
  }
  return parsed
}

/**
 * Parse an integer env var representing a day count (must be ≥ 1).
 *
 * @param raw       - Raw string from process.env (may be undefined)
 * @param varName   - Env var name used in the warning message
 * @param defaultVal - Default to return on invalid input
 * @returns Parsed integer or defaultVal
 */
function parseDaysEnv(raw: string | undefined, varName: string, defaultVal: number): number {
  if (raw === undefined) return defaultVal
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    logger.warn(`Invalid ${varName}="${raw}"; falling back to default ${defaultVal}`)
    return defaultVal
  }
  return parsed
}

/**
 * Load and validate the detection configuration from environment variables.
 *
 * Re-reads process.env on every call — callers that mutate the returned
 * object get their own copy; there is no shared singleton state.
 *
 * Env vars read (all optional — safe defaults applied when absent):
 *   DETECT_DROP_THRESHOLD      (default 0.15)
 *   DETECT_LOOKBACK_DAYS       (default 7)
 *   DETECT_BASELINE_DAYS       (default 30)
 *   DETECT_COOLDOWN_DAYS       (default 7)
 *   DETECT_MIN_HISTORY_DAYS    (default 30)
 *   CRON_MORNING               (default '0 9 * * *')
 *   CRON_AFTERNOON             (default '0 15 * * *')
 *   CRON_EVENING               (default '0 21 * * *')
 */
export function loadDetectionConfig(): DetectionConfig {
  const dropThreshold = parseFloatEnv(process.env.DETECT_DROP_THRESHOLD, 'DETECT_DROP_THRESHOLD', 0.15)
  const lookbackDays = parseDaysEnv(process.env.DETECT_LOOKBACK_DAYS, 'DETECT_LOOKBACK_DAYS', 7)
  const baselineDays = parseDaysEnv(process.env.DETECT_BASELINE_DAYS, 'DETECT_BASELINE_DAYS', 30)
  const cooldownDays = parseDaysEnv(process.env.DETECT_COOLDOWN_DAYS, 'DETECT_COOLDOWN_DAYS', 7)
  const minHistoryDays = parseDaysEnv(process.env.DETECT_MIN_HISTORY_DAYS, 'DETECT_MIN_HISTORY_DAYS', 30)

  // Cron defaults copied verbatim from src/scheduler/jobs.ts lines 169-171
  const cronMorning = process.env.CRON_MORNING || '0 9 * * *'
  const cronAfternoon = process.env.CRON_AFTERNOON || '0 15 * * *'
  const cronEvening = process.env.CRON_EVENING || '0 21 * * *'

  const runTimesHuman = [cronToHHMM(cronMorning), cronToHHMM(cronAfternoon), cronToHHMM(cronEvening)].join(
    ', ',
  )

  return {
    dropThreshold,
    lookbackDays,
    baselineDays,
    cooldownDays,
    minHistoryDays,
    cronMorning,
    cronAfternoon,
    cronEvening,
    runTimesHuman,
  }
}
