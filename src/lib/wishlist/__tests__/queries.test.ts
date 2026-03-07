import { addCardToWishlist, removeCardFromWishlist } from '@/lib/wishlist/queries'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the database
vi.mock('@/db', () => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
  },
}))

import { db } from '@/db'

describe('removeCardFromWishlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should remove card from wishlist successfully', async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: 1, userId: 1, cardId: 'test-oracle-123' }])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    vi.mocked(db.delete).mockReturnValue(mockDelete() as never)

    await expect(removeCardFromWishlist(1, 'test-oracle-123')).resolves.not.toThrow()

    expect(db.delete).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
    expect(mockReturning).toHaveBeenCalled()
  })

  it('should throw error when card not in wishlist (empty array)', async () => {
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    vi.mocked(db.delete).mockReturnValue(mockDelete() as never)

    await expect(removeCardFromWishlist(1, 'test-oracle-123')).rejects.toThrow('Card not in wishlist')
  })

  it('should throw error when card not in wishlist (null result)', async () => {
    const mockReturning = vi.fn().mockResolvedValue(null)
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    vi.mocked(db.delete).mockReturnValue(mockDelete() as never)

    await expect(removeCardFromWishlist(1, 'test-oracle-123')).rejects.toThrow('Card not in wishlist')
  })
})

describe('addCardToWishlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should add card to wishlist successfully', async () => {
    const mockValues = vi.fn().mockResolvedValue(undefined)
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.insert).mockReturnValue(mockInsert() as never)

    await expect(addCardToWishlist(1, 'test-oracle-123')).resolves.not.toThrow()

    expect(db.insert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalled()
  })

  it('should throw error on duplicate card (PostgreSQL unique violation)', async () => {
    const error = new Error('duplicate key value violates unique constraint')
    ;(error as { code?: string }).code = '23505'

    const mockValues = vi.fn().mockRejectedValue(error)
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.insert).mockReturnValue(mockInsert() as never)

    await expect(addCardToWishlist(1, 'test-oracle-123')).rejects.toThrow('Card already in wishlist')
  })
})
