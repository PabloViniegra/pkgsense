import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createLicenseAnalyzer } from '../../analyzers/licenseAnalyzer';
import type { AnalysisContext } from '../../analyzers/types';
import { failure, success } from '../../shared/result';
import { FINDING_TAGS, type Finding, type PackageJson } from '../../types';

suite('LicenseAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {
			...packageJson.dependencies,
			...packageJson.devDependencies,
		},
		workspacePath: '/test',
	});

	/**
	 * Runs the analyzer against a fake registry. A null license means the
	 * package publishes none; packages missing from `licenses` fail to fetch.
	 */
	const analyze = async (
		packageJson: PackageJson,
		licenses: Record<string, string | null>,
		requested: [name: string, spec: string | undefined][] = [],
	): Promise<Finding[]> => {
		const analyzer = createLicenseAnalyzer({
			fetchPackageLicense: async (name, spec) => {
				requested.push([name, spec]);
				const license = licenses[name];
				return license !== undefined
					? success(license)
					: failure(`${name} not found`);
			},
		});

		const result = await analyzer.analyze(createContext(packageJson));

		assert.ok(result.success, 'analysis should succeed');
		return result.data;
	};

	suite('Strong copyleft dependencies', () => {
		test('reports a conflict between a permissive package and a GPL dependency', async () => {
			const findings = await analyze(
				{ license: 'MIT', dependencies: { 'gpl-lib': '^1.0.0' } },
				{ 'gpl-lib': 'GPL-3.0' },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'License conflict: "gpl-lib" is licensed GPL-3.0 (strong copyleft), which is incompatible with distributing your package under MIT.',
			);
			assert.strictEqual(findings[0].dependency, 'gpl-lib');
		});

		for (const license of ['GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-2.0+']) {
			test(`recognises the SPDX identifier ${license} as a conflict`, async () => {
				const findings = await analyze(
					{ license: 'Apache-2.0', dependencies: { 'gpl-lib': '^1.0.0' } },
					{ 'gpl-lib': license },
				);

				assert.strictEqual(findings.length, 1);
				assert.ok(findings[0].message.startsWith('License conflict:'));
				assert.ok(findings[0].message.includes(license));
			});
		}

		test('reports an AGPL dependency in an MIT package as a conflict', async () => {
			const findings = await analyze(
				{ license: 'MIT', dependencies: { 'agpl-lib': '^2.0.0' } },
				{ 'agpl-lib': 'AGPL-3.0-only' },
			);

			assert.strictEqual(findings.length, 1);
			assert.ok(findings[0].message.startsWith('License conflict:'));
		});

		test('warns without claiming a conflict when the package declares no license', async () => {
			const findings = await analyze(
				{ dependencies: { 'gpl-lib': '^1.0.0' } },
				{ 'gpl-lib': 'GPL-3.0-only' },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'Strong copyleft dependency: "gpl-lib" is licensed GPL-3.0-only. Distributing your package with it requires complying with that license.',
			);
		});

		test('does not flag copyleft dependencies of a copyleft package', async () => {
			const findings = await analyze(
				{ license: 'GPL-3.0-or-later', dependencies: { 'gpl-lib': '^1.0.0' } },
				{ 'gpl-lib': 'GPL-3.0-only' },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('does not mark license findings as security issues', async () => {
			const findings = await analyze(
				{ license: 'MIT', dependencies: { 'gpl-lib': '^1.0.0' } },
				{ 'gpl-lib': 'GPL-3.0' },
			);

			assert.deepStrictEqual(findings[0].tags, [FINDING_TAGS.LICENSE]);
		});
	});

	suite('Licenses that impose no copyleft obligation', () => {
		const harmless: Record<string, string> = {
			permissive: 'MIT',
			'dual-licensed': '(MIT OR GPL-3.0-only)',
			'weak-copyleft': 'LGPL-3.0-or-later',
			'file-copyleft': 'MPL-2.0',
		};

		for (const [name, license] of Object.entries(harmless)) {
			test(`does not flag ${license}`, async () => {
				const findings = await analyze(
					{ license: 'MIT', dependencies: { [name]: '^1.0.0' } },
					{ [name]: license },
				);

				assert.deepStrictEqual(findings, []);
			});
		}

		test('flags an expression whose every alternative is GPL', async () => {
			const findings = await analyze(
				{ license: 'MIT', dependencies: { lib: '^1.0.0' } },
				{ lib: '(GPL-2.0-only OR GPL-3.0-only)' },
			);

			assert.strictEqual(findings.length, 1);
		});
	});

	suite('Which dependencies are checked', () => {
		test('ignores devDependencies, which are not distributed', async () => {
			const requested: [string, string | undefined][] = [];

			const findings = await analyze(
				{
					license: 'MIT',
					dependencies: { express: '^4.18.0' },
					devDependencies: { 'gpl-build-tool': '^1.0.0' },
				},
				{ express: 'MIT', 'gpl-build-tool': 'GPL-3.0' },
				requested,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(requested, [['express', '^4.18.0']]);
		});

		test('skips specifiers that are not on the registry', async () => {
			const requested: [string, string | undefined][] = [];

			const findings = await analyze(
				{
					license: 'MIT',
					dependencies: {
						'workspace-pkg': 'workspace:*',
						'local-pkg': 'file:../local',
						'git-pkg': 'github:user/repo',
					},
				},
				{},
				requested,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(requested, []);
		});

		test('reports nothing for a package without dependencies', async () => {
			assert.deepStrictEqual(await analyze({ license: 'MIT' }, {}), []);
		});

		test('leaves a missing package license to the metadata analyzer', async () => {
			const findings = await analyze(
				{ dependencies: { express: '^4.18.0' } },
				{ express: 'MIT' },
			);

			assert.deepStrictEqual(findings, []);
		});
	});

	suite('Unknown and missing dependency licenses', () => {
		test('says a dependency publishes no license as info, linking to npm', async () => {
			const findings = await analyze(
				{ license: 'MIT', dependencies: { bare: '^1.0.0' } },
				{ bare: null },
			);

			assert.deepStrictEqual(findings, [
				{
					type: 'info',
					message:
						'"bare" publishes no license information. Manual verification recommended.',
					dependency: 'bare',
					tags: [FINDING_TAGS.LICENSE],
					meta: { url: 'https://www.npmjs.com/package/bare' },
				},
			]);
		});

		test('reports the lookups that failed in one info finding instead of claiming the license is missing', async () => {
			const findings = await analyze(
				{
					license: 'MIT',
					dependencies: { mystery: '^1.0.0', ghost: '^1.0.0', ok: '^1.0.0' },
				},
				{ ok: 'MIT' },
			);

			assert.deepStrictEqual(findings, [
				{
					type: 'info',
					message:
						'Could not check the license of 2 dependencies (mystery, ghost): mystery not found',
					location: ['dependencies'],
					tags: [FINDING_TAGS.LICENSE],
					meta: { packages: ['mystery', 'ghost'] },
				},
			]);
		});

		test('warns on each dependency declared UNLICENSED, on its own line', async () => {
			const findings = await analyze(
				{
					license: 'MIT',
					dependencies: { 'closed-a': '^1.0.0', 'closed-b': '^1.0.0' },
				},
				{ 'closed-a': 'UNLICENSED', 'closed-b': 'UNLICENSED' },
			);

			assert.deepStrictEqual(
				findings.map((f) => [f.type, f.dependency, f.message]),
				[
					[
						'warning',
						'closed-a',
						'"closed-a" is declared UNLICENSED: its author grants no usage rights.',
					],
					[
						'warning',
						'closed-b',
						'"closed-b" is declared UNLICENSED: its author grants no usage rights.',
					],
				],
			);
		});
	});

	suite('Failures', () => {
		test('tolerates a legacy object in the package license field', async () => {
			const legacy = JSON.parse(
				'{"license":{"type":"MIT"},"dependencies":{"gpl-lib":"^1.0.0"}}',
			);

			const findings = await analyze(legacy, { 'gpl-lib': 'GPL-3.0' });

			assert.strictEqual(findings.length, 1);
			assert.ok(findings[0].message.startsWith('Strong copyleft dependency:'));
		});

		test('fails with LICENSE_ANALYSIS_ERROR when the lookup throws', async () => {
			const analyzer = createLicenseAnalyzer({
				fetchPackageLicense: async () => {
					throw new Error('socket hang up');
				},
			});

			const result = await analyzer.analyze(
				createContext({ dependencies: { express: '^4.18.0' } }),
			);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error.code, 'LICENSE_ANALYSIS_ERROR');
			}
		});
	});
});
