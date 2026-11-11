import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createHeuristicsAnalyzer } from '../../analyzers/heuristicsAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('HeuristicsAnalyzer Test Suite', () => {
	const createContext = (
		packageJson: PackageJson,
		allDependencies: Record<string, string> = {},
	): AnalysisContext => ({
		packageJson,
		allDependencies,
		workspacePath: '/test',
	});

	suite('Maintenance-mode packages', () => {
		const analyzeDependencies = async (
			allDependencies: Record<string, string>,
		) => {
			const result = await createHeuristicsAnalyzer().analyze(
				createContext(
					{ private: true, type: 'module', scripts: { test: 'mocha' } },
					allDependencies,
				),
			);

			assert.ok(result.success, 'analysis should succeed');
			return result.data;
		};

		test('notes moment as maintenance mode, citing the project status page', async () => {
			const findings = await analyzeDependencies({ moment: '^2.29.0' });

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'Maintenance-mode dependency: moment is in maintenance mode (no new features). Consider dayjs or luxon.',
			);
			assert.strictEqual(findings[0].dependency, 'moment');
			assert.deepStrictEqual(findings[0].tags, [FINDING_TAGS.MAINTENANCE]);
			assert.strictEqual(
				findings[0].meta?.['url'],
				'https://momentjs.com/docs/#/-project-status/',
			);
		});

		test('does not call moment deprecated or mark it for replacement', async () => {
			const [finding] = await analyzeDependencies({ moment: '^2.29.0' });

			assert.ok(!/deprecated/i.test(finding.message));
			assert.ok(!finding.tags?.includes(FINDING_TAGS.REPLACEMENT));
		});

		test('leaves npm deprecations to the registry notice instead of a hardcoded list', async () => {
			const findings = await analyzeDependencies({
				request: '^2.88.0',
				'left-pad': '^1.3.0',
			});

			assert.deepStrictEqual(findings, []);
		});

		test('should not flag non-deprecated packages', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{},
				{
					react: '^18.0.0',
					express: '^4.18.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const deprecatedFindings = result.data.filter((f) =>
					f.message.includes('Deprecated dependency'),
				);
				assert.strictEqual(deprecatedFindings.length, 0);
			}
		});
	});

	suite('Duplicate Dependencies Detection', () => {
		test('should detect duplicate in deps and devDeps', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				dependencies: { typescript: '^5.0.0' },
				devDependencies: { typescript: '^5.0.0' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const duplicateFindings = findings.filter((f) =>
					f.message.includes('Duplicate dependency'),
				);
				assert.strictEqual(duplicateFindings.length, 1);
				assert.strictEqual(duplicateFindings[0].dependency, 'typescript');
				assert.deepStrictEqual(duplicateFindings[0].location, [
					'devDependencies',
					'typescript',
				]);
				assert.ok(
					duplicateFindings[0].tags?.includes(FINDING_TAGS.DUPLICATION),
				);
			}
		});

		test('should detect multiple duplicates', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				dependencies: {
					typescript: '^5.0.0',
					lodash: '^4.17.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
					lodash: '^4.17.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const duplicateFindings = findings.filter((f) =>
					f.message.includes('Duplicate dependency'),
				);
				assert.strictEqual(duplicateFindings.length, 2);
			}
		});

		test('should not flag when no duplicates exist', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				dependencies: { react: '^18.0.0' },
				devDependencies: { typescript: '^5.0.0' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const duplicateFindings = findings.filter((f) =>
					f.message.includes('Duplicate dependency'),
				);
				assert.strictEqual(duplicateFindings.length, 0);
			}
		});

		test('should handle missing dependencies', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const duplicateFindings = findings.filter((f) =>
					f.message.includes('Duplicate dependency'),
				);
				assert.strictEqual(duplicateFindings.length, 0);
			}
		});
	});

	suite('Test Script Detection', () => {
		test('should flag missing test script', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				scripts: { build: 'tsc' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const testFindings = findings.filter((f) =>
					f.message.includes('No tests configured'),
				);
				assert.strictEqual(testFindings.length, 1);
				assert.strictEqual(testFindings[0].type, 'info');
				assert.ok(testFindings[0].tags?.includes(FINDING_TAGS.QUALITY));
			}
		});

		test('should flag placeholder test script', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				scripts: { test: 'echo "Error: no test specified"' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const testFindings = findings.filter((f) =>
					f.message.includes('No tests configured'),
				);
				assert.strictEqual(testFindings.length, 1);
			}
		});

		test('should not flag valid test script', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				scripts: { test: 'mocha' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const testFindings = findings.filter((f) =>
					f.message.includes('No tests configured'),
				);
				assert.strictEqual(testFindings.length, 0);
			}
		});

		test('should handle missing scripts field', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const testFindings = findings.filter((f) =>
					f.message.includes('No tests configured'),
				);
				assert.strictEqual(testFindings.length, 1);
			}
		});
	});

	suite('Files Field Detection', () => {
		test('should flag missing files field', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const filesFindings = findings.filter((f) =>
					f.message.includes('Missing "files" field'),
				);
				assert.strictEqual(filesFindings.length, 1);
				assert.strictEqual(filesFindings[0].type, 'info');
				assert.ok(filesFindings[0].tags?.includes(FINDING_TAGS.PACKAGING));
			}
		});

		test('should not flag when files field exists', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				files: ['dist', 'src'],
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const filesFindings = findings.filter((f) =>
					f.message.includes('Missing "files" field'),
				);
				assert.strictEqual(filesFindings.length, 0);
			}
		});
	});

	suite('Type Field Detection', () => {
		test('should flag missing type field', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const typeFindings = findings.filter((f) =>
					f.message.includes('Missing "type" field'),
				);
				assert.strictEqual(typeFindings.length, 1);
				assert.strictEqual(typeFindings[0].type, 'info');
				assert.ok(typeFindings[0].tags?.includes(FINDING_TAGS.CONFIG));
			}
		});

		test('should not flag when type field is module', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				type: 'module',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const typeFindings = findings.filter((f) =>
					f.message.includes('Missing "type" field'),
				);
				assert.strictEqual(typeFindings.length, 0);
			}
		});

		test('should not flag when type field is commonjs', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				type: 'commonjs',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const typeFindings = findings.filter((f) =>
					f.message.includes('Missing "type" field'),
				);
				assert.strictEqual(typeFindings.length, 0);
			}
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty package.json', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.ok(result.data.length > 0);
			}
		});

		test('should handle complete package.json', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext({
				name: 'test-package',
				version: '1.0.0',
				type: 'module',
				files: ['dist'],
				scripts: { test: 'jest' },
				dependencies: { express: '^4.18.0' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should accumulate all findings', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{
					dependencies: { moment: '^2.29.0' },
					devDependencies: { moment: '^2.29.0' },
				},
				{ moment: '^2.29.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.ok(findings.length >= 4);
			}
		});
	});

	suite('Private packages', () => {
		const filesFindings = async (packageJson: PackageJson) => {
			const result = await createHeuristicsAnalyzer().analyze(
				createContext(packageJson),
			);

			assert.ok(result.success, 'analysis should succeed');
			return result.data.filter((f) => f.message.includes('"files"'));
		};

		test('does not ask a private package for a "files" field', async () => {
			assert.deepStrictEqual(await filesFindings({ private: true }), []);
		});

		test('asks a publishable package for a "files" field', async () => {
			const findings = await filesFindings({ name: 'lib' });

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(
				findings[0].message,
				'Missing "files" field. Adding it reduces the published package size.',
			);
		});
	});
});
