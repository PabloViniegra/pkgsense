import * as assert from 'node:assert';
import { suite, teardown, test } from 'mocha';
import * as sinon from 'sinon';
import { fetchBundlephobia } from '../../utils/bundlephobia';
import {
	type FakeFetch,
	type FakeResponse,
	stubFetch,
} from '../helpers/fakeFetch';

const SIZE_API = 'https://bundlephobia.com/api/size?package=';

suite('Bundlephobia Utility Test Suite', () => {
	teardown(() => {
		sinon.restore();
	});

	const urlOf = (pkg: string) => SIZE_API + encodeURIComponent(pkg);

	/** Makes the API answer for exactly one package specifier. */
	const answer = (pkg: string, response: FakeResponse | Error): FakeFetch =>
		stubFetch({ [urlOf(pkg)]: response });

	const sizes = { body: { size: 1, gzip: 1 } };

	suite('Package Name Validation', () => {
		const invalid: [label: string, name: unknown, error: string][] = [
			['an empty name', '', 'must be a non-empty string'],
			['a whitespace-only name', '   ', 'cannot be empty'],
			['invalid characters', 'invalid@#$%', 'contains invalid characters'],
			['a path instead of a name', '../../etc/passwd', 'invalid characters'],
			['a name over 214 characters', 'a'.repeat(215), 'exceeds maximum length'],
			['null', null, 'must be a non-empty string'],
			['a number', 123, 'must be a non-empty string'],
		];

		for (const [label, name, error] of invalid) {
			test(`rejects ${label} without calling the API`, async () => {
				const api = stubFetch({});

				// @ts-expect-error callers reading untyped JSON may pass anything
				const result = await fetchBundlephobia(name, '1.0.0');

				assert.strictEqual(result.success, false);
				if (!result.success) {
					assert.ok(result.error.startsWith('Invalid package name'));
					assert.ok(result.error.includes(error), result.error);
				}
				assert.deepStrictEqual(api.requested, []);
			});
		}

		test('trims the package name', async () => {
			const api = answer('lodash@4.17.21', sizes);

			const result = await fetchBundlephobia('  lodash  ', '4.17.21');

			assert.ok(result.success);
			assert.deepStrictEqual(api.requested, [urlOf('lodash@4.17.21')]);
		});
	});

	suite('Requested version', () => {
		const specs: [label: string, spec: string, requested: string][] = [
			['an exact version', '4.17.21', 'lodash@4.17.21'],
			['a caret range, unchanged', '^4.17.0', 'lodash@^4.17.0'],
			['a tilde range, unchanged', '~4.17.0', 'lodash@~4.17.0'],
			[
				'a compound range, unchanged',
				'>=4.0.0 <5.0.0',
				'lodash@>=4.0.0 <5.0.0',
			],
			['latest for an empty version', '', 'lodash@latest'],
			['latest for a non-version specifier', 'workspace:', 'lodash@latest'],
		];

		for (const [label, spec, requested] of specs) {
			test(`asks for ${label}`, async () => {
				const api = answer(requested, sizes);

				const result = await fetchBundlephobia('lodash', spec);

				assert.ok(result.success);
				assert.deepStrictEqual(api.requested, [urlOf(requested)]);
			});
		}

		test('asks for scoped packages by their full name', async () => {
			const api = answer('@babel/core@^7.24.0', sizes);

			const result = await fetchBundlephobia('@babel/core', '^7.24.0');

			assert.ok(result.success);
			assert.deepStrictEqual(api.requested, [
				'https://bundlephobia.com/api/size?package=%40babel%2Fcore%40%5E7.24.0',
			]);
		});
	});

	suite('Response', () => {
		test('returns the sizes and the version that was measured', async () => {
			answer('react@^18.2.0', {
				body: {
					name: 'react',
					version: '18.3.1',
					size: 7654,
					gzip: 2987,
					dependencyCount: 1,
				},
			});

			const result = await fetchBundlephobia('react', '^18.2.0');

			assert.deepStrictEqual(result, {
				success: true,
				data: { size: 7654, gzip: 2987, version: '18.3.1' },
			});
		});

		test('omits the version when the API does not return one', async () => {
			answer('react@18.3.1', { body: { size: 7654, gzip: 2987 } });

			const result = await fetchBundlephobia('react', '18.3.1');

			assert.deepStrictEqual(result, {
				success: true,
				data: { size: 7654, gzip: 2987 },
			});
		});

		test('rejects a body without sizes', async () => {
			answer('react@18.3.1', { body: { error: { code: 'BuildError' } } });

			const result = await fetchBundlephobia('react', '18.3.1');

			assert.deepStrictEqual(result, {
				success: false,
				error: 'Invalid response format from Bundlephobia for react',
			});
		});

		test('rejects sizes that are not numbers', async () => {
			answer('react@18.3.1', { body: { size: '7654', gzip: 2987 } });

			const result = await fetchBundlephobia('react', '18.3.1');

			assert.strictEqual(result.success, false);
		});
	});

	suite('Failures', () => {
		test('reports the HTTP status for a package Bundlephobia cannot find', async () => {
			answer('no-such-package@1.0.0', {
				status: 404,
				body: { error: 'PackageNotFound' },
			});

			const result = await fetchBundlephobia('no-such-package', '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.startsWith('HTTP 404'), result.error);
				assert.ok(result.error.endsWith('for package no-such-package@1.0.0'));
			}
		});

		test('reports a network error instead of throwing', async () => {
			answer('react@18.3.1', new Error('getaddrinfo ENOTFOUND'));

			const result = await fetchBundlephobia('react', '18.3.1');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(
					result.error ===
						'Error fetching bundlephobia data for react: getaddrinfo ENOTFOUND',
					result.error,
				);
			}
		});
	});
});
