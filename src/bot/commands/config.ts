/**
 * /config command handler
 *
 * Read-only display of the current opportunity detection configuration.
 * Matches CONTEXT.md D-20 format verbatim. Values pulled from loadDetectionConfig
 * (which reads env vars with safe defaults — see Plan 04-02).
 *
 * v1 is read-only: passing arguments (e.g. `/config drop_threshold 0.20`) is ignored.
 * Editable config is deferred to v2.
 */

import { loadDetectionConfig } from '@/lib/opportunities/config'
import { bot } from '@/lib/telegram'
import type { Context } from 'grammy'

bot.command('config', async (ctx: Context) => {
  try {
    const config = loadDetectionConfig()
    const thresholdPercent = Math.round(config.dropThreshold * 100)
    const lines = [
      '⚙️ Configuração atual',
      `Drop threshold: ${thresholdPercent}%`,
      `Lookback: ${config.lookbackDays} dias`,
      `Baseline: média de ${config.baselineDays} dias`,
      `Cooldown: ${config.cooldownDays} dias por carta/fonte`,
      `Mínimo de histórico: ${config.minHistoryDays} dias`,
      `Runs diários: ${config.runTimesHuman}`,
    ]
    await ctx.reply(lines.join('\n'))
  } catch (error) {
    console.error('Error in /config command:', error)
    await ctx.reply('Erro ao carregar configuração.')
  }
})
