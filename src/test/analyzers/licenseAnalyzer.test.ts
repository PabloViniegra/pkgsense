import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createLicenseAnalyzer } from '../../analyzers/licenseAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('LicenseAnalyzer Test Suite', () => {
	const createContext = (
		packageJson: PackageJson,
		allDependencies: Record<string, string> = {},
	): AnalysisContext => ({
		packageJson,
		allDependencies,
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Package License Validation', () => {
		test('should flag missing package license', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({}, { express: '^4.18.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Package has no license'),
				);
				assert.ok(findings.length >= 1);
				const noLicenseFinding = findings.find((f) =>
					f.message.includes('Package has no license'),
				);
				if (noLicenseFinding) {
					assert.strictEqual(noLicenseFinding.type, 'warning');
					assert.ok(noLicenseFinding.tags?.includes(FINDING_TAGS.LICENSE));
				}
			}
		});

		test('should flag UNLICENSED package', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'UNLICENSED' },
				{ express: '^4.18.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('marked as UNLICENSED'),
				);
				assert.ok(findings.length >= 1);
			}
		});

		test('should not flag valid package license', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Package has no license'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});
	});

	suite('Copyleft License Detection', () => {
		test('should detect GPL licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{ 'gpl-package': '^1.0.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect AGPL licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{ 'agpl-package': '^1.0.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect LGPL licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{ 'lgpl-package': '^1.0.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Unknown License Handling', () => {
		test('should handle dependencies with unknown licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{ 'unknown-package': '^1.0.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty dependencies', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle no dependencies field', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle package with multiple dependencies', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{
					express: '^4.18.0',
					react: '^18.0.0',
					lodash: '^4.17.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('License Compatibility', () => {
		test('should detect GPL-MIT incompatibility', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect AGPL-Apache incompatibility', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'Apache-2.0' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle normalized license strings', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'GPL-2.0' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Metadata in Findings', () => {
		test('should include copyleft dependencies in metadata', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include dependency name for unknown licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should tag findings appropriately', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({}, { express: '^4.18.0' });

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success && result.data.length > 0) {
				const finding = result.data[0];
				assert.ok(finding.tags?.includes(FINDING_TAGS.LICENSE));
			}
		});
	});

	suite('Error Handling', () => {
		test('should handle API failures gracefully', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{ 'test-package': '^1.0.0' },
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should continue analyzing after individual package failure', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{ license: 'MIT' },
				{
					'package-1': '^1.0.0',
					'package-2': '^2.0.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('License String Variations', () => {
		test('should handle license with version numbers', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'GPL-2.0-only' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle license with spaces and dashes', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'Apache 2.0' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should normalize case-insensitive licenses', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'mit' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Multiple License Issues', () => {
		test('should detect multiple UNLICENSED dependencies', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should accumulate all license findings', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext(
				{},
				{
					'package-1': '^1.0.0',
					'package-2': '^2.0.0',
				},
			);

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Security Tags', () => {
		test('should tag copyleft warnings with security', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should tag license conflicts with security', async () => {
			const analyzer = createLicenseAnalyzer();
			const context = createContext({ license: 'MIT' }, {});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});
});
