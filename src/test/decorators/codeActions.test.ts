import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import { PackageCodeActionProvider } from '../../decorators/codeActions';
import { CONSTANTS } from '../../shared/constants';

suite('PackageCodeActionProvider Test Suite', () => {
	let provider: PackageCodeActionProvider;

	setup(() => {
		provider = new PackageCodeActionProvider();
	});

	suite('File Name Filtering', () => {
		test('should provide actions for package.json files', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'duplicate dependency found',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions !== undefined);
		});

		test('should not provide actions for non-package.json files', () => {
			// Arrange
			const document = createMockDocument('/test/tsconfig.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Some error',
				vscode.DiagnosticSeverity.Error,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.strictEqual(actions, undefined);
		});

		test('should not provide actions for other JSON files', () => {
			// Arrange
			const document = createMockDocument('/test/config.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Error',
				vscode.DiagnosticSeverity.Error,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.strictEqual(actions, undefined);
		});
	});

	suite('Diagnostic Source Filtering', () => {
		test('should provide actions only for pkgsense diagnostics', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const pkgsenseDiag = createMockDiagnostic(
				'duplicate',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const otherDiag = createMockDiagnostic(
				'duplicate',
				vscode.DiagnosticSeverity.Warning,
				'other-extension',
			);
			const context = createMockContext([pkgsenseDiag, otherDiag]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
		});

		test('should return undefined when no pkgsense diagnostics', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Error',
				vscode.DiagnosticSeverity.Error,
				'other-extension',
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.strictEqual(actions, undefined);
		});
	});

	suite('Deprecated Package Actions', () => {
		test('should create remove action for deprecated packages', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Deprecated package',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
			diagnostic.code = 'moment';
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].title, 'Remove deprecated dependency');
			assert.strictEqual(actions[0].kind, vscode.CodeActionKind.QuickFix);
			assert.strictEqual(actions[0].isPreferred, true);
			assert.ok(actions[0].command);
			assert.strictEqual(
				actions[0].command.command,
				'pkgsense.removeDependency',
			);
			assert.deepStrictEqual(actions[0].command.arguments, [
				document.uri,
				'moment',
			]);
		});

		test('should handle deprecated without package code', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Deprecated',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			// Command is not set when packageName is undefined
			assert.strictEqual(actions[0].command, undefined);
		});
	});

	suite('Duplicate Dependency Actions', () => {
		test('should create remove action for duplicate dependencies', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'duplicate dependency found',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.code = 'lodash';
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].title, 'Remove duplicate dependency');
			assert.strictEqual(actions[0].kind, vscode.CodeActionKind.QuickFix);
			assert.ok(actions[0].command);
			assert.strictEqual(
				actions[0].command.command,
				'pkgsense.removeDependency',
			);
		});
	});

	suite('Outdated Dependency Actions', () => {
		test('should create update action for outdated dependencies', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'update available for react',
				vscode.DiagnosticSeverity.Information,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.code = 'react';
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].title, 'Update to latest version');
			assert.strictEqual(actions[0].kind, vscode.CodeActionKind.QuickFix);
			assert.strictEqual(actions[0].isPreferred, true);
			assert.ok(actions[0].command);
			assert.strictEqual(
				actions[0].command.command,
				'pkgsense.updateDependency',
			);
			assert.deepStrictEqual(actions[0].command.arguments, [
				document.uri,
				'react',
			]);
		});
	});

	suite('Missing Metadata Actions', () => {
		test('should create add action for missing description', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			// Must contain 'missing' (lowercase) to trigger action AND 'Missing' (capital M) for regex
			const diagnostic = createMockDiagnostic(
				"missing recommended field - Missing 'description'",
				vscode.DiagnosticSeverity.Information,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].title, 'Add missing field');
			assert.ok(actions[0].command);
			assert.strictEqual(
				actions[0].command.command,
				'pkgsense.addMetadataField',
			);
			assert.deepStrictEqual(actions[0].command.arguments, [
				document.uri,
				'description',
			]);
		});

		test('should extract field name from various message formats', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			// Must contain 'missing' (lowercase) to trigger action AND 'Missing' (capital M) for regex
			const diagnostic = createMockDiagnostic(
				"missing - Missing 'author' field",
				vscode.DiagnosticSeverity.Information,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].command?.arguments?.[1], 'author');
		});

		test('should use default field name when pattern not matched', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'missing something',
				vscode.DiagnosticSeverity.Information,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions[0].command?.arguments?.[1], 'field');
		});
	});

	suite('Vulnerability Actions', () => {
		test('should create fix action for vulnerabilities', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'Critical vulnerability detected',
				vscode.DiagnosticSeverity.Error,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.code = 'vulnerable-pkg';
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 1);
			assert.strictEqual(actions[0].title, 'Fix vulnerability');
			assert.strictEqual(actions[0].kind, vscode.CodeActionKind.QuickFix);
			assert.strictEqual(actions[0].isPreferred, true);
			assert.ok(actions[0].command);
			assert.strictEqual(
				actions[0].command.command,
				'pkgsense.fixVulnerability',
			);
		});

		test('should only create vulnerability action for errors', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'vulnerability warning',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert - no vulnerability action for non-error
			assert.strictEqual(actions, undefined);
		});
	});

	suite('Multiple Actions', () => {
		test('should create multiple actions for multiple diagnostics', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diag1 = createMockDiagnostic(
				'duplicate',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const diag2 = createMockDiagnostic(
				'update available',
				vscode.DiagnosticSeverity.Information,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diag1, diag2]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.strictEqual(actions.length, 2);
		});

		test('should handle diagnostic with multiple matching patterns', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'duplicate and update available',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			diagnostic.code = 'pkg';
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert - both duplicate and update actions
			assert.ok(actions);
			assert.strictEqual(actions.length, 2);
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty diagnostics array', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const context = createMockContext([]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.strictEqual(actions, undefined);
		});

		test('should attach correct diagnostic to each action', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'duplicate',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert
			assert.ok(actions);
			assert.ok(actions[0].diagnostics);
			assert.strictEqual(actions[0].diagnostics.length, 1);
			assert.strictEqual(actions[0].diagnostics[0], diagnostic);
		});

		test('should handle diagnostic without code', () => {
			// Arrange
			const document = createMockDocument('/test/package.json');
			const range = new vscode.Range(0, 0, 0, 10);
			const diagnostic = createMockDiagnostic(
				'duplicate',
				vscode.DiagnosticSeverity.Warning,
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);
			const context = createMockContext([diagnostic]);

			// Act
			const actions = provider.provideCodeActions(document, range, context);

			// Assert - action created but with undefined package name
			assert.ok(actions);
			assert.strictEqual(actions[0].command?.arguments?.[1], undefined);
		});
	});
});

