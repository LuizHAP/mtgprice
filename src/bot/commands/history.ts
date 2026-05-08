/**
 * /history command handler
 *
 * Shows the 10 most recent opportunities detected by the price pipeline.
 * Format matches CONTEXT.md D-18.
 * Runs behind the chat-ID whitelist (inherited from bot.use(whitelistMiddleware) in src/bot/index.ts).
 *
 * NOTE: formatSaoPauloTimestamp and SOURCE_DISPLAY_NAMES are INLINED here rather than
 * imported from @/lib/opportunities/digest. digest.ts imports the grammY bot via
 * @/lib/telegram, which would force this file's tests to mock @/lib/telegram
 * transitively. Inlining keeps the test harness for /history free of that coupling.
 */

import { getRecentOpportunities } from '@/lib/opportunities/queries'
import { bot } from '@/lib/telegram'
import type { Context } from 'grammy'

const SOURCE_DISPLAY_NAMES = {
  ligamagic: 'Liga Magic',
  tcgplayer: 'TCGPlayer',
  cardmarket: 'CardMarket',
  cardkingdom: 'CardKingdom',
} as const

// Inlined pure helper — do NOT import from @/lib/opportunities/digest (coupling avoidance).
function formatSaoPauloTimestamp(now: Date): string {
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

bot.command('history', async (ctx: Context) => {
  try {
    const rows = await getRecentOpportunities(10)
    if (rows.length === 0) {
      await ctx.reply('📜 Nenhuma oportunidade registrada ainda.')
      return
    }
    const noun = rows.length === 1 ? 'Última 1 oportunidade' : `Últimas ${rows.length} oportunidades`
    const header = `📜 ${noun}`
    const lines = rows.map((r) => {
      const ts = formatSaoPauloTimestamp(r.detectedAt)
      const sourceDisplay = SOURCE_DISPLAY_NAMES[r.source as keyof typeof SOURCE_DISPLAY_NAMES] ?? r.source
      const priceInt = Math.round(r.currentPrice)
      const dropInt = Math.round(r.dropPercent)
      return `[${ts}] ↓ ${r.cardName} — R$ ${priceInt} (${sourceDisplay}) — ↓${dropInt}%`
    })
    await ctx.reply([header, ...lines].join('\n'))
  } catch (error) {
    console.error('Error in /history command:', error)
    await ctx.reply('Erro ao buscar histórico. Tente novamente.')
  }
})
