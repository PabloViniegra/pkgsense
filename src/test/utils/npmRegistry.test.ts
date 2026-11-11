import * as assert from 'node:assert';
import { setup, suite, teardown, test } from 'mocha';
import * as sinon from 'sinon';
import { npmRegistryCache } from '../../utils/cache';
import { type FakeFetch, stubFetch } from '../helpers/fakeFetch';
import {
	type NpmPackageMetadata,
	fetchDeprecation,
	fetchLatestVersion,
	fetchPackageLicense,
	normalizeLicense,
	resolveVersion,
} from '../../utils/npmRegistry';

const REGISTRY = 'https://registry.npmjs.org';

type VersionInfo = NpmPackageMetadata['versions'][string];

const createMetadata = (
	name: string,
	latest: string,
	versions: Record<string, Omit<VersionInfo, 'version'>>,
): NpmPackageMetadata => ({
	name,
	'dist-tags': { latest },
	time: {},
	versions: Object.fromEntries(
		Object.entries(versions).map(([version, info]) => [
			version,
			{ version, ...info },
		]),
	),
});

suite('NPM Registry Test Suite', () => {
	suite('resolveVersion', () => {
		const metadata = createMetadata('pkg', '2.0.0', {
			'1.0.0': {},
			'1.2.0': {},
			'2.0.0': {},
			'3.0.0-beta.1': {},
		});

		const cases: [spec: string | undefined, expected: string | null][] = [
			['^1.0.0', '1.2.0'],
			['~1.0.0', '1.0.0'],
			['1.0.0', '1.0.0'],
			['^2.0.0', '2.0.0'],
			['>=1.0.0', '2.0.0'],
			['*', '2.0.0'],
			['3.0.0-beta.1', '3.0.0-beta.1'],
			['latest', '2.0.0'],
			['', '2.0.0'],
			[undefined, '2.0.0'],
			['^9.0.0', null],
			['workspace:*', null],
			['file:../pkg', null],
			['github:user/pkg', null],
		];

		for (const [spec, expected] of cases) {
			test(`resolves ${JSON.stringify(spec)} to ${expected}`, () => {
				assert.strictEqual(resolveVersion(metadata, spec), expected);
			});
		}

		test('picks the highest matching version when latest is outside the range', () => {
			const backported = createMetadata('pkg', '2.0.0', {
				'1.0.0': {},
				'2.0.0': {},
				'1.5.0': {},
			});

			assert.strictEqual(resolveVersion(backported, '^1.0.0'), '1.5.0');
		});

		test('skips a deprecated latest when a supported version matches, as npm does', () => {
			const pulled = createMetadata('pkg', '1.3.0', {
				'1.2.0': {},
				'1.3.0': { deprecated: 'Broken release, use 1.2.0' },
			});

			assert.strictEqual(resolveVersion(pulled, '^1.0.0'), '1.2.0');
		});

		test('prefers the highest supported version over a higher deprecated one', () => {
			const pulled = createMetadata('pkg', '2.0.0', {
				'1.1.0': {},
				'1.4.0': { deprecated: 'Security issue' },
				'2.0.0': {},
			});

			assert.strictEqual(resolveVersion(pulled, '^1.0.0'), '1.1.0');
		});

		test('falls back to the highest match when every matching version is deprecated', () => {
			const abandoned = createMetadata('pkg', '1.4.0', {
				'1.2.0': { deprecated: 'Unmaintained' },
				'1.4.0': { deprecated: 'Unmaintained' },
			});

			assert.strictEqual(resolveVersion(abandoned, '^1.0.0'), '1.4.0');
		});

		test('keeps an exact pin even when that version is deprecated', () => {
			const pulled = createMetadata('pkg', '1.3.0', {
				'1.2.0': {},
				'1.3.0': { deprecated: 'Broken release' },
			});

			assert.strictEqual(resolveVersion(pulled, '1.3.0'), '1.3.0');
		});
	});

	suite('normalizeLicense', () => {
		const license = (info: Omit<VersionInfo, 'version'>) =>
			normalizeLicense({ version: '1.0.0', ...info });

		test('returns an SPDX string as published', () => {
			assert.strictEqual(license({ license: ' MIT ' }), 'MIT');
		});

		test('reads the legacy { type } object', () => {
			assert.strictEqual(
				license({ license: { type: 'BSD-3-Clause', url: 'https://x' } }),
				'BSD-3-Clause',
			);
		});

		test('reads a legacy licenses array with one entry', () => {
			assert.strictEqual(license({ licenses: [{ type: 'MIT' }] }), 'MIT');
		});

		test('joins a legacy licenses array as alternatives', () => {
			assert.strictEqual(
				license({ licenses: [{ type: 'MIT' }, { type: 'GPL-3.0' }] }),
				'(MIT OR GPL-3.0)',
			);
		});

		test('returns null when nothing usable is published', () => {
			assert.strictEqual(license({}), null);
			assert.strictEqual(license({ license: '  ' }), null);
			assert.strictEqual(license({ license: 42, licenses: [] }), null);
		});
	});

	suite('Lookups against the registry', () => {
		setup(() => {
			npmRegistryCache.clear();
		});

		teardown(() => {
			sinon.restore();
			npmRegistryCache.clear();
		});

		const urlOf = (name: string) => `${REGISTRY}/${encodeURIComponent(name)}`;

		const publish = (metadata: NpmPackageMetadata): FakeFetch =>
			stubFetch({ [urlOf(metadata.name)]: { body: metadata } });

		const relicensed = createMetadata('relicensed', '2.1.0', {
			'1.0.0': { license: 'GPL-3.0' },
			'1.4.0': { license: 'GPL-3.0', deprecated: 'Use v2, v1 is unsupported ' },
			'2.1.0': { license: 'MIT' },
		});

		test('fetchLatestVersion returns the latest dist-tag', async () => {
			publish(relicensed);

			const result = await fetchLatestVersion('relicensed');

			assert.deepStrictEqual(result, { success: true, data: '2.1.0' });
		});

		test('fetchPackageLicense returns the license of the version the range resolves to', async () => {
			publish(relicensed);

			const old = await fetchPackageLicense('relicensed', '^1.0.0');
			const current = await fetchPackageLicense('relicensed', '^2.0.0');

			assert.deepStrictEqual(old, { success: true, data: 'GPL-3.0' });
			assert.deepStrictEqual(current, { success: true, data: 'MIT' });
		});

		test('fetchPackageLicense fails when no published version matches', async () => {
			publish(relicensed);

			const result = await fetchPackageLicense('relicensed', '^9.0.0');

			assert.deepStrictEqual(result, {
				success: false,
				error: 'No published version of relicensed matches "^9.0.0"',
			});
		});

		test('fetchPackageLicense returns null when the version publishes no license', async () => {
			publish(createMetadata('bare', '1.0.0', { '1.0.0': {} }));

			const result = await fetchPackageLicense('bare', '^1.0.0');

			assert.deepStrictEqual(result, { success: true, data: null });
		});

		test('fetchPackageLicense fails when no published version matches the range', async () => {
			publish(createMetadata('bare', '1.0.0', { '1.0.0': { license: 'MIT' } }));

			const result = await fetchPackageLicense('bare', '^3.0.0');

			assert.ok(!result.success);
			assert.match(result.error, /^No published version of bare matches/);
		});

		test('fetchDeprecation resolves a range to a version that is not deprecated when one matches', async () => {
			publish(relicensed);

			const result = await fetchDeprecation('relicensed', '^1.0.0');

			assert.deepStrictEqual(result, { success: true, data: null });
		});

		test('fetchDeprecation returns the notice of a pinned deprecated version', async () => {
			publish(relicensed);

			const result = await fetchDeprecation('relicensed', '1.4.0');

			assert.deepStrictEqual(result, {
				success: true,
				data: { version: '1.4.0', message: 'Use v2, v1 is unsupported' },
			});
		});

		test('fetchDeprecation returns null when the resolved version is not deprecated', async () => {
			publish(relicensed);

			const current = await fetchDeprecation('relicensed', '^2.0.0');
			const pinnedOld = await fetchDeprecation('relicensed', '1.0.0');

			assert.deepStrictEqual(current, { success: true, data: null });
			assert.deepStrictEqual(pinnedOld, { success: true, data: null });
		});

		test('fetchDeprecation returns null for a specifier that is not a registry range', async () => {
			publish(relicensed);

			const result = await fetchDeprecation('relicensed', 'workspace:*');

			assert.deepStrictEqual(result, { success: true, data: null });
		});

		test('reports a package that does not exist without retrying', async () => {
			const registry = stubFetch({
				[urlOf('no-such-package')]: { status: 404, body: {} },
			});

			const result = await fetchLatestVersion('no-such-package');

			assert.deepStrictEqual(result, {
				success: false,
				error: 'Package "no-such-package" not found in NPM registry',
			});
			assert.strictEqual(registry.requested.length, 1);
		});

		test('rejects a response that is not package metadata', async () => {
			stubFetch({ [urlOf('odd')]: { body: { error: 'not what you expect' } } });

			const result = await fetchLatestVersion('odd');

			assert.deepStrictEqual(result, {
				success: false,
				error: 'Invalid metadata format for package odd',
			});
		});

		test('asks the registry once for several lookups of the same package', async () => {
			const registry = publish(relicensed);

			await fetchLatestVersion('relicensed');
			const license = await fetchPackageLicense('relicensed', '^2.0.0');
			const deprecation = await fetchDeprecation('relicensed', '^1.0.0');

			assert.deepStrictEqual(registry.requested, [urlOf('relicensed')]);
			assert.ok(license.success);
			assert.ok(deprecation.success);
		});

		test('requests scoped packages with an encoded name', async () => {
			const registry = publish(
				createMetadata('@scope/pkg', '1.0.0', { '1.0.0': { license: 'ISC' } }),
			);

			const result = await fetchPackageLicense('@scope/pkg', '1.0.0');

			assert.deepStrictEqual(result, { success: true, data: 'ISC' });
			assert.deepStrictEqual(registry.requested, [
				'https://registry.npmjs.org/%40scope%2Fpkg',
			]);
		});
	});
});
