import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import {
	createWeightAnalyzer,
	type WeightAnalyzerDeps,
} from '../../analyzers/weightAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import { success, failure } from '../../shared/result';
import type { BundlephobiaInfo } from '../../utils/bundlephobia';
import { CONSTANTS } from '../../shared/constants';

suite('WeightAnalyzer Test Suite', () => {
	const createContext = (
		allDependencies: Record<string, string>,
		dependencyRanges: Readonly<Record<string, import('../../analyzers/types').LineRange>> = {},
	): AnalysisContext => ({
		packageJson: {},
		allDependencies,
		dependencyRanges,
		workspacePath: '/test',
	});

	suite('Package Size Categorization', () => {
		test('should categorize very large packages as error', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: 2 * 1024 * 1024,
						gzip: 500 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'large-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'error');
				assert.ok(findings[0].message.includes('Very heavy package'));
				assert.ok(findings[0].message.includes('large-package'));
				assert.strictEqual(findings[0].dependency, 'large-package');
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.PERFORMANCE));
			}
		});

		test('should categorize medium packages as warning', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: 500 * 1024,
						gzip: 150 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'medium-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
				assert.ok(findings[0].message.includes('Heavy package'));
			}
		});

		test('should categorize small-medium packages as info', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: 100 * 1024,
						gzip: 30 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'small-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
				assert.ok(findings[0].message.includes('Moderately large package'));
			}
		});

		test('should not flag very small packages', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: 10 * 1024,
						gzip: 3 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'tiny-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 0);
			}
		});
	});

	suite('Threshold Boundaries', () => {
		test('should categorize at exact large threshold', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD + 1,
						gzip: 300 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'boundary-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings[0].type, 'error');
			}
		});

		test('should categorize at exact medium threshold', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD + 1,
						gzip: 60 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'boundary-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings[0].type, 'warning');
			}
		});

		test('should categorize at exact small threshold', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD + 1,
						gzip: 15 * 1024,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'boundary-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings[0].type, 'info');
			}
		});
	});

	suite('Multiple Dependencies', () => {
		test('should analyze multiple packages in parallel', async () => {
			let callCount = 0;
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async (name: string) => {
					callCount++;
					const sizes: Record<string, number> = {
						'package-a': 2 * 1024 * 1024,
						'package-b': 500 * 1024,
						'package-c': 10 * 1024,
					};
					return success({
						size: sizes[name] || 0,
						gzip: 0,
					});
				},
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({
				'package-a': '^1.0.0',
				'package-b': '^2.0.0',
				'package-c': '^3.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(callCount, 3);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 2);
			}
		});

		test('should handle mixed success and failure', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async (name: string) => {
					if (name === 'failing-package') {
						return failure('API error');
					}
					return success({ size: 2 * 1024 * 1024, gzip: 0 });
				},
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({
				'good-package': '^1.0.0',
				'failing-package': '^1.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].dependency, 'good-package');
			}
		});
	});

	suite('Error Handling', () => {
		test('should handle API failures gracefully', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () => failure('Network error'),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'error-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle empty dependencies', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () => success({ size: 0, gzip: 0 }),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle all packages failing', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () => failure('Service unavailable'),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({
				'package-a': '^1.0.0',
				'package-b': '^2.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});
	});

	suite('Range Integration', () => {
		test('should include ranges when provided', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({ size: 2 * 1024 * 1024, gzip: 0 }),
			};

			const testRange = {
				startLine: 5,
				startCharacter: 10,
				endLine: 5,
				endCharacter: 20,
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext(
				{ 'package-a': '^1.0.0' },
				{ 'package-a': testRange },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
				assert.ok(findings[0].range instanceof vscode.Range);
				if (findings[0].range instanceof vscode.Range) {
					assert.strictEqual(findings[0].range.start.line, 5);
					assert.strictEqual(findings[0].range.start.character, 10);
				}
			}
		});

		test('should work without ranges', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({ size: 2 * 1024 * 1024, gzip: 0 }),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'package-a': '^1.0.0' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('Size Formatting', () => {
		test('should format size in KB correctly', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({
						size: 1536 * 1024,
						gzip: 0,
					}),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'package-a': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.ok(findings[0].message.includes('1536.0 KB'));
			}
		});

		test('should include package version in message', async () => {
			const mockDeps: WeightAnalyzerDeps = {
				fetchPackageSize: async () =>
					success({ size: 2 * 1024 * 1024, gzip: 0 }),
			};

			const analyzer = createWeightAnalyzer(mockDeps);
			const context = createContext({ 'package-a': '^3.14.159' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.ok(findings[0].message.includes('package-a@^3.14.159'));
			}
		});
	});
});
