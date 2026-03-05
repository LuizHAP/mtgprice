/**
 * Manual mock for Redis module
 */

import { MockRedis } from '@/../test/mocks/redis'

let mockInstance: MockRedis | null = null

function getClient() {
  if (!mockInstance) {
    mockInstance = new MockRedis()
  }
  return mockInstance
}

async function closeClient() {
  if (mockInstance) {
    await mockInstance.quit()
    mockInstance = null
  }
}

export { getClient, closeClient }
export { MockRedis }
