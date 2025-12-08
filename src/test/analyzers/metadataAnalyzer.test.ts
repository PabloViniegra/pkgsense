import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createMetadataAnalyzer } from '../../analyzers/metadataAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('MetadataAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {},
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Repository Field Validation', () => {
		test('should flag missing repository field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "repository"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.PACKAGING));
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.QUALITY));
			}
		});

		test('should not flag when repository is a string URL', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				repository: 'https://github.com/user/repo',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('repository'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should not flag when repository is an object with url', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				repository: {
					type: 'git',
					url: 'https://github.com/user/repo.git',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('repository'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should flag when repository URL is empty string', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				repository: '',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				// Empty string is treated as falsy, so it triggers "Missing" instead of "empty"
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "repository"'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});

		test('should flag when repository object has empty URL', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				repository: {
					type: 'git',
					url: '   ',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Repository URL is empty'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('Bugs Field Validation', () => {
		test('should flag missing bugs field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "bugs"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should not flag when bugs is a string URL', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				bugs: 'https://github.com/user/repo/issues',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) => f.message.includes('bugs'));
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should not flag when bugs is an object with url', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				bugs: {
					url: 'https://github.com/user/repo/issues',
					email: 'bugs@example.com',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) => f.message.includes('bugs'));
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should flag when bugs URL is empty', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				bugs: '',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				// Empty string is treated as falsy, so it triggers "Missing" instead of "empty"
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "bugs"'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('Homepage Field Validation', () => {
		test('should flag missing homepage field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "homepage"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should not flag when homepage exists', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				homepage: 'https://example.com',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('homepage'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});
	});

	suite('Description Field Validation', () => {
		test('should flag missing description field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "description"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
			}
		});

		test('should flag empty description', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				description: '',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				// Empty string is treated as falsy, so it triggers "Missing" instead of "empty"
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "description"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
			}
		});

		test('should flag very short description', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				description: 'Test',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Description is very short'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should not flag good description', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				description: 'A comprehensive package for testing purposes',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('description'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should handle whitespace-only description', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				description: '   ',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Description is empty'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('Keywords Field Validation', () => {
		test('should flag missing keywords field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "keywords"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should flag empty keywords array', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				keywords: [],
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Keywords array is empty'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});

		test('should not flag when keywords exist', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				keywords: ['test', 'package', 'typescript'],
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('keywords'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});
	});

	suite('Author Field Validation', () => {
		test('should flag missing author field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "author"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should not flag when author is a string', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				author: 'John Doe <john@example.com>',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('author'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should not flag when author is object with name', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				author: {
					name: 'John Doe',
					email: 'john@example.com',
					url: 'https://example.com',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('author'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should flag when author object missing name', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				author: {
					name: '',
					email: 'john@example.com',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Author name is missing'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('License Field Validation', () => {
		test('should flag missing license field', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Missing "license"'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.LICENSE));
			}
		});

		test('should flag UNLICENSED license', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				license: 'UNLICENSED',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('unlicensed'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
			}
		});

		test('should not flag valid license', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				license: 'MIT',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.toLowerCase().includes('license'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});
	});

	suite('Complete Package Validation', () => {
		test('should have no findings for complete package', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				name: 'test-package',
				version: '1.0.0',
				description: 'A well-documented test package for comprehensive testing',
				keywords: ['test', 'package'],
				author: 'John Doe',
				license: 'MIT',
				repository: 'https://github.com/user/repo',
				bugs: 'https://github.com/user/repo/issues',
				homepage: 'https://example.com',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should accumulate all findings for empty package', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.ok(result.data.length >= 7);
			}
		});

		test('should handle minimal valid package', async () => {
			const analyzer = createMetadataAnalyzer();
			const context = createContext({
				name: 'minimal-package',
				version: '0.0.1',
				description: 'Minimal package description for testing',
				license: 'ISC',
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data;
				assert.ok(findings.length > 0);
				assert.ok(findings.some((f) => f.message.includes('repository')));
				assert.ok(findings.some((f) => f.message.includes('keywords')));
			}
		});
	});
});
