#!/bin/bash
# Phase 2 Manual Verification Script
# Run this to verify Phase 2 implementation

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Phase 2: Core Data Collection - Manual Verification               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "📋 Prerequisites Check:"
echo ""

# Check if node modules exist
if [ ! -d "node_modules" ]; then
    echo "  ✗ Node modules not found. Run: pnpm install"
    exit 1
fi
echo "  ✓ Node modules installed"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "  ✗ .env file not found. Create from .env.example:"
    echo "      cp .env.example .env"
    echo "      # Then edit .env with your values"
    exit 1
fi
echo "  ✓ .env file exists"
echo ""

# Check if database is running (try to connect)
echo "🔗 Database Connection:"
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        echo "  ✓ Database is running"
    else
        echo "  ⚠ Database not responding. Start with: docker-compose up -d"
    fi
else
    echo "  ⚠ psql not found. Verify database is running."
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Currency Conversion (Brazilian Central Bank API)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Testing IOF calculation..."
node -e "
const { IOF_RATE } = require('./dist/lib/currency.js');
const testAmount = 100;
const withIOF = testAmount * (1 + IOF_RATE);
console.log('  IOF Rate:', (IOF_RATE * 100) + '%');
console.log('  Input:', testAmount);
console.log('  Expected:', withIOF.toFixed(2));
console.log('  ✓ IOF: 6.38% of 100 = ' + withIOF.toFixed(2));
"

echo ""
echo "To test live API exchange rates, run:"
echo "  node -e \"require('./dist/lib/currency.js').getExchangeRate('USD').then(r => console.log('USD Rate:', r))\""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Scheduler Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Check scheduler configuration:"
echo "  grep -r 'cron.schedule' src/scheduler/"
echo ""
echo "To start the scheduler with the bot:"
echo "  1. Set AUTO_COLLECT_PRICES=true in .env"
echo "  2. Start bot: pnpm start"
echo "  3. Look for log: 'Price collection scheduler started'"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Full Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Check if cards exist in database:"
echo "  psql \"\$DATABASE_URL\" -c \"SELECT oracle_id, name FROM cards LIMIT 5;\""
echo ""
echo "If no cards exist, insert test cards:"
echo "  -- Get oracle_ids from https://scryfall.com/docs/api"
echo "  -- Example: Lightning Bolt = 1e22893b-cb5c-4d22-ad8f-c1c1cd1efc5d"
echo "  psql \"\$DATABASE_URL\" -c \"INSERT INTO cards (oracle_id, name, set, rarity) VALUES ('1e22893b-cb5c4d22ad8fc1c1cd1efc5d', 'Lightning Bolt', '2XN', 'Common') ON CONFLICT DO NOTHING;\""
echo ""
echo "To trigger manual price collection:"
echo "  node -e \"require('./dist/scheduler/jobs.js').executePriceCollection().then(s => console.log('Stats:', s))\""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Smart Refresh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Check price timestamps:"
echo "  psql \"\$DATABASE_URL\" -c \"SELECT source, card_id, price_brl, timestamp FROM prices ORDER BY timestamp DESC LIMIT 10;\""
echo ""
echo "Smart refresh test:"
echo "  1. Note the timestamps above"
echo "  2. Run price collection now"
echo "  3. Wait 5 minutes"
echo "  4. Run price collection again"
echo "  5. Check for log: 'Skipping X for Y (fresh data)'"
echo "  6. Verify: new prices NOT inserted (same timestamp)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Circuit Breaker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Check circuit breaker logs:"
echo "  grep -r 'circuit' logs/ | tail -20"
echo ""
echo "Circuit breaker configuration:"
echo "  grep -A 5 'DEFAULT_CIRCUIT_BREAKER_CONFIG' src/scraper/circuit-breaker.ts"
echo ""
echo "To test circuit breaker:"
echo "  1. Set invalid API credentials in .env:"
echo "     TCGPLAYER_BEARER_TOKEN=invalid"
echo "  2. Run price collection multiple times (>50% failures)"
echo "  3. Check logs for: 'TCGPlayer circuit opened'"
echo "  4. Verify: subsequent requests return null immediately"
echo "  5. Wait 60 seconds, check for: 'TCGPlayer circuit closed'"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Verification Script Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "For TypeScript automated tests, run:"
echo "  pnpm exec tsx tests/manual-phase2-verification.ts"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "💡 Quick Tips:"
echo "  - Build first: pnpm build"
echo "  - Check logs: tail -f logs/combined.log"
echo "  - Database URL: psql \"\$DATABASE_URL\""
echo "  - Redis: redis-cli PING"
echo "═══════════════════════════════════════════════════════════════════"
