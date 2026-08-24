import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache with TTL
const cache = new Map<string, CacheEntry<any>>();

export function useCache<T>(defaultTTL: number = 30000) {
  const get = useCallback((key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > defaultTTL) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }, [defaultTTL]);

  const set = useCallback((key: string, data: T) => {
    cache.set(key, { data, timestamp: Date.now() });
  }, []);

  const invalidate = useCallback((key: string) => {
    cache.delete(key);
  }, []);

  const invalidateAll = useCallback(() => {
    cache.clear();
  }, []);

  return { get, set, invalidate, invalidateAll };
}
