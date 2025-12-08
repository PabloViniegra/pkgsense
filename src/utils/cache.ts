import { LRUCache } from 'lru-cache';

/**
 * Generic cache implementation using LRU (Least Recently Used) eviction policy.
 *
 * Features:
 * - TTL-based expiration
 * - Size limits to prevent memory leaks
 * - Type-safe with generics
 *
 * @template T The type of values stored in the cache
 *
 * @example
 * ```typescript
 * const cache = new Cache<PackageInfo>({ ttl: 3600000, max: 100 });
 * cache.set('react@18.0.0', packageInfo);
 * const info = cache.get('react@18.0.0');
 * ```
 */
export class Cache<T> {
	private cache: LRUCache<string, T>;

	/**
	 * Creates a new Cache instance.
	 *
	 * @param options Configuration options
	 * @param options.ttl Time-to-live in milliseconds (default: 1 hour)
	 * @param options.max Maximum number of entries (default: 100)
	 */
	constructor(options: { ttl?: number; max?: number } = {}) {
		this.cache = new LRUCache<string, T>({
			ttl: options.ttl ?? 3600000, // 1 hour default
			max: options.max ?? 100,
			updateAgeOnGet: true, // Refresh TTL on access
		});
	}

	/**
	 * Retrieves a value from the cache.
	 *
	 * @param key The cache key
	 * @returns The cached value or undefined if not found/expired
	 */
	get(key: string): T | undefined {
		return this.cache.get(key);
	}

	/**
	 * Stores a value in the cache.
	 *
	 * @param key The cache key
	 * @param value The value to store
	 */
	set(key: string, value: T): void {
		this.cache.set(key, value);
	}

	/**
	 * Checks if a key exists in the cache (and is not expired).
	 *
	 * @param key The cache key
	 * @returns True if the key exists and is valid
	 */
	has(key: string): boolean {
		return this.cache.has(key);
	}

	/**
	 * Removes a specific entry from the cache.
	 *
	 * @param key The cache key to remove
	 */
	delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Clears all entries from the cache.
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Gets the number of entries in the cache.
	 *
	 * @returns The current size of the cache
	 */
	size(): number {
		return this.cache.size;
	}
}

/**
 * Global cache instance for NPM registry data.
 * Shared across all analyzers to maximize cache hits.
 */
export const npmRegistryCache = new Cache<unknown>({
	ttl: 3600000, // 1 hour
	max: 200, // Support up to 200 unique packages
});
