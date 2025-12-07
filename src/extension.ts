import * as vscode from 'vscode';
import { analyzePackageDocument } from './analyzers/manager';
import { DiagnosticsManager } from './decorators/diagnostics';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "pkgsense" is now active!');

	const diagnostics = new DiagnosticsManager('packageAnalyzer');
	context.subscriptions.push(diagnostics);

	const analyzeIfPackage = (doc: vscode.TextDocument) => {
		if (!doc) return;
		if (doc.languageId !== 'json') return;
		if (!doc.fileName.endsWith('package.json')) return;
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
				vscode.window.showErrorMessage('Open the package.json to analyze it');
				return;
			}
			analyzeIfPackage(editor.document);
			vscode.window.showInformationMessage('package.json analysis completed');
		},
	);
	context.subscriptions.push(disposable);
}

export function deactivate() {}
