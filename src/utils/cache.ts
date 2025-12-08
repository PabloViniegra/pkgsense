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

interface CacheEntry<T> {
	value: T;
	expiry: number;
}

export class Cache<T = unknown> {
	private cache: Map<string, CacheEntry<T>>;
	private readonly ttl: number;
	private readonly max: number;

	/**
	 * Creates a new Cache instance.
	 *
	 * @param options Configuration options
	 * @param options.ttl Time-to-live in milliseconds (default: 1 hour)
	 * @param options.max Maximum number of entries (default: 100)
	 */
	constructor(options: { ttl?: number; max?: number } = {}) {
		this.cache = new Map();
		this.ttl = options.ttl ?? 3600000; // 1 hour default
		this.max = options.max ?? 100;
	}

	/**
	 * Retrieves a value from the cache.
	 *
	 * @param key The cache key
	 * @returns The cached value or undefined if not found/expired
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check if expired
		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			return undefined;
		}

		return entry.value;
	}

	/**
	 * Stores a value in the cache.
	 *
	 * @param key The cache key
	 * @param value The value to store
	 */
	set(key: string, value: T): void {
		// Enforce max size using LRU eviction
		if (this.cache.size >= this.max && !this.cache.has(key)) {
			// Remove oldest entry (first key)
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}

		const expiry = Date.now() + this.ttl;
		this.cache.set(key, { value, expiry });
	}

	/**
	 * Checks if a key exists in the cache (and is not expired).
	 *
	 * @param key The cache key
	 * @returns True if the key exists and is valid
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);

		if (!entry) {
			return false;
		}

		// Check if expired
		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			return false;
		}

		return true;
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
