import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
	addMetadataFieldCommand,
	editPackageJson,
	fixVulnerabilityCommand,
	removeDependencyCommand,
	updateDependencyCommand,
} from '../../commands/packageCommands';
import { npmRegistryCache } from '../../utils/cache';
import { stubFetch } from '../helpers/fakeFetch';

const registryUrl = (name: string) =>
	`https://registry.npmjs.org/${encodeURIComponent(name)}`;

/** Registry answer for a package whose latest dist-tag is `latest`. */
const publishLatest = (name: string, latest: string) =>
	stubFetch({
		[registryUrl(name)]: {
			body: { name, 'dist-tags': { latest }, versions: { [latest]: {} } },
		},
	});

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
		npmRegistryCache.clear();
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

		test('reports a failure and does not save when VS Code rejects the edit', async () => {
			const uri = vscode.Uri.file('/test/package.json');
			const document = createMockDocument(
				uri,
				JSON.stringify({ dependencies: { lodash: '^4.17.21' } }, null, 2),
			);
			const save = sinon.stub(document, 'save');

			openTextDocumentStub.resolves(document);
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(false);

			await removeDependencyCommand(uri, 'lodash');

			assert.strictEqual(save.callCount, 0);
			assert.strictEqual(showInformationMessageStub.callCount, 0);
			assert.deepStrictEqual(showErrorMessageStub.firstCall.args, [
				'Failed to remove dependency: VS Code rejected the edit',
			]);
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
		const openPackage = (packageJson: object): vscode.Uri => {
			const uri = vscode.Uri.file('/test/package.json');
			openTextDocumentStub.resolves(
				createMockDocument(uri, JSON.stringify(packageJson, null, 2)),
			);
			applyEditStub.resolves(true);
			withProgressStub.callsFake(async (_options, task) => task());
			return uri;
		};

		const writtenJson = (uri: vscode.Uri): unknown => {
			const edit: vscode.WorkspaceEdit = applyEditStub.getCall(0).args[0];
			return JSON.parse(edit.get(uri)[0].newText);
		};

		test('sets a caret range on the latest version published on npm', async () => {
			const uri = openPackage({ dependencies: { react: '^17.0.0' } });
			const registry = publishLatest('react', '18.2.0');

			await updateDependencyCommand(uri, 'react');

			assert.deepStrictEqual(registry.requested, [registryUrl('react')]);
			assert.deepStrictEqual(writtenJson(uri), {
				dependencies: { react: '^18.2.0' },
			});
			assert.deepStrictEqual(showInformationMessageStub.firstCall.args, [
				'Updated react to ^18.2.0',
			]);
		});

		test('updates the package in every section that lists it', async () => {
			const uri = openPackage({
				dependencies: { typescript: '^4.9.0' },
				devDependencies: { typescript: '^4.9.0', mocha: '^10.0.0' },
			});
			publishLatest('typescript', '5.0.0');

			await updateDependencyCommand(uri, 'typescript');

			assert.deepStrictEqual(writtenJson(uri), {
				dependencies: { typescript: '^5.0.0' },
				devDependencies: { typescript: '^5.0.0', mocha: '^10.0.0' },
			});
		});

		test('warns with the registry error and leaves the file alone when the lookup fails', async () => {
			const uri = openPackage({ dependencies: { nonexistent: '^1.0.0' } });
			stubFetch({ [registryUrl('nonexistent')]: { status: 404, body: {} } });

			await updateDependencyCommand(uri, 'nonexistent');

			assert.strictEqual(applyEditStub.callCount, 0);
			assert.deepStrictEqual(showWarningMessageStub.firstCall.args, [
				'Could not fetch latest version for nonexistent: Package "nonexistent" not found in NPM registry',
			]);
		});

		test('warns when the package has no latest dist-tag', async () => {
			const uri = openPackage({ dependencies: { untagged: '^1.0.0' } });
			stubFetch({
				[registryUrl('untagged')]: {
					body: { name: 'untagged', 'dist-tags': {}, versions: {} },
				},
			});

			await updateDependencyCommand(uri, 'untagged');

			assert.strictEqual(applyEditStub.callCount, 0);
			assert.deepStrictEqual(showWarningMessageStub.firstCall.args, [
				'Could not fetch latest version for untagged: No latest version found for package untagged',
			]);
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
		const projectWith = (lockfile: string | null): vscode.Uri => {
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgsense-fix-'));
			if (lockfile) {
				fs.writeFileSync(path.join(dir, lockfile), '');
			}
			return vscode.Uri.file(path.join(dir, 'package.json'));
		};

		const fakeTerminal = () => {
			const terminal = { show: sinon.stub(), sendText: sinon.stub() };
			createTerminalStub.returns(terminal);
			return terminal;
		};

		const offeredOptions = (): string[] =>
			showInformationMessageStub.firstCall.args.slice(1);

		test('runs npm audit fix in the directory of a package-lock.json', async () => {
			const uri = projectWith('package-lock.json');
			const terminal = fakeTerminal();
			showInformationMessageStub.resolves('Run npm audit fix');

			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			assert.deepStrictEqual(offeredOptions(), [
				'Run npm audit fix',
				'Update manually',
				'View on npm',
			]);
			assert.deepStrictEqual(createTerminalStub.firstCall.args, [
				{ name: 'npm audit fix', cwd: path.dirname(uri.fsPath) },
			]);
			assert.deepStrictEqual(terminal.sendText.firstCall.args, [
				'npm audit fix',
			]);
		});

		test('runs pnpm audit --fix for a pnpm project', async () => {
			const uri = projectWith('pnpm-lock.yaml');
			const terminal = fakeTerminal();
			showInformationMessageStub.resolves('Run pnpm audit --fix');

			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			assert.deepStrictEqual(terminal.sendText.firstCall.args, [
				'pnpm audit --fix',
			]);
		});

		test('does not offer an audit fix without a lockfile to fix', async () => {
			const uri = projectWith(null);

			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			assert.deepStrictEqual(offeredOptions(), [
				'Update manually',
				'View on npm',
			]);
		});

		test('does not offer to update a dependency whose vulnerability is in a package it pulls in', async () => {
			const uri = projectWith('package-lock.json');

			await fixVulnerabilityCommand(uri, 'express', false);

			assert.deepStrictEqual(offeredOptions(), [
				'Run npm audit fix',
				'View on npm',
			]);
		});

		test('updates the dependency when asked to update manually', async () => {
			const uri = vscode.Uri.file('/test/package.json');
			openTextDocumentStub.resolves(
				createMockDocument(
					uri,
					JSON.stringify({ dependencies: { 'vulnerable-pkg': '^1.0.0' } }),
				),
			);
			showInformationMessageStub.onFirstCall().resolves('Update manually');
			withProgressStub.callsFake(async (_options, task) => task());
			applyEditStub.resolves(true);
			publishLatest('vulnerable-pkg', '2.0.0');

			await fixVulnerabilityCommand(uri, 'vulnerable-pkg');

			assert.strictEqual(applyEditStub.callCount, 1);
			assert.deepStrictEqual(showInformationMessageStub.secondCall.args, [
				'Updated vulnerable-pkg to ^2.0.0',
			]);
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
	suite('editPackageJson', () => {
		test('changes only the edited value in a tab-indented file', () => {
			const original =
				'{\n\t"name": "app",\n\t"dependencies": { "react": "^17.0.0" }\n}\n';

			assert.strictEqual(
				editPackageJson(original, ['dependencies', 'react'], '^18.2.0'),
				'{\n\t"name": "app",\n\t"dependencies": { "react": "^18.2.0" }\n}\n',
			);
		});

		test('keeps CRLF line endings when adding a field', () => {
			const original = '{\r\n    "name": "app"\r\n}\r\n';

			assert.strictEqual(
				editPackageJson(original, ['license'], 'MIT'),
				'{\r\n    "name": "app",\r\n    "license": "MIT"\r\n}\r\n',
			);
		});

		test('removes the property when the value is undefined', () => {
			const original =
				'{\n  "devDependencies": {\n    "a": "1",\n    "b": "2"\n  }\n}';

			assert.strictEqual(
				editPackageJson(original, ['devDependencies', 'a'], undefined),
				'{\n  "devDependencies": {\n    "b": "2"\n  }\n}',
			);
		});
	});

	suite('Edits written by the commands', () => {
		const writtenText = (uri: vscode.Uri): string => {
			const edit: vscode.WorkspaceEdit = applyEditStub.getCall(0).args[0];
			const [textEdit] = edit.get(uri);
			return textEdit.newText;
		};

		const duplicated = {
			name: 'app',
			dependencies: { lodash: '^4.17.21', express: '^4.18.0' },
			devDependencies: { lodash: '^4.17.21', mocha: '^11.0.0' },
		};

		const open = (text: string): vscode.Uri => {
			const uri = vscode.Uri.file('/test/package.json');
			openTextDocumentStub.resolves(createMockDocument(uri, text));
			showTextDocumentStub.resolves({});
			applyEditStub.resolves(true);
			return uri;
		};

		test('removing a duplicate from devDependencies keeps the dependencies entry', async () => {
			const uri = open(JSON.stringify(duplicated, null, 2));

			await removeDependencyCommand(uri, 'lodash', 'devDependencies');

			assert.deepStrictEqual(JSON.parse(writtenText(uri)), {
				name: 'app',
				dependencies: { lodash: '^4.17.21', express: '^4.18.0' },
				devDependencies: { mocha: '^11.0.0' },
			});
		});

		test('removing without a section removes the package everywhere', async () => {
			const uri = open(JSON.stringify(duplicated, null, 2));

			await removeDependencyCommand(uri, 'lodash');

			assert.deepStrictEqual(JSON.parse(writtenText(uri)), {
				name: 'app',
				dependencies: { express: '^4.18.0' },
				devDependencies: { mocha: '^11.0.0' },
			});
		});

		test('warns instead of editing when the package is not in the given section', async () => {
			const uri = open(JSON.stringify(duplicated, null, 2));

			await removeDependencyCommand(uri, 'express', 'devDependencies');

			assert.strictEqual(applyEditStub.callCount, 0);
			assert.strictEqual(showWarningMessageStub.callCount, 1);
		});

		test('does not reformat a tab-indented file', async () => {
			const original = `${JSON.stringify(duplicated, null, '\t')}\n`;
			const uri = open(original);

			await removeDependencyCommand(uri, 'mocha', 'devDependencies');

			assert.strictEqual(
				writtenText(uri),
				original.replace(',\n\t\t"mocha": "^11.0.0"', ''),
			);
		});

		test('adding a metadata field keeps the file formatting', async () => {
			const original = `${JSON.stringify({ name: 'app' }, null, '\t')}\n`;
			const uri = open(original);

			await addMetadataFieldCommand(uri, 'description');

			const written = writtenText(uri);
			assert.ok(written.startsWith('{\n\t"name": "app",\n\t"description": '));
			assert.ok(written.endsWith('\n}\n'));
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
