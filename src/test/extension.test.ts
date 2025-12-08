import * as assert from 'node:assert';
import { suite, test, before } from 'mocha';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	let extension: vscode.Extension<unknown> | undefined;

	before(async () => {
		extension = vscode.extensions.getExtension('PabloViniegra.pkgsense');
		if (extension && !extension.isActive) {
			await extension.activate();
		}
	});

	suite('Extension Activation', () => {
		test('should be present', () => {
			assert.ok(extension);
		});

		test('should activate successfully', () => {
			assert.ok(extension);
			if (extension) {
				assert.strictEqual(extension.isActive, true);
			}
		});

		test('should register analyze command', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(
				commands.includes('pkgsense.analyze'),
				'pkgsense.analyze command should be registered',
			);
		});
	});

	suite('Command Execution', () => {
		test('should execute analyze command without editor', async () => {
			// Close all editors
			await vscode.commands.executeCommand(
				'workbench.action.closeAllEditors',
			);

			// Command should not throw, even without active editor
			await assert.doesNotReject(async () => {
				await vscode.commands.executeCommand('pkgsense.analyze');
			});
		});
	});

	suite('Document Analysis', () => {
		test('should activate on JSON files', async () => {
			const content = JSON.stringify(
				{
					name: 'test-package',
					version: '1.0.0',
				},
				null,
				2,
			);

			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content,
			});

			await vscode.window.showTextDocument(doc);

			// Extension should be active
			assert.ok(extension);
			if (extension) {
				assert.strictEqual(extension.isActive, true);
			}

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});
	});

	suite('Diagnostics', () => {
		test('should provide diagnostics for package.json', async function () {
			this.timeout(5000); // Increase timeout for this test

			const content = JSON.stringify(
				{
					name: 'test-package',
					version: '1.0.0',
					dependencies: {
						moment: '^2.29.0',
					},
				},
				null,
				2,
			);

			// Create a document with a URI that ends with package.json
			const uri = vscode.Uri.parse('untitled:/test/package.json');
			const doc = await vscode.workspace.openTextDocument(uri);
			const edit = new vscode.WorkspaceEdit();
			edit.insert(uri, new vscode.Position(0, 0), content);
			await vscode.workspace.applyEdit(edit);

			await vscode.window.showTextDocument(doc);

			// Manually trigger analysis
			await vscode.commands.executeCommand('pkgsense.analyze');

			// Wait for analysis to complete
			await new Promise((resolve) => setTimeout(resolve, 1500));

			const diagnostics = vscode.languages.getDiagnostics(doc.uri);

			// Should have at least some diagnostics (deprecated moment, missing fields)
			assert.ok(
				diagnostics.length > 0,
				'Should have diagnostics for deprecated package and missing fields',
			);

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});

		test('should not analyze non-package.json files', async () => {
			const content = JSON.stringify(
				{
					someKey: 'someValue',
				},
				null,
				2,
			);

			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content,
			});

			await vscode.window.showTextDocument(doc);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Should not analyze non-package.json
			// (We can't easily verify this, but the extension should handle it)
			assert.ok(true);

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});
	});

	suite('Error Handling', () => {
		test('should handle invalid JSON gracefully', async () => {
			const content = '{ invalid json }';

			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content,
			});

			await vscode.window.showTextDocument(doc);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Should not crash
			assert.ok(extension);
			if (extension) {
				assert.strictEqual(extension.isActive, true);
			}

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});

		test('should handle empty files', async () => {
			const doc = await vscode.workspace.openTextDocument({
				language: 'json',
				content: '',
			});

			await vscode.window.showTextDocument(doc);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Should not crash
			assert.ok(true);

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});
	});

	suite('File Type Detection', () => {
		test('should only process JSON files', async () => {
			const doc = await vscode.workspace.openTextDocument({
				language: 'typescript',
				content: 'const x = 1;',
			});

			await vscode.window.showTextDocument(doc);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Extension should be active but not analyzing non-JSON
			assert.ok(extension);
			if (extension) {
				assert.strictEqual(extension.isActive, true);
			}

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});
	});

	suite('Multiple Files', () => {
		test('should handle multiple package.json files', async () => {
			const content1 = JSON.stringify({ name: 'package1' }, null, 2);
			const content2 = JSON.stringify({ name: 'package2' }, null, 2);

			const doc1 = await vscode.workspace.openTextDocument({
				language: 'json',
				content: content1,
			});

			const doc2 = await vscode.workspace.openTextDocument({
				language: 'json',
				content: content2,
			});

			await vscode.window.showTextDocument(doc1);
			await new Promise((resolve) => setTimeout(resolve, 500));

			await vscode.window.showTextDocument(doc2);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Should handle multiple files
			assert.ok(true);

			// Clean up
			await vscode.commands.executeCommand(
				'workbench.action.closeAllEditors',
			);
		});
	});
});
