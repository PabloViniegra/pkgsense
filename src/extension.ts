import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	analyzePackageDocument,
	resetDefaultManager,
} from './analyzers/manager';
import {
	getAnalyzerConfiguration,
	hasAnalyzerConfigChanged,
} from './config/analyzerConfig';
import { PackageCodeActionProvider } from './decorators/codeActions';
import { DiagnosticsManager } from './decorators/diagnostics';
import {
	addMetadataFieldCommand,
	fixVulnerabilityCommand,
	removeDependencyCommand,
	updateDependencyCommand,
} from './commands/packageCommands';
import { CONSTANTS } from './shared/constants';
import { Debouncer, SerialRunner } from './utils/scheduling';

type Analyze = (doc: vscode.TextDocument) => Promise<void>;

const isPackageJsonDocument = (doc: vscode.TextDocument) =>
	doc.languageId === 'json' &&
	path.basename(doc.fileName) === CONSTANTS.PACKAGE_JSON_FILENAME;

function registerCodeActions(context: vscode.ExtensionContext): void {
	// Register code action provider for inline suggestions
	const codeActionProvider = vscode.languages.registerCodeActionsProvider(
		{ language: 'json', pattern: `**/${CONSTANTS.PACKAGE_JSON_FILENAME}` },
		new PackageCodeActionProvider(),
		{
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		},
	);
	context.subscriptions.push(codeActionProvider);
}

function registerDocumentAnalysis(
	context: vscode.ExtensionContext,
	diagnostics: DiagnosticsManager,
): Analyze {
	// An analysis that finished after a newer one would overwrite fresh
	// diagnostics with stale ones, so analyses of a file never overlap
	const analyses = new SerialRunner();
	// Typing fires a change event per keystroke; each analysis spawns an audit
	// and queries the registry, so wait for a pause before running one
	const typing = new Debouncer(CONSTANTS.ANALYSIS_DEBOUNCE_MS);
	context.subscriptions.push(typing);

	const analyzeIfPackage = async (doc: vscode.TextDocument) => {
		if (!doc || !isPackageJsonDocument(doc)) return;
		const key = doc.uri.toString();
		typing.cancel(key);
		await analyses.run(key, () => analyzePackageDocument(doc, diagnostics));
	};

	const analyzeAfterPause = (doc: vscode.TextDocument) => {
		if (!isPackageJsonDocument(doc)) return;
		typing.schedule(doc.uri.toString(), () => analyzeIfPackage(doc));
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
		(e) => analyzeAfterPause(e.document),
		null,
		context.subscriptions,
	);

	return analyzeIfPackage;
}

function registerAnalyzeCommand(
	context: vscode.ExtensionContext,
	analyzeIfPackage: Analyze,
): void {
	// Register analyze command
	const analyzeCommand = vscode.commands.registerCommand(
		'pkgsense.analyze',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage(CONSTANTS.ERROR_NO_EDITOR);
				return;
			}
			await analyzeIfPackage(editor.document);
			vscode.window.showInformationMessage(CONSTANTS.INFO_ANALYSIS_COMPLETED);
		},
	);
	context.subscriptions.push(analyzeCommand);
}

function registerPackageCommands(context: vscode.ExtensionContext): void {
	// Register package modification commands
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'pkgsense.removeDependency',
			removeDependencyCommand,
		),
		vscode.commands.registerCommand(
			'pkgsense.updateDependency',
			updateDependencyCommand,
		),
		vscode.commands.registerCommand(
			'pkgsense.addMetadataField',
			addMetadataFieldCommand,
		),
		vscode.commands.registerCommand(
			'pkgsense.fixVulnerability',
			fixVulnerabilityCommand,
		),
	);
}

function registerReanalysisTriggers(
	context: vscode.ExtensionContext,
	diagnostics: DiagnosticsManager,
	analyzeIfPackage: Analyze,
): void {
	const reanalyzeActiveEditor = async () => {
		resetDefaultManager();
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			await analyzeIfPackage(editor.document);
		}
	};

	const configListener = vscode.workspace.onDidChangeConfiguration(
		async (event) => {
			if (!hasAnalyzerConfigChanged(event)) {
				return;
			}

			if (!getAnalyzerConfiguration().globalEnabled) {
				resetDefaultManager();
				diagnostics.clear();
				return;
			}

			await reanalyzeActiveEditor();
		},
	);
	context.subscriptions.push(configListener);

	// Audit and engine checks are held back until the workspace is trusted
	context.subscriptions.push(
		vscode.workspace.onDidGrantWorkspaceTrust(reanalyzeActiveEditor),
	);
}

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

	registerCodeActions(context);
	const analyzeIfPackage = registerDocumentAnalysis(context, diagnostics);

	if (vscode.window.activeTextEditor) {
		analyzeIfPackage(vscode.window.activeTextEditor.document);
	}

	registerAnalyzeCommand(context, analyzeIfPackage);
	registerPackageCommands(context);
	registerReanalysisTriggers(context, diagnostics, analyzeIfPackage);
}

/**
 * Deactivates the pkgsense extension.
 *
 * This function is called when the extension is deactivated by VS Code.
 * Currently no cleanup is required as the diagnostic manager is properly
 * disposed through the extension context subscriptions.
 */
export function deactivate() {}
