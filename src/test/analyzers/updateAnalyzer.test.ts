import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import type { AnalysisContext } from '../../analyzers/types';
import { createUpdateAnalyzer } from '../../analyzers/updateAnalyzer';
import { failure, success } from '../../shared/result';
import { FINDING_TAGS, type Finding } from '../../types';
import type { DeprecationNotice } from '../../utils/npmRegistry';

interface Registry {
	readonly latest?: Readonly<Record<string, string>>;
	readonly deprecated?: Readonly<Record<string, DeprecationNotice>>;
}

suite('UpdateAnalyzer Test Suite', () => {
	const createContext = (
		allDependencies: Record<string, string>,
	): AnalysisContext => ({
		packageJson: {},
		allDependencies,
		workspacePath: '/test',
	});

	/**
	 * Runs the analyzer against a fake registry. Packages missing from
	 * `latest` fail to fetch, like a package that does not exist.
	 */
	const analyze = async (
		dependencies: Record<string, string>,
		registry: Registry,
		requested: string[] = [],
	): Promise<Finding[]> => {
		const analyzer = createUpdateAnalyzer({
			fetchLatestVersion: async (name) => {
				requested.push(name);
				const latest = registry.latest?.[name];
				return latest ? success(latest) : failure(`${name} not found`);
			},
			fetchDeprecation: async (name) =>
				success(registry.deprecated?.[name] ?? null),
		});

		const result = await analyzer.analyze(createContext(dependencies));

		assert.ok(result.success, 'analysis should succeed');
		return result.data;
	};

	suite('Updates the declared range cannot reach', () => {
		test('reports a major update as a warning with both versions', async () => {
			const findings = await analyze(
				{ react: '^17.0.2' },
				{ latest: { react: '18.3.1' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'react: Major update available ^17.0.2 → 18.3.1 (may contain breaking changes)',
			);
			assert.strictEqual(findings[0].dependency, 'react');
			assert.deepStrictEqual(findings[0].meta, {
				currentVersion: '^17.0.2',
				latestVersion: '18.3.1',
				updateType: 'major',
				url: 'https://www.npmjs.com/package/react/v/18.3.1',
			});
		});

		test('reports a minor update outside a tilde range as info', async () => {
			const findings = await analyze(
				{ express: '~4.17.1' },
				{ latest: { express: '4.21.0' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'express: Minor update available ~4.17.1 → 4.21.0 (new features)',
			);
		});

		test('reports a patch update for a pinned version as info', async () => {
			const findings = await analyze(
				{ 'node-fetch': '2.6.7' },
				{ latest: { 'node-fetch': '2.6.9' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'node-fetch: Patch update available 2.6.7 → 2.6.9 (bug fixes)',
			);
		});

		test('treats a 0.x minor bump as outside a caret range', async () => {
			const findings = await analyze(
				{ esbuild: '^0.27.1' },
				{ latest: { esbuild: '0.28.2' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].meta?.['updateType'], 'minor');
		});

		test('does not tag updates as maintenance, which would strike them through as deprecated', async () => {
			const findings = await analyze(
				{ react: '^17.0.2' },
				{ latest: { react: '18.3.1' } },
			);

			assert.deepStrictEqual(findings[0].tags, [FINDING_TAGS.UPDATES]);
		});
	});

	suite('Ranges that already admit the latest release', () => {
		test('reports nothing when a caret range covers the latest version', async () => {
			const findings = await analyze(
				{ semver: '^7.5.0' },
				{ latest: { semver: '7.8.6' } },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('reports nothing when the pinned version is the latest', async () => {
			const findings = await analyze(
				{ lodash: '4.17.21' },
				{ latest: { lodash: '4.17.21' } },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('reports nothing for an open-ended range', async () => {
			const findings = await analyze(
				{ typescript: '>=4.0.0', chalk: '*' },
				{ latest: { typescript: '5.9.3', chalk: '5.3.0' } },
			);

			assert.deepStrictEqual(findings, []);
		});
	});

	suite('Versions that are not an upgrade', () => {
		test('ignores a pre-release published as latest', async () => {
			const findings = await analyze(
				{ next: '^14.0.0' },
				{ latest: { next: '15.0.0-rc.1' } },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('ignores a latest version older than the declared one', async () => {
			const findings = await analyze(
				{ react: '^19.0.0' },
				{ latest: { react: '18.3.1' } },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('ignores a registry answer that is not a version', async () => {
			const findings = await analyze(
				{ react: '^17.0.0' },
				{ latest: { react: 'not-a-version' } },
			);

			assert.deepStrictEqual(findings, []);
		});
	});

	suite('Specifiers that are not registry ranges', () => {
		test('skips them without querying the registry', async () => {
			const requested: string[] = [];
			const specs = {
				'workspace-pkg': 'workspace:*',
				'local-pkg': 'file:../local-pkg',
				'git-pkg': 'github:user/repo#v2.0.0',
				'url-pkg': 'git+https://github.com/user/repo.git#v3.1.0',
				'alias-pkg': 'npm:other-pkg@^1.0.0',
				'tag-pkg': 'latest',
			};
			const latest = Object.fromEntries(
				Object.keys(specs).map((name) => [name, '99.0.0']),
			);

			const findings = await analyze(specs, { latest }, requested);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(requested, []);
		});
	});

	suite('npm deprecation notices', () => {
		test('reports the registry notice for the resolved version as a warning', async () => {
			const findings = await analyze(
				{ request: '^2.88.0' },
				{
					latest: { request: '2.88.2' },
					deprecated: {
						request: {
							version: '2.88.2',
							message:
								'request has been deprecated, see https://github.com/request/request/issues/3142',
						},
					},
				},
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'Deprecated on npm: request@2.88.2 - request has been deprecated, see https://github.com/request/request/issues/3142',
			);
			assert.strictEqual(findings[0].dependency, 'request');
			assert.ok(findings[0].tags?.includes(FINDING_TAGS.REPLACEMENT));
			assert.strictEqual(
				findings[0].meta?.['url'],
				'https://www.npmjs.com/package/request/v/2.88.2',
			);
		});

		test('reports both the deprecation and the update when both apply', async () => {
			const findings = await analyze(
				{ eslint: '^8.57.0' },
				{
					latest: { eslint: '9.39.1' },
					deprecated: {
						eslint: {
							version: '8.57.1',
							message: 'This version is no longer supported.',
						},
					},
				},
			);

			assert.deepStrictEqual(
				findings.map((f) => f.message),
				[
					'eslint: Major update available ^8.57.0 → 9.39.1 (may contain breaking changes)',
					'Deprecated on npm: eslint@8.57.1 - This version is no longer supported.',
				],
			);
		});

		test('says the package could not be checked when the deprecation lookup fails', async () => {
			const analyzer = createUpdateAnalyzer({
				fetchLatestVersion: async () => success('1.0.0'),
				fetchDeprecation: async () => failure('registry unreachable'),
			});

			const result = await analyzer.analyze(createContext({ pkg: '^1.0.0' }));

			assert.ok(result.success);
			assert.deepStrictEqual(
				result.data.map((f) => [f.type, f.message]),
				[
					[
						'info',
						'Could not check 1 dependency for updates (pkg): registry unreachable',
					],
				],
			);
		});

		test('skips deprecation checks when no lookup is injected', async () => {
			const analyzer = createUpdateAnalyzer({
				fetchLatestVersion: async () => success('1.0.0'),
			});

			const result = await analyzer.analyze(createContext({ pkg: '^1.0.0' }));

			assert.ok(result.success);
			assert.deepStrictEqual(result.data, []);
		});
	});

	suite('Registry failures', () => {
		test('still reports the packages that could be fetched', async () => {
			const findings = await analyze(
				{ 'missing-package': '^1.0.0', react: '^17.0.2' },
				{ latest: { react: '18.3.1' } },
			);

			assert.deepStrictEqual(
				findings.map((f) => f.dependency),
				['react', undefined],
			);
		});

		test('lists every package that could not be checked in one info finding on the dependencies section', async () => {
			const findings = await analyze(
				{ ghost: '^1.0.0', phantom: '^2.0.0', react: '^18.3.1' },
				{ latest: { react: '18.3.1' } },
			);

			assert.deepStrictEqual(findings, [
				{
					type: 'info',
					message:
						'Could not check 2 dependencies for updates (ghost, phantom): ghost not found',
					location: ['dependencies'],
					tags: [FINDING_TAGS.UPDATES],
					meta: { packages: ['ghost', 'phantom'] },
				},
			]);
		});

		test('fails with UPDATE_ANALYSIS_ERROR when the lookup throws', async () => {
			const analyzer = createUpdateAnalyzer({
				fetchLatestVersion: async () => {
					throw new Error('socket hang up');
				},
			});

			const result = await analyzer.analyze(createContext({ pkg: '^1.0.0' }));

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error.code, 'UPDATE_ANALYSIS_ERROR');
				assert.strictEqual(result.error.message, 'socket hang up');
			}
		});

		test('reports nothing for a package without dependencies', async () => {
			assert.deepStrictEqual(await analyze({}, {}), []);
		});
	});
});
