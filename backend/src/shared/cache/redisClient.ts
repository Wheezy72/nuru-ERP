import Redis from 'ioredis';

let client: Redis | null = null;

/**
 * Returns a shared Redis client instance if REDIS_URL is configured.
 * If not configured, returns null and callers should skip caching.
 */
export const getRedisClient = (): Redis | null => {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!client) {
    client = new Redis(process.env.REDIS_URL);
  }

  return client;
};