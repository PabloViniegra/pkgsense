import * as assert from 'node:assert';
import { suite, teardown, test } from 'mocha';
import * as sinon from 'sinon';
import { Debouncer, SerialRunner } from '../../utils/scheduling';

/** A task that only finishes when the test says so. */
function gate() {
	let open = () => {};
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { opened, open };
}

suite('Scheduling Test Suite', () => {
	suite('SerialRunner', () => {
		test('never runs two tasks for the same key at once', async () => {
			const runner = new SerialRunner();
			const first = gate();
			let running = 0;
			let maxRunning = 0;
			const task = (wait: Promise<void>) => async () => {
				running += 1;
				maxRunning = Math.max(maxRunning, running);
				await wait;
				running -= 1;
			};

			const done = Promise.all([
				runner.run('a', task(first.opened)),
				runner.run('a', task(Promise.resolve())),
			]);
			first.open();
			await done;

			assert.strictEqual(maxRunning, 1);
		});

		test('runs only the most recent of the tasks requested while one was running', async () => {
			const runner = new SerialRunner();
			const first = gate();
			const ran: string[] = [];

			const done = Promise.all([
				runner.run('a', async () => {
					await first.opened;
					ran.push('first');
				}),
				runner.run('a', async () => {
					ran.push('stale');
				}),
				runner.run('a', async () => {
					ran.push('latest');
				}),
			]);
			first.open();
			await done;

			assert.deepStrictEqual(ran, ['first', 'latest']);
		});

		test('runs tasks for different keys independently', async () => {
			const runner = new SerialRunner();
			const blocked = gate();
			const ran: string[] = [];

			const a = runner.run('a', async () => {
				await blocked.opened;
				ran.push('a');
			});
			await runner.run('b', async () => {
				ran.push('b');
			});
			blocked.open();
			await a;

			assert.deepStrictEqual(ran, ['b', 'a']);
		});

		test('keeps serving the key after a task throws', async () => {
			const runner = new SerialRunner();
			let ran = false;

			await runner.run('a', async () => {
				throw new Error('boom');
			});
			await runner.run('a', async () => {
				ran = true;
			});

			assert.ok(ran);
		});
	});

	suite('Debouncer', () => {
		let clock: sinon.SinonFakeTimers;

		teardown(() => {
			clock.restore();
		});

		test('fires once, the delay after the last call', () => {
			clock = sinon.useFakeTimers();
			const debouncer = new Debouncer(300);
			const calls: string[] = [];

			debouncer.schedule('a', () => calls.push('first'));
			clock.tick(200);
			debouncer.schedule('a', () => calls.push('second'));
			clock.tick(299);
			assert.deepStrictEqual(calls, []);

			clock.tick(1);
			assert.deepStrictEqual(calls, ['second']);
		});

		test('keeps separate timers per key', () => {
			clock = sinon.useFakeTimers();
			const debouncer = new Debouncer(300);
			const calls: string[] = [];

			debouncer.schedule('a', () => calls.push('a'));
			debouncer.schedule('b', () => calls.push('b'));
			clock.tick(300);

			assert.deepStrictEqual(calls.sort(), ['a', 'b']);
		});

		test('does not fire a cancelled or disposed callback', () => {
			clock = sinon.useFakeTimers();
			const debouncer = new Debouncer(300);
			const calls: string[] = [];

			debouncer.schedule('a', () => calls.push('a'));
			debouncer.schedule('b', () => calls.push('b'));
			debouncer.cancel('a');
			debouncer.dispose();
			clock.tick(1000);

			assert.deepStrictEqual(calls, []);
		});
	});
});
