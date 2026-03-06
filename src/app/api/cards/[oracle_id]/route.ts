import { db } from '@/db'
import { cards } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cards/[oracle_id]
 *
 * Get full card metadata by oracle_id.
 * Returns 404 if card not found.
 *
 * Public endpoint - no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> }
) {
  try {
    const { oracle_id } = await params

    // Query card by oracle_id
    const result = await db
      .select()
      .from(cards)
      .where(eq(cards.oracleId, oracle_id))
      .limit(1)

    // Check if card exists
    if (result.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Return card details
    return NextResponse.json({ card: result[0] }, { status: 200 })
  } catch (error) {
    console.error('Error fetching card details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch card details' },
      { status: 500 }
    )
  }
}
