export class DBCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  /**
   * Store data in the cache with a specified TTL (in milliseconds).
   * Default TTL is 5 minutes (300,000 ms).
   */
  set(key: string, data: any, ttlMs: number = 300000): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  /**
   * Retrieve cached data. Returns null if key doesn't exist or is expired.
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  /**
   * Delete a specific cache key.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache keys that start with a given prefix.
   * Extremely useful for resource group invalidation (e.g., clearing "po:" keys).
   */
  clearPattern(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Complete reset of the cache.
   */
  clearAll(): void {
    this.cache.clear();
  }
}

export const dbCache = new DBCache();
