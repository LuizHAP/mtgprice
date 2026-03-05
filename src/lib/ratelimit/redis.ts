/**
 * Redis client singleton
 *
 * Placeholder for RED phase of TDD - this file will be implemented in Task 2
 */

import Redis from 'ioredis'

let client: Redis | null = null

export function getClient(): Redis {
  if (!client) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set')
    }
    client = new Redis(redisUrl)
  }
  return client
}

export async function closeClient(): Promise<void> {
  if (client) {
    await client.quit()
    client = null
  }
}
