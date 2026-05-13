import { cards } from '@/db/schema'
import { searchCards } from '@/lib/cards/queries'
import { seedTestCard, truncateTable } from '@/test/helpers/db'
import { beforeEach, describe, expect, test } from 'vitest'

describe('Card Search API endpoint', () => {
  beforeEach(async () => {
    await truncateTable(cards)
  })

  test('GET /api/cards/search returns matching cards by name', async () => {
    await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-001' })
    await seedTestCard({ name: 'Black Lotus (Arena)', oracleId: 'test-bl-002' })
    await seedTestCard({ name: 'Lotus Petal', oracleId: 'test-lp-001' })

    const results = await searchCards('Black Lotus')

    expect(results.some((c) => c.name === 'Black Lotus')).toBe(true)
    expect(results.some((c) => c.name === 'Black Lotus (Arena)')).toBe(true)
    expect(results.some((c) => c.name === 'Lotus Petal')).toBe(false)
  })

  test('GET /api/cards/search returns empty array if no matches', async () => {
    const results = await searchCards('NonExistentXYZ123')
    expect(results).toEqual([])
  })

  test('GET /api/cards/search is case-insensitive', async () => {
    await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-ci-001' })

    const lowerResults = await searchCards('black lotus')
    const upperResults = await searchCards('BLACK LOTUS')

    expect(lowerResults.some((c) => c.name === 'Black Lotus')).toBe(true)
    expect(upperResults.some((c) => c.name === 'Black Lotus')).toBe(true)
  })

  test('GET /api/cards/search limits results to 10 cards', async () => {
    for (let i = 0; i < 15; i++) {
      await seedTestCard({ name: `Test Card ${i}`, oracleId: `test-limit-${i}` })
    }
    const results = await searchCards('Test Card')
    expect(results.length).toBeLessThanOrEqual(10)
  })

  test('GET /api/cards/search requires at least 2 characters', async () => {
    await expect(searchCards('A')).rejects.toThrow('Query must be at least 2 characters long')
  })
})
