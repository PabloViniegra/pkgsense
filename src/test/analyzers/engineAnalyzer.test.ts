import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createEngineAnalyzer } from '../../analyzers/engineAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('EngineAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {},
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Node.js Version Validation', () => {
		test('should validate Node.js version requirement', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');
			const [major] = currentNodeVersion.split('.');

			const context = createContext({
				engines: {
					node: `>=${major}.0.0`,
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const nodeFindings = result.data.filter((f) =>
					f.message.includes('Node.js'),
				);
				assert.strictEqual(nodeFindings.length, 0);
			}
		});

		test('should flag Node.js version mismatch', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: '>=99.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const nodeFindings = result.data.filter((f) =>
					f.message.includes('Node.js version mismatch'),
				);
				assert.strictEqual(nodeFindings.length, 1);
				assert.strictEqual(nodeFindings[0].type, 'error');
				assert.ok(nodeFindings[0].tags?.includes(FINDING_TAGS.ENGINES));
				assert.ok(nodeFindings[0].tags?.includes(FINDING_TAGS.CONFIG));
			}
		});

		test('should handle caret range for Node.js version', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');
			const [major] = currentNodeVersion.split('.');

			const context = createContext({
				engines: {
					node: `^${major}.0.0`,
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle tilde range for Node.js version', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');

			const context = createContext({
				engines: {
					node: `~${currentNodeVersion}`,
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle exact Node.js version requirement', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');

			const context = createContext({
				engines: {
					node: currentNodeVersion,
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should include metadata in Node.js version mismatch', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: '>=99.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('Node.js version mismatch'),
				);
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.strictEqual(meta.required, '>=99.0.0');
					assert.strictEqual(meta.engine, 'node');
					assert.ok(meta.current);
				}
			}
		});
	});

	suite('npm Version Validation', () => {
		test('should flag npm version requirement', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					npm: '>=8.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const npmFindings = result.data.filter((f) =>
					f.message.includes('npm version'),
				);
				assert.strictEqual(npmFindings.length, 1);
				assert.strictEqual(npmFindings[0].type, 'info');
			}
		});

		test('should include npm version in metadata', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					npm: '>=7.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('npm version'),
				);
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.strictEqual(meta.required, '>=7.0.0');
					assert.strictEqual(meta.engine, 'npm');
				}
			}
		});

		test('should handle exact npm version', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					npm: '9.5.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const npmFindings = result.data.filter((f) =>
					f.message.includes('npm version'),
				);
				assert.strictEqual(npmFindings.length, 1);
			}
		});
	});

	suite('Peer Dependencies Validation', () => {
		test('should flag peer dependencies', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {
					react: '^18.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const peerFindings = result.data.filter((f) =>
					f.message.includes('peer'),
				);
				assert.strictEqual(peerFindings.length, 1);
				assert.strictEqual(peerFindings[0].type, 'info');
				assert.ok(peerFindings[0].tags?.includes(FINDING_TAGS.ENGINES));
				assert.ok(peerFindings[0].tags?.includes(FINDING_TAGS.DEPENDENCIES));
			}
		});

		test('should handle multiple peer dependencies', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {
					react: '^18.0.0',
					'react-dom': '^18.0.0',
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const peerFindings = result.data.filter((f) =>
					f.message.includes('peer'),
				);
				assert.strictEqual(peerFindings.length, 1);
				assert.ok(peerFindings[0].message.includes('3 peer dependencies'));
			}
		});

		test('should handle single peer dependency', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {
					vue: '^3.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const peerFindings = result.data.filter((f) =>
					f.message.includes('peer'),
				);
				assert.strictEqual(peerFindings.length, 1);
				assert.ok(peerFindings[0].message.includes('1 peer dependency'));
				assert.ok(peerFindings[0].message.includes('it is'));
			}
		});

		test('should include peer dependencies in metadata', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {
					react: '^18.0.0',
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) => f.message.includes('peer'));
				if (finding) {
					assert.ok(finding.meta);
					const meta = finding.meta as Record<string, unknown>;
					assert.ok(meta.peerDependencies);
				}
			}
		});

		test('should not flag when no peer dependencies', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const peerFindings = result.data.filter((f) =>
					f.message.includes('peer'),
				);
				assert.strictEqual(peerFindings.length, 0);
			}
		});

		test('should handle empty peer dependencies object', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const peerFindings = result.data.filter((f) =>
					f.message.includes('peer'),
				);
				assert.strictEqual(peerFindings.length, 0);
			}
		});
	});

	suite('Combined Engines Validation', () => {
		test('should validate both Node.js and npm', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');
			const [major] = currentNodeVersion.split('.');

			const context = createContext({
				engines: {
					node: `>=${major}.0.0`,
					npm: '>=8.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const nodeFindings = result.data.filter((f) =>
					f.message.includes('Node.js'),
				);
				const npmFindings = result.data.filter((f) =>
					f.message.includes('npm'),
				);
				assert.ok(npmFindings.length > 0);
			}
		});

		test('should validate engines and peer dependencies together', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');
			const [major] = currentNodeVersion.split('.');

			const context = createContext({
				engines: {
					node: `>=${major}.0.0`,
				},
				peerDependencies: {
					react: '^18.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Edge Cases', () => {
		test('should handle missing engines field', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle empty engines object', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle complete package with all fields', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');
			const [major] = currentNodeVersion.split('.');

			const context = createContext({
				engines: {
					node: `>=${major}.0.0`,
					npm: '>=8.0.0',
				},
				peerDependencies: {
					react: '^18.0.0',
					typescript: '^5.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle invalid version ranges gracefully', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: 'invalid-version',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Version Range Formats', () => {
		test('should handle >= operator', async () => {
			const analyzer = createEngineAnalyzer();
			const currentNodeVersion = process.version.replace(/^v/, '');

			const context = createContext({
				engines: {
					node: `>=${currentNodeVersion}`,
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle > operator', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: '>14.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should handle complex range', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: '>=16.0.0 <20.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Error Message Content', () => {
		test('should include required and current versions in error', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					node: '>=99.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data.find((f) =>
					f.message.includes('Node.js version mismatch'),
				);
				if (finding) {
					assert.ok(finding.message.includes('>=99.0.0'));
					assert.ok(finding.message.includes('found'));
				}
			}
		});

		test('should provide helpful message for npm check', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				engines: {
					npm: '>=9.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data[0];
				assert.ok(finding.message.includes('verify'));
				assert.ok(finding.message.includes('npm --version'));
			}
		});

		test('should list all peer dependencies', async () => {
			const analyzer = createEngineAnalyzer();
			const context = createContext({
				peerDependencies: {
					react: '^18.0.0',
					'react-dom': '^18.0.0',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const finding = result.data[0];
				assert.ok(finding.message.includes('react'));
				assert.ok(finding.message.includes('react-dom'));
			}
		});
	});
});
