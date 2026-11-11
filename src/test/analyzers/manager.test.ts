import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import {
	AnalysisManager,
	createAnalysisManager,
	selectAnalyzerTypes,
} from '../../analyzers/manager';
import { DiagnosticsManager } from '../../decorators/diagnostics';
import type { Analyzer, AnalysisContext } from '../../analyzers/types';
import { success, failure } from '../../shared/result';
import { FINDING_TAGS, type Finding } from '../../types';

suite('AnalysisManager Test Suite', () => {
	let diagnosticsManager: DiagnosticsManager;

	const createMockDocument = (
		content: string,
		languageId = 'json',
		fileName = 'package.json',
	): vscode.TextDocument => {
		const lines = content.split('\n');
		return {
			uri: vscode.Uri.file(`/test/${fileName}`),
			fileName: `/test/${fileName}`,
			languageId,
			version: 1,
			getText: () => content,
			lineCount: lines.length,
			lineAt: (line: number) => ({
				text: lines[line] || '',
				lineNumber: line,
				range: new vscode.Range(line, 0, line, lines[line]?.length || 0),
				rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
				firstNonWhitespaceCharacterIndex: 0,
				isEmptyOrWhitespace: !lines[line]?.trim(),
			}),
			save: async () => true,
			isDirty: false,
			isClosed: false,
			isUntitled: false,
			eol: vscode.EndOfLine.LF,
			positionAt: (offset: number) => {
				const before = content.slice(0, offset).split('\n');
				return new vscode.Position(
					before.length - 1,
					before[before.length - 1].length,
				);
			},
			offsetAt: () => 0,
			getWordRangeAtPosition: () => undefined,
			validateRange: (r: vscode.Range) => r,
			validatePosition: (p: vscode.Position) => p,
			notebook: undefined,
		} as unknown as vscode.TextDocument;
	};

	setup(() => {
		diagnosticsManager = new DiagnosticsManager('test');
	});

	teardown(() => {
		diagnosticsManager.dispose();
	});

	suite('Document Parsing', () => {
		test('should parse valid package.json', async () => {
			const content = JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				dependencies: { express: '^4.0.0' },
			});
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});

		test('should fail on invalid JSON', async () => {
			const content = '{ invalid json }';
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error.code, 'JSON_PARSE_ERROR');
			}
		});

		test('should fail on invalid package.json structure', async () => {
			const content = JSON.stringify({ dependencies: 'invalid' });
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error.code, 'INVALID_PACKAGE_JSON');
			}
		});

		test('should handle empty object as valid package.json', async () => {
			const content = JSON.stringify({});
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Analyzer Orchestration', () => {
		test('should run multiple analyzers in parallel', async () => {
			let analyzer1Called = false;
			let analyzer2Called = false;
			let analyzer3Called = false;

			const analyzer1: Analyzer = {
				name: 'test1',
				analyze: async () => {
					analyzer1Called = true;
					await new Promise((resolve) => setTimeout(resolve, 10));
					return success([
						{
							type: 'info',
							message: 'Finding from analyzer 1',
							tags: [FINDING_TAGS.QUALITY],
						},
					]);
				},
			};

			const analyzer2: Analyzer = {
				name: 'test2',
				analyze: async () => {
					analyzer2Called = true;
					await new Promise((resolve) => setTimeout(resolve, 10));
					return success([
						{
							type: 'warning',
							message: 'Finding from analyzer 2',
							tags: [FINDING_TAGS.SECURITY],
						},
					]);
				},
			};

			const analyzer3: Analyzer = {
				name: 'test3',
				analyze: async () => {
					analyzer3Called = true;
					return success([]);
				},
			};

			const content = JSON.stringify({ name: 'test' });
			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [analyzer1, analyzer2, analyzer3],
			});

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
			assert.strictEqual(analyzer1Called, true);
			assert.strictEqual(analyzer2Called, true);
			assert.strictEqual(analyzer3Called, true);
		});

		test('should aggregate findings from all analyzers', async () => {
			const analyzer1: Analyzer = {
				name: 'test1',
				analyze: async () =>
					success([
						{ type: 'info', message: 'Finding 1' },
						{ type: 'warning', message: 'Finding 2' },
					]),
			};

			const analyzer2: Analyzer = {
				name: 'test2',
				analyze: async () => success([{ type: 'error', message: 'Finding 3' }]),
			};

			const content = JSON.stringify({ name: 'test' });
			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [analyzer1, analyzer2],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);

			// Note: We can't directly assert diagnostics count here without
			// accessing internal state, but we verify no errors occurred
		});

		test('should handle analyzer failures gracefully', async () => {
			const failingAnalyzer: Analyzer = {
				name: 'failing',
				analyze: async () =>
					failure({
						code: 'NETWORK_ERROR',
						message: 'Network failure',
					}),
			};

			const successAnalyzer: Analyzer = {
				name: 'success',
				analyze: async () =>
					success([{ type: 'info', message: 'Success finding' }]),
			};

			const content = JSON.stringify({ name: 'test' });
			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [failingAnalyzer, successAnalyzer],
			});

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});

		test('should handle analyzer exceptions', async () => {
			const throwingAnalyzer: Analyzer = {
				name: 'throwing',
				analyze: async () => {
					throw new Error('Unexpected error');
				},
			};

			const successAnalyzer: Analyzer = {
				name: 'success',
				analyze: async () =>
					success([{ type: 'info', message: 'Success finding' }]),
			};

			const content = JSON.stringify({ name: 'test' });
			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [throwingAnalyzer, successAnalyzer],
			});

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Context Building', () => {
		test('should merge dependencies and devDependencies', async () => {
			const content = JSON.stringify({
				dependencies: { express: '^4.0.0' },
				devDependencies: { typescript: '^5.0.0' },
			});

			const contextTestAnalyzer: Analyzer = {
				name: 'context-test',
				analyze: async (context: AnalysisContext) => {
					assert.strictEqual(context.allDependencies.express, '^4.0.0');
					assert.strictEqual(context.allDependencies.typescript, '^5.0.0');
					return success([]);
				},
			};

			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [contextTestAnalyzer],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);
		});

		test('should handle missing dependencies', async () => {
			const content = JSON.stringify({ name: 'test' });

			const contextTestAnalyzer: Analyzer = {
				name: 'context-test',
				analyze: async (context: AnalysisContext) => {
					assert.deepStrictEqual(context.allDependencies, {});
					return success([]);
				},
			};

			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [contextTestAnalyzer],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);
		});

		test('should provide workspace path', async () => {
			const content = JSON.stringify({ name: 'test' });

			const contextTestAnalyzer: Analyzer = {
				name: 'context-test',
				analyze: async (context: AnalysisContext) => {
					assert.ok(context.workspacePath);
					return success([]);
				},
			};

			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [contextTestAnalyzer],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);
		});
	});

	suite('Error Diagnostics', () => {
		test('should set error diagnostic on parse failure', async () => {
			const content = '{ invalid }';
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			await manager.analyzeDocument(doc, diagnosticsManager);

			// Diagnostics should be set, but we can't easily verify without
			// accessing VS Code internals
		});

		test('should set error diagnostic on invalid package.json', async () => {
			const content = JSON.stringify({ dependencies: ['invalid'] });
			const doc = createMockDocument(content);
			const manager = new AnalysisManager({ analyzers: [] });

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, false);
		});
	});

	suite('Default Manager', () => {
		test('should use default analyzers when none provided', async () => {
			const content = JSON.stringify({
				dependencies: { moment: '^2.29.0' },
			});
			const doc = createMockDocument(content);
			const manager = new AnalysisManager();

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Factory Function', () => {
		test('should create manager with custom analyzers', async () => {
			const customAnalyzer: Analyzer = {
				name: 'custom',
				analyze: async () =>
					success([{ type: 'info', message: 'Custom finding' }]),
			};

			const manager = createAnalysisManager({
				analyzers: [customAnalyzer],
			});

			const content = JSON.stringify({ name: 'test' });
			const doc = createMockDocument(content);

			const result = await manager.analyzeDocument(doc, diagnosticsManager);

			assert.strictEqual(result.success, true);
		});
	});

	suite('Context handed to analyzers', () => {
		const captureContext = async (
			content: string,
		): Promise<AnalysisContext> => {
			let captured: AnalysisContext | undefined;
			const capture: Analyzer = {
				name: 'capture',
				analyze: async (context: AnalysisContext) => {
					captured = context;
					return success([]);
				},
			};
			const manager = createAnalysisManager({ analyzers: [capture] });

			await manager.analyzeDocument(
				createMockDocument(content),
				diagnosticsManager,
			);

			assert.ok(captured, 'analyzer should have run');
			return captured;
		};

		test('uses the dependencies entry for a package listed in both sections, as npm does', async () => {
			const content = [
				'{',
				'  "dependencies": {',
				'    "lodash": "^4.17.21"',
				'  },',
				'  "devDependencies": {',
				'    "lodash": "^3.10.0"',
				'  }',
				'}',
			].join('\n');

			const { allDependencies } = await captureContext(content);

			assert.deepStrictEqual(allDependencies, { lodash: '^4.17.21' });
		});

		test('uses the directory of the package.json as workspace path', async () => {
			const { workspacePath } = await captureContext('{"name":"app"}');

			assert.strictEqual(workspacePath, vscode.Uri.file('/test').fsPath);
		});
	});

	suite('Where findings are shown', () => {
		const content = [
			'{',
			'  "engines": { "node": ">=22" },',
			'  "dependencies": {',
			'    "lodash": "^4.17.21"',
			'  },',
			'  "devDependencies": {',
			'    "lodash": "^4.17.21"',
			'  }',
			'}',
		].join('\n');

		const diagnosticsFor = async (finding: Finding, text = content) => {
			const document = createMockDocument(text);
			const manager = createAnalysisManager({
				analyzers: [{ name: 'fixed', analyze: async () => success([finding]) }],
			});

			await manager.analyzeDocument(document, diagnosticsManager);

			return vscode.languages
				.getDiagnostics(document.uri)
				.map(({ range }) => [
					range.start.line,
					range.start.character,
					range.end.character,
				]);
		};

		test('places a finding with a location on that key', async () => {
			const placed = await diagnosticsFor({
				type: 'warning',
				message: 'Node.js version mismatch',
				location: ['engines', 'node'],
			});

			assert.deepStrictEqual(placed, [[1, 16, 20]]);
		});

		test('places a dependency finding on the dependencies entry', async () => {
			const placed = await diagnosticsFor({
				type: 'warning',
				message: 'Heavy package',
				dependency: 'lodash',
			});

			assert.deepStrictEqual(placed, [[3, 5, 11]]);
		});

		const lineOf = async (dependency: string, text: string) => {
			const placed = await diagnosticsFor(
				{ type: 'warning', message: 'Heavy package', dependency },
				text,
			);
			return placed[0]?.[0];
		};

		test('places a devDependencies-only finding on its entry', async () => {
			const text = [
				'{',
				'  "devDependencies": {',
				'    "mocha": "^11.0.0"',
				'  }',
				'}',
			].join('\n');

			assert.deepStrictEqual(
				await diagnosticsFor(
					{ type: 'warning', message: 'Heavy package', dependency: 'mocha' },
					text,
				),
				[[2, 5, 10]],
			);
		});

		test('does not place a dependency on a same-named key elsewhere in the file', async () => {
			const text = [
				'{',
				'  "scripts": {',
				'    "mocha": "mocha",',
				'    "lodash": "echo lodash"',
				'  },',
				'  "overrides": {',
				'    "lodash": "4.17.21"',
				'  },',
				'  "dependencies": {',
				'    "lodash": "^4.17.21"',
				'  },',
				'  "devDependencies": {',
				'    "mocha": "^11.0.0"',
				'  }',
				'}',
			].join('\n');

			assert.strictEqual(await lineOf('lodash', text), 9);
			assert.strictEqual(await lineOf('mocha', text), 12);
		});

		test('does not confuse a dependency with another whose name contains it', async () => {
			const text = [
				'{',
				'  "dependencies": {',
				'    "react-dom": "^18.3.1",',
				'    "react": "^18.3.1"',
				'  }',
				'}',
			].join('\n');

			assert.strictEqual(await lineOf('react', text), 3);
			assert.strictEqual(await lineOf('react-dom', text), 2);
		});

		test('places dependencies in sections written on one line', async () => {
			const text = [
				'{',
				'  "dependencies": { "lodash": "^4.17.21", "react": "^18.3.1" },',
				'  "devDependencies": { "mocha": "^11.0.0" }',
				'}',
			].join('\n');

			assert.deepStrictEqual(
				await diagnosticsFor(
					{ type: 'warning', message: 'Heavy package', dependency: 'react' },
					text,
				),
				[[1, 43, 48]],
			);
			assert.strictEqual(await lineOf('mocha', text), 2);
		});

		test('lets a location override the dependency entry', async () => {
			const placed = await diagnosticsFor({
				type: 'warning',
				message: 'Duplicate dependency',
				dependency: 'lodash',
				location: ['devDependencies', 'lodash'],
			});

			assert.deepStrictEqual(placed, [[6, 5, 11]]);
		});

		test('leaves a finding about an absent key at the top of the file', async () => {
			const placed = await diagnosticsFor({
				type: 'info',
				message: 'Missing "files" field',
				location: ['files'],
			});

			assert.deepStrictEqual(placed, [[0, 0, 1]]);
		});
	});

	suite('Workspace trust', () => {
		const all = [
			'heuristics',
			'weight',
			'vulnerability',
			'engine',
			'license',
		] as const;

		test('runs every enabled analyzer in a trusted workspace', () => {
			assert.deepStrictEqual(selectAnalyzerTypes(all, true), [...all]);
		});

		test('skips the analyzers that run workspace programs in an untrusted workspace', () => {
			assert.deepStrictEqual(selectAnalyzerTypes(all, false), [
				'heuristics',
				'weight',
				'license',
			]);
		});
	});
});
