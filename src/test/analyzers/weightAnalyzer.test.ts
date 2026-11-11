import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import type { AnalysisContext } from '../../analyzers/types';
import { createWeightAnalyzer } from '../../analyzers/weightAnalyzer';
import { CONSTANTS } from '../../shared/constants';
import { failure, success } from '../../shared/result';
import { FINDING_TAGS, type Finding, type PackageJson } from '../../types';
import type { BundlephobiaInfo } from '../../utils/bundlephobia';

const KB = CONSTANTS.BYTES_TO_KB;

suite('WeightAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {
			...packageJson.dependencies,
			...packageJson.devDependencies,
		},
		workspacePath: '/test',
	});

	/**
	 * Runs the analyzer against fake Bundlephobia data. Packages missing
	 * from `sizes` fail to fetch.
	 */
	const analyze = async (
		packageJson: PackageJson,
		sizes: Record<string, BundlephobiaInfo>,
		requested: [name: string, spec: string][] = [],
	): Promise<Finding[]> => {
		const analyzer = createWeightAnalyzer({
			fetchPackageSize: async (name, spec) => {
				requested.push([name, spec]);
				const info = sizes[name];
				return info ? success(info) : failure(`${name} not found`);
			},
		});

		const result = await analyzer.analyze(createContext(packageJson));

		assert.ok(result.success, 'analysis should succeed');
		return result.data;
	};

	suite('Size categories', () => {
		test('reports a package over 1 MB as a warning naming the measured version', async () => {
			const findings = await analyze(
				{ dependencies: { 'aws-sdk': '^2.1500.0' } },
				{
					'aws-sdk': { size: 3072 * KB, gzip: 512.5 * KB, version: '2.1692.0' },
				},
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'Very heavy package: aws-sdk@2.1692.0 - 3072.0 KB minified (512.5 KB gzipped)',
			);
			assert.strictEqual(findings[0].dependency, 'aws-sdk');
			assert.deepStrictEqual(findings[0].meta, {
				size: 3072 * KB,
				gzip: 512.5 * KB,
				url: 'https://bundlephobia.com/package/aws-sdk@2.1692.0',
			});
			assert.deepStrictEqual(findings[0].tags, [FINDING_TAGS.PERFORMANCE]);
		});

		test('reports a package over 200 KB as info', async () => {
			const findings = await analyze(
				{ dependencies: { moment: '^2.29.0' } },
				{ moment: { size: 290 * KB, gzip: 72 * KB, version: '2.30.1' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'Heavy package: moment@2.30.1 - 290.0 KB minified (72.0 KB gzipped)',
			);
		});

		test('reports a package over 50 KB as info', async () => {
			const findings = await analyze(
				{ dependencies: { lodash: '^4.17.21' } },
				{ lodash: { size: 70 * KB, gzip: 25 * KB, version: '4.17.21' } },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'Moderately large package: lodash@4.17.21 - 70.0 KB minified (25.0 KB gzipped)',
			);
		});

		test('reports nothing for a package under 50 KB', async () => {
			const findings = await analyze(
				{ dependencies: { nanoid: '^5.0.0' } },
				{ nanoid: { size: 1 * KB, gzip: 0.5 * KB, version: '5.0.9' } },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('never reports a size as an error', async () => {
			const findings = await analyze(
				{ dependencies: { huge: '^1.0.0' } },
				{ huge: { size: 50 * 1024 * KB, gzip: 10 * 1024 * KB } },
			);

			assert.strictEqual(findings[0].type, 'warning');
		});
	});

	suite('Thresholds are exclusive', () => {
		const cases: [label: string, size: number, expected: string | null][] = [
			['exactly 50 KB', CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD, null],
			[
				'one byte over 50 KB',
				CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD + 1,
				'Moderately large package',
			],
			[
				'exactly 200 KB',
				CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD,
				'Moderately large package',
			],
			[
				'one byte over 200 KB',
				CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD + 1,
				'Heavy package',
			],
			['exactly 1 MB', CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD, 'Heavy package'],
			[
				'one byte over 1 MB',
				CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD + 1,
				'Very heavy package',
			],
		];

		for (const [label, size, expected] of cases) {
			test(`${label} is ${expected ?? 'not reported'}`, async () => {
				const findings = await analyze(
					{ dependencies: { pkg: '1.0.0' } },
					{ pkg: { size, gzip: 0, version: '1.0.0' } },
				);

				assert.deepStrictEqual(
					findings.map((f) => f.message.split(':')[0]),
					expected ? [expected] : [],
				);
			});
		}
	});

	suite('Which dependencies are measured', () => {
		const huge = { size: 5 * 1024 * KB, gzip: 1024 * KB, version: '1.0.0' };

		test('ignores devDependencies, which never reach a bundle', async () => {
			const requested: [string, string][] = [];

			const findings = await analyze(
				{
					dependencies: { react: '^18.2.0' },
					devDependencies: { typescript: '^5.0.0' },
				},
				{ react: { size: 6 * KB, gzip: 3 * KB }, typescript: huge },
				requested,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(requested, [['react', '^18.2.0']]);
		});

		test('asks for the declared range rather than its lower bound', async () => {
			const requested: [string, string][] = [];

			await analyze({ dependencies: { pkg: '~1.2.0' } }, {}, requested);

			assert.deepStrictEqual(requested, [['pkg', '~1.2.0']]);
		});

		test('skips specifiers Bundlephobia cannot resolve', async () => {
			const requested: [string, string][] = [];

			const findings = await analyze(
				{
					dependencies: {
						'workspace-pkg': 'workspace:*',
						'local-pkg': 'file:../local',
						'git-pkg': 'github:user/repo',
					},
				},
				{ 'workspace-pkg': huge, 'local-pkg': huge, 'git-pkg': huge },
				requested,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(requested, []);
		});

		test('reports nothing for a package without dependencies', async () => {
			assert.deepStrictEqual(await analyze({ name: 'app' }, {}), []);
		});
	});

	suite('Incomplete data', () => {
		test('says which range was declared when Bundlephobia does not report the measured version', async () => {
			const findings = await analyze(
				{ dependencies: { pkg: '^1.0.0' } },
				{ pkg: { size: 300 * KB, gzip: 100 * KB } },
			);

			assert.strictEqual(
				findings[0].message,
				'Heavy package: pkg (range ^1.0.0, measured version not reported) - 300.0 KB minified (100.0 KB gzipped)',
			);
			assert.strictEqual(
				findings[0].meta?.['url'],
				'https://bundlephobia.com/package/pkg',
			);
		});

		test('still reports the packages that could be measured', async () => {
			const findings = await analyze(
				{ dependencies: { unknown: '^1.0.0', moment: '^2.29.0' } },
				{ moment: { size: 290 * KB, gzip: 72 * KB, version: '2.30.1' } },
			);

			assert.deepStrictEqual(
				findings.map((f) => f.dependency),
				['moment'],
			);
		});

		test('survives a size lookup that throws', async () => {
			const analyzer = createWeightAnalyzer({
				fetchPackageSize: async (name) => {
					if (name === 'broken') throw new Error('socket hang up');
					return success({ size: 290 * KB, gzip: 72 * KB, version: '1.0.0' });
				},
			});

			const result = await analyzer.analyze(
				createContext({ dependencies: { broken: '^1.0.0', ok: '^1.0.0' } }),
			);

			assert.ok(result.success);
			assert.deepStrictEqual(
				result.data.map((f) => f.dependency),
				['ok'],
			);
		});
	});
});
