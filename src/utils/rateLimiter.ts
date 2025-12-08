/**
 * Token bucket rate limiter implementation.
 *
 * Controls the rate of operations using a token bucket algorithm.
 * Allows bursts up to the bucket capacity while maintaining average rate.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ requestsPerMinute: 100 });
 * await limiter.acquire(); // Waits if no tokens available
 * // ... perform operation
 * ```
 */
export class RateLimiter {
	private tokens: number;
	private readonly capacity: number;
	private readonly refillRate: number; // tokens per millisecond
	private lastRefill: number;
	private queue: Array<() => void> = [];

	/**
	 * Creates a new RateLimiter instance.
	 *
	 * @param options Configuration options
	 * @param options.requestsPerMinute Maximum requests allowed per minute
	 */
	constructor(options: { requestsPerMinute: number }) {
		this.capacity = options.requestsPerMinute;
		this.tokens = this.capacity;
		this.refillRate = options.requestsPerMinute / 60000; // tokens per ms
		this.lastRefill = Date.now();
	}

	/**
	 * Refills tokens based on elapsed time since last refill.
	 * Implements continuous token generation.
	 */
	private refill(): void {
		const now = Date.now();
		const elapsedMs = now - this.lastRefill;
		const tokensToAdd = elapsedMs * this.refillRate;

		this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
		this.lastRefill = now;
	}

	/**
	 * Processes the queue of waiting requests.
	 * Resolves promises for requests that can now proceed.
	 */
	private processQueue(): void {
		while (this.queue.length > 0 && this.tokens >= 1) {
			this.tokens -= 1;
			const resolve = this.queue.shift();
			if (resolve) {
				resolve();
			}
		}
	}

	/**
	 * Acquires a token to proceed with an operation.
	 * Waits if no tokens are available.
	 *
	 * @returns A promise that resolves when a token is acquired
	 */
	async acquire(): Promise<void> {
		this.refill();

		if (this.tokens >= 1) {
			this.tokens -= 1;
			return Promise.resolve();
		}

		// No tokens available, queue the request
		return new Promise<void>((resolve) => {
			this.queue.push(resolve);

			// Set up a timer to periodically check for tokens
			const intervalId = setInterval(() => {
				this.refill();
				this.processQueue();

				// Clear interval if this promise was resolved
				if (!this.queue.includes(resolve)) {
					clearInterval(intervalId);
				}
			}, 100); // Check every 100ms
		});
	}

	/**
	 * Gets the current number of available tokens.
	 *
	 * @returns The number of tokens currently available
	 */
	availableTokens(): number {
		this.refill();
		return Math.floor(this.tokens);
	}

	/**
	 * Resets the rate limiter to its initial state.
	 */
	reset(): void {
		this.tokens = this.capacity;
		this.lastRefill = Date.now();
		this.queue = [];
	}
}

/**
 * Global rate limiter for NPM registry requests.
 * Limits to 100 requests per minute to avoid hitting rate limits.
 */
export const npmRegistryRateLimiter = new RateLimiter({
	requestsPerMinute: 100,
});
