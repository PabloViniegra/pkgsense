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

	// Register code action provider for inline suggestions
	const codeActionProvider = vscode.languages.registerCodeActionsProvider(
		{ language: 'json', pattern: `**/${CONSTANTS.PACKAGE_JSON_FILENAME}` },
		new PackageCodeActionProvider(),
		{
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		},
	);
	context.subscriptions.push(codeActionProvider);

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

	// Register analyze command
	const analyzeCommand = vscode.commands.registerCommand(
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
	context.subscriptions.push(analyzeCommand);

	// Register package modification commands
	const removeDependency = vscode.commands.registerCommand(
		'pkgsense.removeDependency',
		removeDependencyCommand,
	);
	context.subscriptions.push(removeDependency);

	const updateDependency = vscode.commands.registerCommand(
		'pkgsense.updateDependency',
		updateDependencyCommand,
	);
	context.subscriptions.push(updateDependency);

	const addMetadataField = vscode.commands.registerCommand(
		'pkgsense.addMetadataField',
		addMetadataFieldCommand,
	);
	context.subscriptions.push(addMetadataField);

	const fixVulnerability = vscode.commands.registerCommand(
		'pkgsense.fixVulnerability',
		fixVulnerabilityCommand,
	);
	context.subscriptions.push(fixVulnerability);

	// Register configuration change listener
	// Use a flag to prevent race conditions from rapid config changes
	let isReanalyzing = false;

	const configListener = vscode.workspace.onDidChangeConfiguration(
		async (event) => {
			// Only handle analyzer configuration changes
			if (!hasAnalyzerConfigChanged(event)) {
				return;
			}

			// Prevent concurrent re-analyses
			if (isReanalyzing) {
				return;
			}

			isReanalyzing = true;
			try {
				// Reset the analysis manager to pick up new configuration
				resetDefaultManager();

				// Get current configuration
				const config = getAnalyzerConfiguration();

				// If all analyzers are disabled, clear all diagnostics
				if (!config.globalEnabled) {
					diagnostics.clear();
					return;
				}

				// Re-analyze the current package.json if one is open
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					await analyzeIfPackage(editor.document);
				}
			} finally {
				isReanalyzing = false;
			}
		},
	);
	context.subscriptions.push(configListener);
}

/**
 * Deactivates the pkgsense extension.
 *
 * This function is called when the extension is deactivated by VS Code.
 * Currently no cleanup is required as the diagnostic manager is properly
 * disposed through the extension context subscriptions.
 */
export function deactivate() {}
