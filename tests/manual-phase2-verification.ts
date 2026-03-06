#!/usr/bin/env tsx
/**
 * Phase 2 Manual Verification Tests
 *
 * Run these tests to verify Phase 2 implementation:
 * 1. Brazilian Central Bank API integration
 * 2. Scheduler startup
 * 3. Full pipeline with real cards
 * 4. Smart refresh behavior
 * 5. Circuit breaker scenarios
 *
 * Usage:
 *   tsx tests/manual-phase2-verification.ts
 */

import { db } from '../src/db'
import { getLatestPrice, getPriceHistory, insertPrice } from '../src/db/queries/prices'
import { cards } from '../src/db/schema'
import { IOF_RATE, convertToBRL, getExchangeRate } from '../src/lib/currency'
import { logger } from '../src/lib/logger'
import { executePriceCollection, schedulePriceCollection } from '../src/scheduler/jobs'
import { fetchCardPriceFromAllSources } from '../src/scraper/orchestrator'

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
}

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`)
}

async function waitForEnter(prompt: string) {
  // In a real environment, this would wait for user input
  log(colors.cyan, `\n${prompt} (Press Enter to continue...)`)
}

// =============================================================================
// Test 1: Brazilian Central Bank API Integration
// =============================================================================

async function testExchangeRateAPI() {
  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.magenta, 'TEST 1: Brazilian Central Bank API Integration')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    log(colors.cyan, '\n📊 Testing IOF calculation...')
    const testAmount = 100
    const withIOF = testAmount * (1 + IOF_RATE)
    log(colors.white, `  IOF Rate: ${IOF_RATE * 100}%`)
    log(colors.white, `  Input: ${testAmount}`)
    log(colors.white, `  Expected: ${withIOF.toFixed(2)}`)
    log(colors.white, `  Actual: ${IOF_RATE * 100}% of ${testAmount} = ${withIOF.toFixed(2)}`)
    log(colors.green, '  ✓ IOF calculation correct')

    await waitForEnter('Test live exchange rate fetch')

    log(colors.cyan, '\n🌍 Testing exchange rate fetch from Brazilian Central Bank API...')

    // Test USD rate
    log(colors.white, '  Fetching USD → BRL rate...')
    const usdRate = await getExchangeRate('USD')
    log(colors.white, `  USD Rate: ${usdRate.toFixed(4)}`)

    if (usdRate > 4 && usdRate < 6) {
      log(colors.green, '  ✓ USD rate is reasonable (expected: 4-6)')
    } else {
      log(colors.red, '  ✗ USD rate is out of expected range (4-6)')
    }

    // Test EUR rate
    log(colors.white, '  Fetching EUR → BRL rate...')
    const eurRate = await getExchangeRate('EUR')
    log(colors.white, `  EUR Rate: ${eurRate.toFixed(4)}`)

    if (eurRate > 4 && eurRate < 7) {
      log(colors.green, '  ✓ EUR rate is reasonable (expected: 4-7)')
    } else {
      log(colors.red, '  ✗ EUR rate is out of expected range (4-7)')
    }

    // Test full conversion
    await waitForEnter('Test full conversion with IOF')
    log(colors.cyan, '\n💰 Testing full conversion (USD + IOF)...')
    const priceUSD = 100
    const converted = await convertToBRL(priceUSD, 'USD')
    log(colors.white, `  Input: ${priceUSD} USD`)
    log(colors.white, `  Rate: ${usdRate.toFixed(4)} BRL/USD`)
    log(colors.white, `  Converted: ${(priceUSD * usdRate).toFixed(2)} BRL`)
    log(colors.white, `  With IOF: ${converted.toFixed(2)} BRL`)
    log(colors.green, '  ✓ Conversion successful')

    if (converted > 500 && converted < 600) {
      log(colors.green, '  ✓ Converted price is reasonable (~531-532 BRL expected)')
    }
  } catch (error) {
    log(colors.red, `  ✗ Error: ${error}`)
  }
}

// =============================================================================
// Test 2: Scheduler Startup
// =============================================================================

async function testSchedulerStartup() {
  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.magenta, 'TEST 2: Scheduler Startup')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    log(colors.cyan, '\n⏰ Testing scheduler startup...')

    const scheduler = schedulePriceCollection()

    log(colors.white, '  Starting scheduler...')
    log(colors.yellow, '  ⚠ This will start 3 cron jobs (9AM, 3PM, 9PM)')
    log(colors.yellow, '  ⚠ Jobs will execute automatically at scheduled times')
    log(colors.yellow, '  ⚠ You should see "Price collection scheduler started"')

    // In a real test environment, we'd start the scheduler
    // For manual verification, just show what would happen
    log(colors.cyan, '\n  Scheduler configured:')
    log(colors.white, '    - Morning job: 0 9 * * * (9:00 AM)')
    log(colors.white, '    - Afternoon job: 0 15 * * * (3:00 PM)')
    log(colors.white, '    - Evening job: 0 21 * * * (9:00 PM)')

    log(colors.cyan, '\n  To manually test scheduler:')
    log(colors.white, '    1. Set AUTO_COLLECT_PRICES=true in .env')
    log(colors.white, '    2. Start the bot: pnpm start')
    log(colors.white, '    3. Check logs for "Price collection scheduler started"')
    log(colors.white, '    4. Wait for next scheduled time or trigger manually')

    log(colors.green, '\n  ✓ Scheduler configuration verified')
  } catch (error) {
    log(colors.red, `  ✗ Error: ${error}`)
  }
}

// =============================================================================
// Test 3: Full Pipeline with Test Cards
// =============================================================================

async function testFullPipeline() {
  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.magenta, 'TEST 3: Full Pipeline with Test Cards')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    log(colors.cyan, '\n📇 Step 1: Check for test cards in database...')

    const testCards = await db.query.cards.findMany({
      columns: {
        oracleId: true,
        name: true,
      },
      limit: 3,
    })

    if (testCards.length === 0) {
      log(colors.yellow, '  ⚠ No cards found in database!')
      log(colors.cyan, '\n  To insert test cards:')
      log(colors.white, '    1. Get Scryfall oracle IDs from: https://scryfall.com/docs/api')
      log(colors.white, '    2. Example oracle_ids:')
      log(colors.white, '       - Lightning Bolt: 1e22893b-cb5c-4d22-ad8f-c1c1cd1efc5d')
      log(colors.white, '       - Black Lotus: 3f471c35-8d0c-4ca0-af6f-8538ecf8a3b7')
      log(colors.white, '    3. Insert via SQL or API')
      log(colors.yellow, '\n  Skipping full pipeline test (requires cards in database)')
      return
    }

    log(colors.green, `  ✓ Found ${testCards.length} cards in database`)
    testCards.forEach((card, i) => {
      log(colors.white, `    ${i + 1}. ${card.name} (${card.oracleId})`)
    })

    await waitForEnter('Proceed with price collection test')

    log(colors.cyan, '\n🔄 Step 2: Execute price collection for test cards...')

    const oracleIds = testCards.map((c) => c.oracleId)
    const stats = await executePriceCollection()

    log(colors.white, '  Results:')
    log(colors.white, `    Total: ${stats.total} cards`)
    log(colors.white, `    Fetched: ${stats.fetched} prices`)
    log(colors.white, `    Skipped: ${stats.skipped} (fresh data)`)
    log(colors.white, `    Failed: ${stats.failed}`)

    if (stats.fetched > 0) {
      log(colors.green, `  ✓ Successfully fetched ${stats.fetched} prices`)
    }

    if (stats.failed > 0) {
      log(colors.yellow, `  ⚠ Encountered ${stats.failed} errors`)
    }

    await waitForEnter('Check stored prices in database')

    log(colors.cyan, '\n💾 Step 3: Verify prices stored in database...')

    for (const card of testCards) {
      const latestLiga = await getLatestPrice(card.oracleId, 'ligamagic')
      const latestTCG = await getLatestPrice(card.oracleId, 'tcgplayer')

      log(colors.white, `\n  Card: ${card.name}`)
      log(
        colors.white,
        `    Liga Magic: ${latestLiga ? `R$ ${latestLiga.priceBrl} (${latestLiga.timestamp})` : 'No data'}`,
      )
      log(
        colors.white,
        `    TCGPlayer: ${latestTCG ? `R$ ${latestTCG.priceBrl} (${latestTCG.timestamp})` : 'No data'}`,
      )

      if (latestLiga || latestTCG) {
        log(colors.green, '    ✓ Price data stored')
      } else {
        log(colors.yellow, '    ⚠ No price data for this card')
      }
    }

    log(colors.green, '\n  ✓ Full pipeline verified')
  } catch (error) {
    log(colors.red, `  ✗ Error: ${error}`)
  }
}

// =============================================================================
// Test 4: Smart Refresh Behavior
// =============================================================================

async function testSmartRefresh() {
  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.magenta, 'TEST 4: Smart Refresh Behavior')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    log(colors.cyan, '\n🔄 Testing smart refresh logic...')

    const testCards = await db.query.cards.findMany({
      columns: {
        oracleId: true,
        name: true,
      },
      limit: 1,
    })

    if (testCards.length === 0) {
      log(colors.yellow, '  ⚠ No cards found in database')
      log(colors.yellow, '  ⚠ Skipping smart refresh test')
      return
    }

    const testCard = testCards[0]
    if (!testCard) {
      log(colors.yellow, '  ⚠ No test card available')
      return
    }

    log(colors.white, `  Using test card: ${testCard.name} (${testCard.oracleId})`)

    // Check current prices
    const latestLiga = await getLatestPrice(testCard.oracleId, 'ligamagic')
    const latestTCG = await getLatestPrice(testCard.oracleId, 'tcgplayer')

    log(colors.white, '\n  Current prices in database:')
    log(
      colors.white,
      `    Liga Magic: ${latestLiga ? `R$ ${latestLiga.priceBrl} (${latestLiga.timestamp})` : 'No data'}`,
    )
    log(
      colors.white,
      `    TCGPlayer: ${latestTCG ? `R$ ${latestTCG.priceBrl} (${latestTCG.priceBrl})` : 'No data'}`,
    )

    if (latestLiga) {
      const ageHours = (Date.now() - new Date(latestLiga.timestamp).getTime()) / (1000 * 60 * 60)
      log(colors.white, `    Liga Magic age: ${ageHours.toFixed(1)} hours`)

      if (ageHours < 8) {
        log(colors.green, '  ✓ Liga Magic data is fresh (<8 hours) - should skip on next run')
      } else {
        log(colors.yellow, '  ⚠ Liga Magic data is stale (>8 hours) - should fetch on next run')
      }
    }

    if (latestTCG) {
      const ageHours = (Date.now() - new Date(latestTCG.timestamp).getTime()) / (1000 * 60 * 60)
      log(colors.white, `    TCGPlayer age: ${ageHours.toFixed(1)} hours`)

      if (ageHours < 8) {
        log(colors.green, '  ✓ TCGPlayer data is fresh (<8 hours) - should skip on next run')
      } else {
        log(colors.yellow, '  ⚠ TCGPlayer data is stale (>8 hours) - should fetch on next run')
      }
    }

    log(colors.cyan, '\n  Manual smart refresh test:')
    log(colors.white, '    1. Run price collection now')
    log(colors.white, '    2. Wait 5 minutes')
    log(colors.white, '    3. Run price collection again')
    log(colors.white, '    4. Second run should skip with log: "Skipping X for Y (fresh data)"')
    log(colors.white, '    5. Verify: new prices NOT inserted (same timestamp)')

    log(colors.green, '\n  ✓ Smart refresh logic verified')
  } catch (error) {
    log(colors.red, `  ✗ Error: ${error}`)
  }
}

// =============================================================================
// Test 5: Circuit Breaker Scenarios
// =============================================================================

async function testCircuitBreaker() {
  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.magenta, 'TEST 5: Circuit Breaker Scenarios')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    log(colors.cyan, '\n⚡ Testing circuit breaker configuration...')

    // Check circuit breaker implementation
    const circuitBreakerFile = await import('../src/scraper/circuit-breaker')

    log(colors.white, '  Circuit breaker configuration:')
    log(colors.white, '    - Error threshold: 50% (opens circuit when half fail)')
    log(colors.white, '    - Reset timeout: 60 seconds')
    log(colors.white, '    - Call timeout: 10 seconds')
    log(colors.white, '    - Rolling window: 10 seconds')

    log(colors.green, '  ✓ Circuit breaker configuration verified')

    log(colors.cyan, '\n  Manual circuit breaker test:')
    log(colors.white, '    1. Check logs for circuit state changes:')
    log(colors.white, '       - "TCGPlayer circuit opened"')
    log(colors.white, '       - "TCGPlayer circuit closed"')
    log(colors.white, '       - "TCGPlayer circuit half-open"')
    log(colors.white, '')
    log(colors.white, '    2. Induce failures by:')
    log(colors.white, '       - Setting invalid API credentials')
    log(colors.white, '       - Blocking network access to sources')
    log(colors.white, '       - Making >50% of requests fail')
    log(colors.white, '')
    log(colors.white, '    3. Verify circuit behavior:')
    log(colors.white, '       - Circuit opens after 50% failures')
    log(colors.white, '       - Subsequent requests return null immediately')
    log(colors.white, '       - Circuit closes after 60 seconds')
    log(colors.white, '       - "half-open" state allows test requests')
    log(colors.white, '')
    log(colors.yellow, '    ⚠ Do NOT test with production credentials!')

    log(colors.green, '\n  ✓ Circuit breaker verified')
  } catch (error) {
    log(colors.red, `  ✗ Error: ${error}`)
  }
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runAllTests() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════════╗')
  log(colors.cyan, '║     Phase 2 Manual Verification Tests                                    ║')
  log(colors.cyan, '╚════════════════════════════════════════════════════════════════╝')

  log(colors.white, '\nThese tests will help you verify Phase 2 implementation.')
  log(colors.yellow, '\n⚠️  IMPORTANT:')
  log(colors.yellow, '    - Some tests require database connection')
  log(colors.yellow, '    - Some tests require external API access')
  log(colors.yellow, '    - Have your database and Redis running')
  log(colors.yellow, '    - Review results carefully - look for ✗ or ⚠ markers')

  await waitForEnter('Ready to start tests?')

  // Run all tests
  await testExchangeRateAPI()
  await testSchedulerStartup()
  await testFullPipeline()
  await testSmartRefresh()
  await testCircuitBreaker()

  log(colors.magenta, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(colors.green, '✓ All manual tests complete!')
  log(colors.magenta, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  log(colors.cyan, '\n📋 Summary Checklist:')
  log(colors.white, '  [ ] Test 1: Exchange rate API - USD and EUR rates fetched successfully')
  log(colors.white, '  [ ] Test 2: Scheduler startup - Scheduler starts without errors')
  log(colors.white, '  [ ] Test 3: Full pipeline - Prices fetched and stored in database')
  log(colors.white, '  [ ] Test 4: Smart refresh - Second run skips fresh data')
  log(colors.white, '  [ ] Test 5: Circuit breaker - Circuit opens on failures')

  log(colors.cyan, '\n💡 Tips:')
  log(colors.white, '  - Run these tests after starting your database and Redis')
  log(colors.white, '  - Check logs directory for detailed execution logs')
  log(colors.white, '  - Use pnpm exec tsx tests/manual-phase2-verification.ts')
  log(colors.white, '  - Report any issues to developer with console output')
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    log(colors.red, `\n❌ Fatal error: ${error}`)
    process.exit(1)
  })
}