// Helper functions
function createMockDocument(fileName: string): vscode.TextDocument {
	return {
		uri: vscode.Uri.file(fileName),
		fileName: fileName,
		isUntitled: false,
		languageId: 'json',
		version: 1,
		isDirty: false,
		isClosed: false,
		save: async () => true,
		eol: vscode.EndOfLine.LF,
		lineCount: 10,
		lineAt: () => ({}) as vscode.TextLine,
		offsetAt: () => 0,
		positionAt: () => new vscode.Position(0, 0),
		getText: () => '{}',
		getWordRangeAtPosition: () => undefined,
		validateRange: (range: vscode.Range) => range,
		validatePosition: (pos: vscode.Position) => pos,
	} as unknown as vscode.TextDocument;
}

function createMockDiagnostic(
	message: string,
	severity: vscode.DiagnosticSeverity,
	source: string,
): vscode.Diagnostic {
	const diagnostic = new vscode.Diagnostic(
		new vscode.Range(0, 0, 0, 10),
		message,
		severity,
	);
	diagnostic.source = source;
	return diagnostic;
}

function createMockContext(
	diagnostics: vscode.Diagnostic[],
): vscode.CodeActionContext {
	return {
		diagnostics,
		only: undefined,
		triggerKind: vscode.CodeActionTriggerKind.Automatic,
	};
}
