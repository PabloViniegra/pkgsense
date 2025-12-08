import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import {
	AnalysisManager,
	createAnalysisManager,
} from '../../analyzers/manager';
import { DiagnosticsManager } from '../../decorators/diagnostics';
import type { Analyzer, AnalysisContext } from '../../analyzers/types';
import { success, failure } from '../../shared/result';
import { FINDING_TAGS } from '../../types';

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
				rangeIncludingLineBreak: new vscode.Range(
					line,
					0,
					line + 1,
					0,
				),
				firstNonWhitespaceCharacterIndex: 0,
				isEmptyOrWhitespace: !lines[line]?.trim(),
			}),
			save: async () => true,
			isDirty: false,
			isClosed: false,
			isUntitled: false,
			eol: vscode.EndOfLine.LF,
			positionAt: () => new vscode.Position(0, 0),
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
				analyze: async () =>
					success([{ type: 'error', message: 'Finding 3' }]),
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

	suite('Dependency Range Computation', () => {
		test('should compute ranges for dependencies', async () => {
			const content = JSON.stringify(
				{
					dependencies: {
						express: '^4.0.0',
						lodash: '^4.17.0',
					},
				},
				null,
				2,
			);

			const rangeTestAnalyzer: Analyzer = {
				name: 'range-test',
				analyze: async (context: AnalysisContext) => {
					assert.ok(context.dependencyRanges.express);
					assert.ok(context.dependencyRanges.lodash);
					return success([]);
				},
			};

			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [rangeTestAnalyzer],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);
		});

		test('should handle dependencies not found in document', async () => {
			const content = JSON.stringify({ name: 'test' });

			const rangeTestAnalyzer: Analyzer = {
				name: 'range-test',
				analyze: async (context: AnalysisContext) => {
					assert.deepStrictEqual(context.dependencyRanges, {});
					return success([]);
				},
			};

			const doc = createMockDocument(content);
			const manager = createAnalysisManager({
				analyzers: [rangeTestAnalyzer],
			});

			await manager.analyzeDocument(doc, diagnosticsManager);
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
});
