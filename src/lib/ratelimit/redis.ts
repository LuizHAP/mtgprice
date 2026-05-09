/**
 * Redis client singleton
 *
 * Resolves to either:
 * - A Redis.Cluster instance when REDIS_CLUSTER_NODES is set (D-07, D-08)
 * - A single-node Redis instance using REDIS_URL otherwise (D-09 — preserves existing behaviour)
 */

import Redis, { type Cluster } from 'ioredis'

type RedisLike = Redis | Cluster

let client: RedisLike | null = null

/**
 * Parse REDIS_CLUSTER_NODES env var into an array of {host, port} startup nodes.
 * Format: comma-separated `host:port` pairs (e.g. "redis-1:6379,redis-2:6379").
 */
function parseClusterNodes(nodesEnv: string): { host: string; port: number }[] {
  return nodesEnv
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [host, portStr] = entry.split(':')
      const port = Number(portStr)
      if (!host || !Number.isFinite(port)) {
        throw new Error(`Invalid REDIS_CLUSTER_NODES entry "${entry}" — expected host:port`)
      }
      return { host, port }
    })
}

export function getClient(): RedisLike {
  if (!client) {
    const clusterNodes = process.env.REDIS_CLUSTER_NODES
    if (clusterNodes) {
      const nodes = parseClusterNodes(clusterNodes)
      client = new Redis.Cluster(nodes)
    } else {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is not set')
      }
      client = new Redis(redisUrl)
    }
  }
  return client
}

export async function closeClient(): Promise<void> {
  if (client) {
    await client.quit()
    client = null
  }
}
