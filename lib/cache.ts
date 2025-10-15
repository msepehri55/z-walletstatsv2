import { LRUCache } from "lru-cache";

export const ttl = (ms: number) => ({
  ttl: ms,
  allowStale: true,
  updateAgeOnGet: true
});

export const memoryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5,
  allowStale: true,
  updateAgeOnGet: true,
  ttlAutopurge: true
});

export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyPrefix: string,
  ttlMs = 60_000
): T {
  return (async (...args: any[]) => {
    const key = keyPrefix + ":" + JSON.stringify(args);
    const cached = memoryCache.get(key);
    if (cached !== undefined) return cached as any;
    const val = await fn(...(args as any));
    memoryCache.set(key, val, { ttl: ttlMs });
    return val;
  }) as T;
}