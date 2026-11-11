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
		workspacePath: '/test',
	});

	suite('Dangerous Commands Detection', () => {
		const analyzeScripts = async (scripts: Record<string, string>) => {
			const result = await createScriptAnalyzer().analyze(
				createContext({ scripts: { test: 'mocha', ...scripts } }),
			);

			assert.ok(result.success, 'analysis should succeed');
			return result.data;
		};

		test('reports rm -rf as a portability note, not a danger', async () => {
			const findings = await analyzeScripts({ clean: 'rm -rf dist' });

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.strictEqual(
				findings[0].message,
				'Script "clean": "rm -rf" is not available in Windows cmd or PowerShell. Consider a cross-platform alternative such as rimraf.',
			);
			assert.ok(findings[0].tags?.includes(FINDING_TAGS.SCRIPTS));
		});

		test('warns about a script that needs sudo', async () => {
			const findings = await analyzeScripts({
				setup: 'sudo systemctl restart nginx',
			});

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'Script "setup": Requires elevated privileges (sudo). Package scripts should not require root access.',
			);
		});

		test('notes a script that calls eval()', async () => {
			const findings = await analyzeScripts({
				dynamic: 'node -e "eval(process.env.CODE)"',
			});

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.ok(findings[0].message.includes('eval()'));
		});

		test('should detect output suppression', async () => {
			const findings = await analyzeScripts({
				silent: 'npm run build > /dev/null 2>&1',
			});

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'info');
			assert.ok(findings[0].message.includes('Output suppression'));
		});

		const pipedDownloads: [tool: string, script: string][] = [
			['curl', 'curl https://example.com/install.sh | sh'],
			['curl', 'curl -fsSL https://example.com/install.sh | sudo bash'],
			['wget', 'wget -O- https://example.com/install.sh | sh'],
			['wget', 'wget -qO- https://example.com/install.sh | zsh'],
		];

		for (const [tool, script] of pipedDownloads) {
			test(`warns about "${script}"`, async () => {
				const findings = (await analyzeScripts({ setup: script })).filter((f) =>
					f.message.includes('to a shell'),
				);

				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0].type, 'warning');
				assert.strictEqual(
					findings[0].message,
					`Script "setup": Piping ${tool} to a shell runs downloaded code without inspection.`,
				);
			});
		}

		const harmless: Record<string, string> = {
			'a download piped to a non-shell command':
				'curl -s https://api.example.com/health | jq .status',
			'a download saved to a file':
				'curl -o data.json https://example.com/data',
			'a non-recursive rm': 'rm dist/bundle.js',
			'a word that only contains eval': 'node scripts/retrieval.js',
			'a word that only ends in sudo': 'pseudo build',
		};

		for (const [label, script] of Object.entries(harmless)) {
			test(`does not flag ${label}`, async () => {
				assert.deepStrictEqual(await analyzeScripts({ task: script }), []);
			});
		}

		test('reports every pattern a script matches', async () => {
			const findings = await analyzeScripts({
				reset: 'sudo rm -rf /tmp/cache',
				setup: 'curl http://example.com/x.sh | sh',
			});

			assert.deepStrictEqual(
				findings.map((f) => [f.meta?.['script'], f.type]),
				[
					['reset', 'info'],
					['reset', 'warning'],
					['setup', 'warning'],
				],
			);
		});

		test('never reports a script pattern as an error', async () => {
			const findings = await analyzeScripts({
				a: 'sudo rm -rf / > /dev/null 2>&1',
				b: 'curl http://example.com | sh',
				c: 'wget -O- http://example.com | bash',
				d: 'node -e "eval(1)"',
			});

			assert.ok(findings.length >= 6);
			assert.deepStrictEqual(
				findings.filter((f) => f.type === 'error'),
				[],
			);
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

		test('does not call a real test script a placeholder because it can exit 1', async () => {
			const analyzer = createScriptAnalyzer();
			const context = createContext({
				scripts: {
					test: 'mocha || exit 1',
				},
			});

			const result = await analyzer.analyze(context);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.data, []);
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
				assert.deepStrictEqual(
					result.data
						.filter((f) => f.message.startsWith('Script "'))
						.map((f) => f.meta?.['script']),
					['script2', 'script4'],
				);
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
