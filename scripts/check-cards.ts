import 'dotenv/config'
import { db } from '../src/db/index'
import { cards } from '../src/db/schema'

async function checkCards() {
  const allCards = await db.select().from(cards).limit(5)

  console.log('Cards in database:', allCards.length)

  if (allCards.length === 0) {
    console.log('❌ No cards found in database')
    console.log('   Need to seed card data from Phase 2')
  } else {
    console.log('✅ Found cards:')
    for (const card of allCards) {
      console.log(`   - ${card.name} (${card.oracleId})`)
    }
  }

  process.exit(0)
}

checkCards().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
