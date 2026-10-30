import NodeCache from 'node-cache';

// Enhanced in-memory cache wrapper supporting stampede protection via pending promise de-duplication
export class MemoryCacheService {
  private readonly cache: NodeCache;
  private readonly pendingPromises = new Map<string, Promise<unknown>>();

  constructor(defaultTtlSeconds = 30, checkPeriodSeconds = 60) {
    this.cache = new NodeCache({
      stdTTL: defaultTtlSeconds,
      checkperiod: checkPeriodSeconds,
    });
  }

  // Retrieve cached value by key
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  // Check whether a specific key exists in cache
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // Store a value with optional custom TTL
  set<T>(key: string, value: T, ttlSeconds?: number): boolean {
    return ttlSeconds !== undefined ? this.cache.set(key, value, ttlSeconds) : this.cache.set(key, value);
  }

  // Delete one or multiple keys from cache
  del(key: string | string[]): number {
    return this.cache.del(key);
  }

  // Flush entire in-memory cache
  flush(): void {
    this.cache.flushAll();
    this.pendingPromises.clear();
  }

  // Retrieve cached value or execute factory function with cache stampede mitigation
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Reuse existing in-flight promise to prevent stampeding backend data sources
    const inFlight = this.pendingPromises.get(key) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }

    const executionPromise = (async () => {
      try {
        const result = await fetchFn();
        this.set(key, result, ttlSeconds);
        return result;
      } finally {
        this.pendingPromises.delete(key);
      }
    })();

    this.pendingPromises.set(key, executionPromise);
    return executionPromise;
  }
}

export const memoryCache = new MemoryCacheService();
