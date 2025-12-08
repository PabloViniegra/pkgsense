import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createDependencyGraphAnalyzer } from '../../analyzers/dependencyGraphAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('DependencyGraphAnalyzer Test Suite', () => {
	const createContext = (
		packageJson: PackageJson,
		allDependencies: Record<string, string> = {},
	): AnalysisContext => ({
		packageJson,
		allDependencies,
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Dependency Count Validation', () => {
		test('should not flag small dependency count', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					express: '^4.18.0',
					lodash: '^4.17.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
					jest: '^29.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const countFindings = result.data.filter((f) =>
					f.message.includes('dependency count'),
				);
				assert.strictEqual(countFindings.length, 0);
			}
		});

		test('should flag high dependency count as info', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};
			const devDeps: Record<string, string> = {};

			for (let i = 0; i < 30; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}
			for (let i = 0; i < 25; i++) {
				devDeps[`dev-package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
				devDependencies: devDeps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const countFindings = result.data.filter((f) =>
					f.message.includes('High dependency count'),
				);
				assert.strictEqual(countFindings.length, 1);
				assert.strictEqual(countFindings[0].type, 'info');
				assert.ok(countFindings[0].tags?.includes(FINDING_TAGS.DEPENDENCIES));
				assert.ok(countFindings[0].tags?.includes(FINDING_TAGS.QUALITY));
			}
		});

		test('should flag very high dependency count as warning', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};
			const devDeps: Record<string, string> = {};

			for (let i = 0; i < 60; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}
			for (let i = 0; i < 45; i++) {
				devDeps[`dev-package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
				devDependencies: devDeps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const countFindings = result.data.filter((f) =>
					f.message.includes('Very high dependency count'),
				);
				assert.strictEqual(countFindings.length, 1);
				assert.strictEqual(countFindings[0].type, 'warning');
				assert.ok(countFindings[0].tags?.includes(FINDING_TAGS.PERFORMANCE));
			}
		});

		test('should include counts in metadata', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};
			const devDeps: Record<string, string> = {};

			for (let i = 0; i < 60; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}
			for (let i = 0; i < 45; i++) {
				devDeps[`dev-package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
				devDependencies: devDeps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('dependency count'),
				);
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.strictEqual(meta.total, 105);
					assert.strictEqual(meta.dependencies, 60);
					assert.strictEqual(meta.devDependencies, 45);
				}
			}
		});

		test('should show breakdown in message', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};
			const devDeps: Record<string, string> = {};

			for (let i = 0; i < 30; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}
			for (let i = 0; i < 25; i++) {
				devDeps[`dev-package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
				devDependencies: devDeps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('dependency count'),
				);
				if (finding) {
					assert.ok(finding.message.includes('55 total'));
					assert.ok(finding.message.includes('30 prod'));
					assert.ok(finding.message.includes('25 dev'));
				}
			}
		});
	});

	suite('Version Conflict Detection', () => {
		test('should detect version conflicts', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					typescript: '^5.0.0',
				},
				devDependencies: {
					typescript: '^4.9.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const conflictFindings = result.data.filter((f) =>
					f.message.includes('Version conflict'),
				);
				assert.strictEqual(conflictFindings.length, 1);
				assert.strictEqual(conflictFindings[0].type, 'warning');
				assert.strictEqual(conflictFindings[0].dependency, 'typescript');
				assert.ok(conflictFindings[0].tags?.includes(FINDING_TAGS.DUPLICATION));
			}
		});

		test('should detect multiple version conflicts', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					typescript: '^5.0.0',
					lodash: '^4.17.0',
				},
				devDependencies: {
					typescript: '^4.9.0',
					lodash: '^4.16.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const conflictFindings = result.data.filter((f) =>
					f.message.includes('Version conflict'),
				);
				assert.strictEqual(conflictFindings.length, 2);
			}
		});

		test('should not flag same versions in both fields', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					typescript: '^5.0.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const conflictFindings = result.data.filter((f) =>
					f.message.includes('Version conflict'),
				);
				assert.strictEqual(conflictFindings.length, 0);
			}
		});

		test('should include version details in metadata', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					react: '^18.0.0',
				},
				devDependencies: {
					react: '^17.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('Version conflict'),
				);
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.strictEqual(meta.dependencyVersion, '^18.0.0');
					assert.strictEqual(meta.devDependencyVersion, '^17.0.0');
				}
			}
		});

		test('should not flag when package only in dependencies', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					express: '^4.18.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const conflictFindings = result.data.filter((f) =>
					f.message.includes('Version conflict'),
				);
				assert.strictEqual(conflictFindings.length, 0);
			}
		});
	});

	suite('Heavy Dependency Detection', () => {
		test('should detect lodash as heavy dependency', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({}, { lodash: '^4.17.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const heavyFindings = result.data.filter((f) =>
					f.message.includes('heavy dependency'),
				);
				assert.ok(heavyFindings.length > 0);
				const lodashFinding = heavyFindings.find(
					(f) => f.dependency === 'lodash',
				);
				if (lodashFinding) {
					assert.strictEqual(lodashFinding.type, 'info');
					assert.ok(lodashFinding.message.includes('lodash-es'));
					assert.ok(lodashFinding.tags?.includes(FINDING_TAGS.PERFORMANCE));
				}
			}
		});

		test('should detect moment-timezone as heavy dependency', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({}, { 'moment-timezone': '^0.5.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const heavyFindings = result.data.filter(
					(f) => f.dependency === 'moment-timezone',
				);
				assert.ok(heavyFindings.length > 0);
				if (heavyFindings[0]) {
					assert.ok(heavyFindings[0].message.includes('date-fns-tz'));
					assert.ok(heavyFindings[0].message.includes('Luxon'));
				}
			}
		});

		test('should detect axios as heavy dependency', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({}, { axios: '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const heavyFindings = result.data.filter(
					(f) => f.dependency === 'axios',
				);
				assert.ok(heavyFindings.length > 0);
				if (heavyFindings[0]) {
					assert.ok(heavyFindings[0].message.includes('fetch'));
					assert.ok(heavyFindings[0].message.includes('ky'));
				}
			}
		});

		test('should detect multiple heavy dependencies', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext(
				{},
				{
					lodash: '^4.17.0',
					axios: '^1.0.0',
					'moment-timezone': '^0.5.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const heavyFindings = result.data.filter((f) =>
					f.message.includes('heavy dependency'),
				);
				assert.strictEqual(heavyFindings.length, 3);
			}
		});

		test('should include alternative and reason in metadata', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({}, { lodash: '^4.17.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) => f.dependency === 'lodash');
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.ok(meta.alternative);
					assert.ok(meta.reason);
				}
			}
		});

		test('should not flag lightweight dependencies', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext(
				{},
				{
					express: '^4.18.0',
					react: '^18.0.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const heavyFindings = result.data.filter((f) =>
					f.message.includes('heavy dependency'),
				);
				assert.strictEqual(heavyFindings.length, 0);
			}
		});
	});

	suite('Combined Analysis', () => {
		test('should detect all types of issues together', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = { lodash: '^4.17.0' };
			const devDeps: Record<string, string> = { lodash: '^4.16.0' };

			for (let i = 0; i < 30; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}
			for (let i = 0; i < 25; i++) {
				devDeps[`dev-package-${i}`] = '^1.0.0';
			}

			const context = createContext(
				{
					dependencies: deps,
					devDependencies: devDeps,
				},
				{ ...deps, ...devDeps },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.ok(result.data.length >= 2);
			}
		});

		test('should accumulate findings from all checks', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext(
				{
					dependencies: {
						lodash: '^4.17.0',
						axios: '^1.0.0',
					},
					devDependencies: {
						lodash: '^4.16.0',
					},
				},
				{
					lodash: '^4.17.0',
					axios: '^1.0.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const conflictFindings = result.data.filter((f) =>
					f.message.includes('Version conflict'),
				);
				const heavyFindings = result.data.filter((f) =>
					f.message.includes('heavy dependency'),
				);
				assert.ok(conflictFindings.length > 0);
				assert.ok(heavyFindings.length > 0);
			}
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty dependencies', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle missing dependencies fields', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle only dependencies field', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					express: '^4.18.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle only devDependencies field', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				devDependencies: {
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle exactly at threshold', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};

			for (let i = 0; i < 50; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle clean package with no issues', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: {
					express: '^4.18.0',
					react: '^18.0.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
					jest: '^29.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});
	});

	suite('Dependency Tags', () => {
		test('should tag dependency count findings correctly', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const deps: Record<string, string> = {};

			for (let i = 0; i < 60; i++) {
				deps[`package-${i}`] = '^1.0.0';
			}

			const context = createContext({
				dependencies: deps,
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success && result.data.length > 0) {
				const finding = result.data[0];
				assert.ok(finding.tags?.includes(FINDING_TAGS.DEPENDENCIES));
			}
		});

		test('should tag version conflicts with duplication', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({
				dependencies: { lodash: '^4.17.0' },
				devDependencies: { lodash: '^4.16.0' },
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('Version conflict'),
				);
				if (finding) {
					assert.ok(finding.tags?.includes(FINDING_TAGS.DUPLICATION));
				}
			}
		});

		test('should tag heavy dependencies with performance', async () => {
			const analyzer = createDependencyGraphAnalyzer();
			const context = createContext({}, { lodash: '^4.17.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) => f.dependency === 'lodash');
				if (finding) {
					assert.ok(finding.tags?.includes(FINDING_TAGS.PERFORMANCE));
				}
			}
		});
	});
});
