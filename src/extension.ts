import * as vscode from 'vscode';
import { analyzePackageDocument } from './analyzers/manager';
import { DiagnosticsManager } from './decorators/diagnostics';
import { CONSTANTS } from './shared/constants';

/**
 * Activates the pkgsense extension.
 *
 * This function is called when the extension is activated by VS Code.
 * It sets up the diagnostic manager, registers event listeners for
 * package.json files, and registers the analyze command.
 *
 * @param context - The extension context provided by VS Code
 *
 * @remarks
 * The extension automatically analyzes package.json files when:
 * - A package.json file is opened
 * - A package.json file is saved
 * - A package.json file is modified
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "pkgsense" is now active!');

	const diagnostics = new DiagnosticsManager(
		CONSTANTS.DIAGNOSTIC_COLLECTION_NAME,
	);
	context.subscriptions.push(diagnostics);

	const analyzeIfPackage = (doc: vscode.TextDocument) => {
		if (!doc) return;
		if (doc.languageId !== 'json') return;
		if (!doc.fileName.endsWith(CONSTANTS.PACKAGE_JSON_FILENAME)) return;
		analyzePackageDocument(doc, diagnostics);
	};

	vscode.workspace.onDidOpenTextDocument(
		analyzeIfPackage,
		null,
		context.subscriptions,
	);
	vscode.workspace.onDidSaveTextDocument(
		analyzeIfPackage,
		null,
		context.subscriptions,
	);
	vscode.workspace.onDidChangeTextDocument(
		(e) => analyzeIfPackage(e.document),
		null,
		context.subscriptions,
	);

	if (vscode.window.activeTextEditor) {
		analyzeIfPackage(vscode.window.activeTextEditor.document);
	}

	const disposable = vscode.commands.registerCommand(
		'pkgsense.analyze',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage(CONSTANTS.ERROR_NO_EDITOR);
				return;
			}
			analyzeIfPackage(editor.document);
			vscode.window.showInformationMessage(CONSTANTS.INFO_ANALYSIS_COMPLETED);
		},
	);
	context.subscriptions.push(disposable);
}

/**
 * Deactivates the pkgsense extension.
 *
 * This function is called when the extension is deactivated by VS Code.
 * Currently no cleanup is required as the diagnostic manager is properly
 * disposed through the extension context subscriptions.
 */
export function deactivate() {}
