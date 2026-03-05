/**
 * Redis mock for testing rate limiter
 *
 * Mocks ioredis client behavior for rate limiter tests
 * Simulates Lua script execution for atomic token bucket operations
 */

interface RedisHash {
  [key: string]: string
}

interface RedisData {
  hashes: Map<string, RedisHash>
  expirations: Map<string, number>
  evalHistory: Array<{
    script: string
    keys: string[]
    args: (string | number)[]
  }>
}

class MockRedis {
  private data: RedisData = {
    hashes: new Map(),
    expirations: new Map(),
    evalHistory: [],
  }

  private currentTime = 0

  /**
   * Mock HMGET command
   */
  hmget = async (key: string, ...fields: string[]): Promise<(string | null)[]> => {
    const hash = this.data.hashes.get(key) || {}
    return fields.map((field) => hash[field] || null)
  }

  /**
   * Mock HMSET command
   */
  hmset = async (key: string, fieldValues: [string, string | number][]): Promise<'OK'> => {
    const hash = this.data.hashes.get(key) || {}
    for (const [field, value] of fieldValues) {
      hash[field] = String(value)
    }
    this.data.hashes.set(key, hash)
    return 'OK'
  }

  /**
   * Mock EXPIRE command
   */
  expire = async (key: string, seconds: number): Promise<number> => {
    this.data.expirations.set(key, Date.now() + seconds * 1000)
    return 1
  }

  /**
   * Mock TIME command (returns seconds and microseconds)
   */
  time = async (): Promise<[number, number]> => {
    const now = this.currentTime || Date.now() / 1000
    const microseconds = (now % 1) * 1_000_000
    return [Math.floor(now), Math.floor(microseconds)]
  }

  /**
   * Mock EVAL command (executes Lua scripts)
   *
   * For rate limiter, the Lua script:
   * 1. Gets current tokens and last refill time
   * 2. Refills tokens if interval has elapsed
   * 3. Checks if enough tokens available
   * 4. Consumes tokens if available
   * 5. Returns [allowed: 0|1, remaining: number]
   */
  eval = async (script: string, numKeys: number, ...args: (string | number)[]): Promise<[number, number]> => {
    this.data.evalHistory.push({
      script,
      keys: args.slice(0, numKeys) as string[],
      args: args.slice(numKeys),
    })

    const key = args[0] as string
    const limit = Number(args[1])
    const interval = Number(args[2])
    const tokens = Number(args[3])

    // Get current time
    const now = this.currentTime || Date.now() / 1000

    // Get current bucket state
    const hash = this.data.hashes.get(key) || {}
    let currentTokens = Number(hash.tokens) || limit
    let lastRefill = Number(hash.last_refill) || now

    // Refill tokens based on time elapsed
    const elapsed = now - lastRefill
    if (elapsed >= interval) {
      currentTokens = limit
      lastRefill = now
    }

    // Check if enough tokens
    if (currentTokens >= tokens) {
      currentTokens -= tokens
      this.data.hashes.set(key, {
        tokens: String(currentTokens),
        last_refill: String(lastRefill),
      })
      this.data.expirations.set(key, Date.now() + interval * 1000)
      return [1, currentTokens] // allowed, remaining
    }

    return [0, currentTokens] // not allowed, remaining
  }

  /**
   * Mock Redis.call for use in Lua scripts
   */
  call = async (command: string, ...args: (string | number)[]): Promise<unknown> => {
    switch (command) {
      case 'HMGET': {
        const key = args[0] as string
        return this.hmget(key, ...(args.slice(1) as string[]))
      }
      case 'HMSET':
        return this.hmset(args[0] as string, args.slice(1) as unknown as [string, string | number][])
      case 'EXPIRE':
        return this.expire(args[0] as string, Number(args[1]))
      case 'TIME':
        return this.time()
      default:
        throw new Error(`Unknown Redis command: ${command}`)
    }
  }

  /**
   * Set mock time (for testing token refill)
   */
  setMockTime = (timestamp: number): void => {
    this.currentTime = timestamp
  }

  /**
   * Advance mock time by seconds (for testing token refill)
   */
  advanceMockTime = (seconds: number): void => {
    this.currentTime += seconds
  }

  /**
   * Reset mock state
   */
  reset = (): void => {
    this.data = {
      hashes: new Map(),
      expirations: new Map(),
      evalHistory: [],
    }
    this.currentTime = 0
  }

  /**
   * Get eval history (for testing)
   */
  getEvalHistory = () => {
    return this.data.evalHistory
  }

  /**
   * Check if key exists
   */
  exists = async (key: string): Promise<number> => {
    return this.data.hashes.has(key) ? 1 : 0
  }

  /**
   * Get TTL of key
   */
  ttl = async (key: string): Promise<number> => {
    const expiration = this.data.expirations.get(key)
    if (!expiration) return -2 // key doesn't exist
    const ttl = Math.floor((expiration - Date.now()) / 1000)
    return ttl > 0 ? ttl : -1 // -1 means no expiration
  }

  /**
   * Delete key
   */
  del = async (key: string): Promise<number> => {
    const existed = this.data.hashes.has(key)
    this.data.hashes.delete(key)
    this.data.expirations.delete(key)
    return existed ? 1 : 0
  }

  /**
   * Flush all data
   */
  flushall = async (): Promise<'OK'> => {
    this.reset()
    return 'OK'
  }

  /**
   * Mock disconnect
   */
  disconnect = async (): Promise<void> => {
    // No-op for mock
  }

  /**
   * Mock quit
   */
  quit = async (): Promise<'OK'> => {
    return 'OK'
  }
}

export { MockRedis }
