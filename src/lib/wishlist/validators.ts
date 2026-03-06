/**
 * Wishlist validation schemas
 *
 * Zod validation schemas for wishlist API inputs.
 */

import { z } from 'zod'

/**
 * Schema for adding a card to wishlist
 * Validates that cardId is a non-empty string
 */
export const addCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
})

/**
 * Schema for removing a card from wishlist
 * Validates that cardId is a non-empty string
 */
export const removeCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
})

/**
 * Validate add card input
 *
 * @param input - Unknown input to validate
 * @returns Parsed and validated input
 * @throws ZodError if validation fails
 *
 * @example
 * ```ts
 * try {
 *   const data = validateAddCard({ cardId: 'abc123' })
 *   // data.cardId is available
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function validateAddCard(input: unknown) {
  return addCardSchema.parse(input)
}

/**
 * Validate remove card input
 *
 * @param input - Unknown input to validate
 * @returns Parsed and validated input
 * @throws ZodError if validation fails
 *
 * @example
 * ```ts
 * try {
 *   const data = validateRemoveCard({ cardId: 'abc123' })
 *   // data.cardId is available
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function validateRemoveCard(input: unknown) {
  return removeCardSchema.parse(input)
}
