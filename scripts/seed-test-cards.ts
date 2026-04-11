import 'dotenv/config'
import { db } from '../src/db/index'
import { cards } from '../src/db/schema'

async function seedTestCards() {
  const testCards = [
    {
      oracleId: 'test-oracle-001',
      name: 'Black Lotus',
      set: 'LEA',
      rarity: 'rare',
      color: 'artifact',
      imageUrl: 'https://cards.scryfall.io/large/front/b/l/blc.jpg',
    },
    {
      oracleId: 'test-oracle-002',
      name: 'Thoughtseize',
      set: 'THR',
      rarity: 'mythic',
      color: 'black',
      imageUrl: 'https://cards.scryfall.io/large/front/t/h/thr.jpg',
    },
    {
      oracleId: 'test-oracle-003',
      name: 'Lightning Bolt',
      set: 'LEA',
      rarity: 'common',
      color: 'red',
      imageUrl: 'https://cards.scryfall.io/large/front/l/e/lea.jpg',
    },
  ]

  console.log('Seeding test cards...')

  for (const card of testCards) {
    try {
      await db.insert(cards).values(card).onConflictDoNothing()
      console.log(`✅ Inserted: ${card.name}`)
    } catch (error) {
      console.log(`⚠️  Skipped: ${card.name} (may already exist)`)
    }
  }

  console.log('\n✅ Test cards seeded successfully')
  process.exit(0)
}

seedTestCards().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
