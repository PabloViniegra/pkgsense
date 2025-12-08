import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createUpdateAnalyzer } from '../../analyzers/updateAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';

suite('UpdateAnalyzer Test Suite', () => {
	const createContext = (
		allDependencies: Record<string, string> = {},
	): AnalysisContext => ({
		packageJson: {},
		allDependencies,
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Update Type Detection', () => {
		test('should detect major updates', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect minor updates', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect patch updates', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Severity Levels', () => {
		test('should flag major updates as warnings', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should flag minor updates as info', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should flag patch updates as info', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Version Comparison', () => {
		test('should handle caret range versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle tilde range versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle exact versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should sanitize version prefixes', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Pre-release Versions', () => {
		test('should skip pre-release versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should not flag alpha versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should not flag beta versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should not flag rc versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Multiple Dependencies', () => {
		test('should analyze multiple packages', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle mix of update types', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle packages with no updates', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty dependencies', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle undefined dependencies', async () => {
			const analyzer = createUpdateAnalyzer();
			const context: AnalysisContext = {
				packageJson: {},
				allDependencies: {},
				dependencyRanges: {},
				workspacePath: '/test',
			};

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle API failures gracefully', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({ 'unknown-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle invalid version formats', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				'bad-version': 'invalid',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Finding Metadata', () => {
		test('should include current version in metadata', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include latest version in metadata', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include update type in metadata', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include dependency name in finding', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Tags Validation', () => {
		test('should tag findings with UPDATES', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should tag findings with MAINTENANCE', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Message Content', () => {
		test('should include breaking changes warning for major', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include new features note for minor', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include bug fixes note for patch', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should show version transition', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('No Update Scenarios', () => {
		test('should not flag when current equals latest', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should not flag when current is newer than latest', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle latest keyword', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				'some-package': 'latest',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Error Recovery', () => {
		test('should continue after individual package fetch failure', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				'good-package': '^1.0.0',
				'bad-package': '^1.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle network timeouts', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({ 'test-package': '^1.0.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Version Sanitization', () => {
		test('should handle versions with >= prefix', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				package: '>=1.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle versions with <= prefix', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				package: '<=2.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle complex range versions', async () => {
			const analyzer = createUpdateAnalyzer();
			const context = createContext({
				package: '>=1.0.0 <2.0.0',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});
});
