type Task = () => Promise<void>;

/**
 * Runs at most one task per key at a time. A task requested while another
 * runs for the same key waits for it; if several are requested meanwhile,
 * only the most recent runs, since it supersedes the others.
 */
export class SerialRunner {
	private readonly pending = new Map<string, Task>();
	private readonly running = new Map<string, Promise<void>>();

	/** Resolves once the queue for the key is empty again. */
	run(key: string, task: Task): Promise<void> {
		this.pending.set(key, task);

		const active = this.running.get(key);
		if (active) {
			return active;
		}

		const drained = this.drain(key);
		this.running.set(key, drained);
		return drained;
	}

	private async drain(key: string): Promise<void> {
		for (let task = this.take(key); task; task = this.take(key)) {
			try {
				await task();
			} catch (error) {
				console.error(`Task for ${key} failed:`, error);
			}
		}
		// Synchronous with the last empty take(), so a run() cannot slip in
		// between and attach itself to a queue that has already finished
		this.running.delete(key);
	}

	private take(key: string): Task | undefined {
		const task = this.pending.get(key);
		this.pending.delete(key);
		return task;
	}
}

/**
 * Delays a callback per key until calls stop arriving for `delayMs`.
 */
export class Debouncer {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(private readonly delayMs: number) {}

	schedule(key: string, callback: () => void): void {
		this.cancel(key);
		this.timers.set(
			key,
			setTimeout(() => {
				this.timers.delete(key);
				callback();
			}, this.delayMs),
		);
	}

	cancel(key: string): void {
		clearTimeout(this.timers.get(key));
		this.timers.delete(key);
	}

	dispose(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
	}
}
