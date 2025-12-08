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
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Deprecated Packages Detection', () => {
		test('should detect moment as deprecated', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{},
				{ moment: '^2.29.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const deprecatedFindings = findings.filter(
					f => f.message.includes('Deprecated dependency'),
				);
				assert.strictEqual(deprecatedFindings.length, 1);
				assert.strictEqual(deprecatedFindings[0].type, 'warning');
				assert.ok(deprecatedFindings[0].message.includes('moment'));
				assert.ok(deprecatedFindings[0].message.includes('dayjs or luxon'));
				assert.strictEqual(deprecatedFindings[0].dependency, 'moment');
				assert.ok(deprecatedFindings[0].tags?.includes(FINDING_TAGS.MAINTENANCE));
			}
		});

		test('should detect request as deprecated', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{},
				{ request: '^2.88.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const deprecatedFindings = findings.filter(
					f => f.message.includes('Deprecated dependency'),
				);
				assert.strictEqual(deprecatedFindings.length, 1);
				assert.ok(deprecatedFindings[0].message.includes('request'));
				assert.ok(deprecatedFindings[0].message.includes('fetch or axios'));
			}
		});

		test('should detect left-pad as unnecessary', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{},
				{ 'left-pad': '^1.3.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const deprecatedFindings = findings.filter(
					f => f.message.includes('Deprecated dependency'),
				);
				assert.strictEqual(deprecatedFindings.length, 1);
				assert.ok(deprecatedFindings[0].message.includes('left-pad'));
			}
		});

		test('should detect multiple deprecated packages', async () => {
			const analyzer = createHeuristicsAnalyzer();
			const context = createContext(
				{},
				{
					moment: '^2.29.0',
					request: '^2.88.0',
					'left-pad': '^1.3.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				const deprecatedFindings = findings.filter(
					f => f.message.includes('Deprecated dependency'),
				);
				assert.strictEqual(deprecatedFindings.length, 3);
			}
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
				const deprecatedFindings = result.data.filter(
					f => f.message.includes('Deprecated dependency'),
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
				const duplicateFindings = findings.filter(
					f => f.message.includes('Duplicate dependency'),
				);
				assert.strictEqual(duplicateFindings.length, 1);
				assert.strictEqual(duplicateFindings[0].dependency, 'typescript');
				assert.ok(duplicateFindings[0].tags?.includes(FINDING_TAGS.DUPLICATION));
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
				const duplicateFindings = findings.filter(
					f => f.message.includes('Duplicate dependency'),
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
				const duplicateFindings = findings.filter(
					f => f.message.includes('Duplicate dependency'),
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
				const duplicateFindings = findings.filter(
					f => f.message.includes('Duplicate dependency'),
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
				const testFindings = findings.filter(
					f => f.message.includes('No tests configured'),
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
				const testFindings = findings.filter(
					f => f.message.includes('No tests configured'),
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
				const testFindings = findings.filter(
					f => f.message.includes('No tests configured'),
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
				const testFindings = findings.filter(
					f => f.message.includes('No tests configured'),
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
				const filesFindings = findings.filter(
					f => f.message.includes('Missing "files" field'),
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
				const filesFindings = findings.filter(
					f => f.message.includes('Missing "files" field'),
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
				const typeFindings = findings.filter(
					f => f.message.includes('Missing "type" field'),
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
				const typeFindings = findings.filter(
					f => f.message.includes('Missing "type" field'),
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
				const typeFindings = findings.filter(
					f => f.message.includes('Missing "type" field'),
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
});
