import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
	removeDependencyCommand,
	updateDependencyCommand,
	addMetadataFieldCommand,
	fixVulnerabilityCommand,
} from '../../commands/packageCommands';

suite('PackageCommands Test Suite', () => {
	let openTextDocumentStub: sinon.SinonStub;
	let showTextDocumentStub: sinon.SinonStub;
	let applyEditStub: sinon.SinonStub;
	let showInformationMessageStub: sinon.SinonStub;
	let showWarningMessageStub: sinon.SinonStub;
	let showErrorMessageStub: sinon.SinonStub;
	let createTerminalStub: sinon.SinonStub;
	let openExternalStub: sinon.SinonStub;
	let withProgressStub: sinon.SinonStub;
	let fetchStub: sinon.SinonStub;

	setup(() => {
		openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
		showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument');
		applyEditStub = sinon.stub(vscode.workspace, 'applyEdit');
		showInformationMessageStub = sinon.stub(
			vscode.window,
			'showInformationMessage',
		);
		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
		showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
		createTerminalStub = sinon.stub(vscode.window, 'createTerminal');
		openExternalStub = sinon.stub(vscode.env, 'openExternal');
		withProgressStub = sinon.stub(vscode.window, 'withProgress');
		fetchStub = sinon.stub(global, 'fetch');
	});

	teardown(() => {
		sinon.restore();
	});

	suite('removeDependencyCommand', () => {
		test('should remove dependency from dependencies', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					lodash: '^4.17.21',
					express: '^4.18.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(true);

			// Act
			await removeDependencyCommand(uri, 'lodash');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
			assert.ok(
				showInformationMessageStub
					.getCall(0)
					.args[0].includes('Removed lodash'),
			);
		});

		test('should remove dependency from devDependencies', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				devDependencies: {
					typescript: '^5.0.0',
					jest: '^29.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(true);

			// Act
			await removeDependencyCommand(uri, 'typescript');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
		});

		test('should remove from both dependencies and devDependencies', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					lodash: '^4.17.21',
				},
				devDependencies: {
					lodash: '^4.17.21',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(true);

			// Act
			await removeDependencyCommand(uri, 'lodash');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
		});

		test('should show warning if dependency not found', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					lodash: '^4.17.21',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});

			// Act
			await removeDependencyCommand(uri, 'nonexistent');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 0);
			assert.strictEqual(showWarningMessageStub.callCount, 1);
			assert.ok(
				showWarningMessageStub
					.getCall(0)
					.args[0].includes('nonexistent not found'),
			);
		});

		test('should handle invalid JSON gracefully', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const document = createMockDocument(uri, 'invalid json');

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});

			// Act
			await removeDependencyCommand(uri, 'lodash');

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 1);
			assert.ok(
				showErrorMessageStub.getCall(0).args[0].includes('Failed to remove'),
			);
		});

		test('should handle missing dependencies object', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});

			// Act
			await removeDependencyCommand(uri, 'lodash');

			// Assert
			assert.strictEqual(showWarningMessageStub.callCount, 1);
		});
	});

	suite('updateDependencyCommand', () => {
		test('should update dependency to latest version', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					react: '^17.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.resolves({
				ok: true,
				json: async () => ({
					'dist-tags': {
						latest: '18.2.0',
					},
				}),
			});

			// Act
			await updateDependencyCommand(uri, 'react');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
			assert.ok(
				showInformationMessageStub
					.getCall(0)
					.args[0].includes('Updated react to ^18.2.0'),
			);
		});

		test('should update devDependency', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				devDependencies: {
					typescript: '^4.9.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.resolves({
				ok: true,
				json: async () => ({
					'dist-tags': {
						latest: '5.0.0',
					},
				}),
			});

			// Act
			await updateDependencyCommand(uri, 'typescript');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
		});

		test('should handle npm registry fetch failure', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					react: '^17.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.resolves({
				ok: false,
			});

			// Act
			await updateDependencyCommand(uri, 'react');

			// Assert
			assert.strictEqual(showWarningMessageStub.callCount, 1);
			assert.ok(
				showWarningMessageStub
					.getCall(0)
					.args[0].includes('Could not fetch latest version'),
			);
		});

		test('should handle fetch timeout', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					react: '^17.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.rejects(new Error('Timeout'));

			// Act
			await updateDependencyCommand(uri, 'react');

			// Assert - fetch errors are caught and return null, triggering a warning
			assert.strictEqual(showWarningMessageStub.callCount, 1);
		});

		test('should handle package not found', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					nonexistent: '^1.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.resolves({
				ok: true,
				json: async () => ({}),
			});

			// Act
			await updateDependencyCommand(uri, 'nonexistent');

			// Assert
			assert.strictEqual(showWarningMessageStub.callCount, 1);
		});
	});

	suite('addMetadataFieldCommand', () => {
		test('should add description field', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'description');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
			assert.ok(
				showInformationMessageStub
					.getCall(0)
					.args[0].includes("Added 'description'"),
			);
		});

		test('should add keywords field with default array', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'keywords');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
			assert.strictEqual(showInformationMessageStub.callCount, 1);
		});

		test('should add author field', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'author');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
		});

		test('should add license field', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'license');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
		});

		test('should add repository field with default object', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'repository');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
		});

		test('should handle unknown field with empty string', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			applyEditStub.resolves(true);

			// Act
			await addMetadataFieldCommand(uri, 'customField');

			// Assert
			assert.strictEqual(applyEditStub.callCount, 1);
		});

		test('should handle invalid JSON', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const document = createMockDocument(uri, 'invalid json');

			openTextDocumentStub.resolves(document);

			// Act
			await addMetadataFieldCommand(uri, 'description');

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 1);
		});
	});

	suite('fixVulnerabilityCommand', () => {
		test('should offer npm audit fix option', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const mockTerminal = {
				show: sinon.stub(),
				sendText: sinon.stub(),
			};

			showInformationMessageStub.resolves('Run npm audit fix');
			createTerminalStub.returns(mockTerminal);

			// Act
			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			// Assert
			assert.strictEqual(showInformationMessageStub.callCount, 1);
			assert.ok(
				showInformationMessageStub
					.getCall(0)
					.args[0].includes('vulnerable-pkg'),
			);
			assert.strictEqual(createTerminalStub.callCount, 1);
			assert.strictEqual(mockTerminal.show.callCount, 1);
			assert.strictEqual(mockTerminal.sendText.callCount, 1);
			assert.strictEqual(
				mockTerminal.sendText.getCall(0).args[0],
				'npm audit fix',
			);
		});

		test('should call update command for manual update', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				name: 'test-package',
				dependencies: {
					'vulnerable-pkg': '^1.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			showInformationMessageStub.resolves('Update manually');
			openTextDocumentStub.resolves(document);
			withProgressStub.callsFake(async (options, task) => {
				return task();
			});
			fetchStub.resolves({
				ok: true,
				json: async () => ({
					'dist-tags': {
						latest: '2.0.0',
					},
				}),
			});
			applyEditStub.resolves(true);

			// Act
			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			// Assert
			assert.strictEqual(showInformationMessageStub.callCount, 2);
		});

		test('should open npm page when requested', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');

			showInformationMessageStub.resolves('View on npm');
			openExternalStub.resolves(true);

			// Act
			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			// Assert
			assert.strictEqual(openExternalStub.callCount, 1);
			const calledUri = openExternalStub.getCall(0).args[0] as vscode.Uri;
			assert.strictEqual(
				calledUri.toString(),
				'https://www.npmjs.com/package/vulnerable-pkg',
			);
		});

		test('should handle user dismissing dialog', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');

			showInformationMessageStub.resolves(undefined);

			// Act
			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			// Assert
			assert.strictEqual(createTerminalStub.callCount, 0);
			assert.strictEqual(openExternalStub.callCount, 0);
		});

		test('should handle scoped package names', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');

			showInformationMessageStub.resolves('View on npm');
			openExternalStub.resolves(true);

			// Act
			await fixVulnerabilityCommand(uri, '@types/node');

			// Assert
			assert.strictEqual(openExternalStub.callCount, 1);
			const calledUri = openExternalStub.getCall(0).args[0] as vscode.Uri;
			// URI encoding converts @ to %40
			assert.ok(
				calledUri.toString().includes('@types/node') ||
					calledUri.toString().includes('%40types/node'),
			);
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty package.json', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const document = createMockDocument(uri, '{}');

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});

			// Act
			await removeDependencyCommand(uri, 'lodash');

			// Assert
			assert.strictEqual(showWarningMessageStub.callCount, 1);
		});

		test('should handle concurrent operations', async () => {
			// Arrange
			const uri = vscode.Uri.file('/test/package.json');
			const packageJson = {
				dependencies: {
					pkg1: '^1.0.0',
					pkg2: '^2.0.0',
				},
			};
			const document = createMockDocument(
				uri,
				JSON.stringify(packageJson, null, 2),
			);

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(true);

			// Act
			await Promise.all([
				removeDependencyCommand(uri, 'pkg1'),
				removeDependencyCommand(uri, 'pkg2'),
			]);

			// Assert - both operations should complete
			assert.strictEqual(applyEditStub.callCount, 2);
		});
	});
});

// Helper functions
function createMockDocument(
	uri: vscode.Uri,
	text: string,
): vscode.TextDocument {
	return {
		uri,
		fileName: uri.fsPath,
		isUntitled: false,
		languageId: 'json',
		version: 1,
		isDirty: false,
		isClosed: false,
		save: async () => true,
		eol: vscode.EndOfLine.LF,
		lineCount: text.split('\n').length,
		lineAt: (line: number) => ({}) as vscode.TextLine,
		offsetAt: (position: vscode.Position) => 0,
		positionAt: (offset: number) => new vscode.Position(0, 0),
		getText: () => text,
		getWordRangeAtPosition: () => undefined,
		validateRange: (range: vscode.Range) => range,
		validatePosition: (pos: vscode.Position) => pos,
	} as unknown as vscode.TextDocument;
}
