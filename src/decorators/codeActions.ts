import * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';
import { FINDING_TAGS } from '../types';

/**
 * Provides code actions (quick fixes) for package.json diagnostics.
 *
 * This class implements VS Code's CodeActionProvider interface to offer
 * inline suggestions with actionable buttons that can automatically fix
 * or improve package.json issues.
 *
 * @example
 * ```typescript
 * const provider = new PackageCodeActionProvider();
 * vscode.languages.registerCodeActionsProvider('json', provider);
 * ```
 */
export class PackageCodeActionProvider implements vscode.CodeActionProvider {
	/**
	 * Provide code actions for the given document and range.
	 *
	 * @param document - The document in which the command was invoked
	 * @param range - The range for which the command was invoked
	 * @param context - Context carrying additional information
	 * @returns Array of code actions or undefined
	 */
	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
		context: vscode.CodeActionContext,
	): vscode.CodeAction[] | undefined {
		// Only provide actions for package.json files
		if (!document.fileName.endsWith(CONSTANTS.PACKAGE_JSON_FILENAME)) {
			return undefined;
		}

		const actions: vscode.CodeAction[] = [];

		// Process each diagnostic at the current position
		for (const diagnostic of context.diagnostics) {
			if (diagnostic.source !== CONSTANTS.DIAGNOSTIC_SOURCE) {
				continue;
			}

			// Generate actions based on diagnostic content
			const generatedActions = this.createActionsForDiagnostic(
				document,
				diagnostic,
			);
			actions.push(...generatedActions);
		}

		return actions.length > 0 ? actions : undefined;
	}

	/**
	 * Create code actions for a specific diagnostic.
	 */
	private createActionsForDiagnostic(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = [];

		// Handle deprecated packages
		if (diagnostic.tags?.includes(vscode.DiagnosticTag.Deprecated)) {
			actions.push(this.createRemoveDeprecatedAction(document, diagnostic));
		}

		// Handle duplicate dependencies
		if (diagnostic.message.includes('duplicate')) {
			actions.push(this.createRemoveDuplicateAction(document, diagnostic));
		}

		// Handle outdated dependencies
		if (diagnostic.message.includes('update available')) {
			actions.push(this.createUpdateDependencyAction(document, diagnostic));
		}

		// Handle missing metadata
		if (diagnostic.message.includes('missing')) {
			actions.push(this.createAddMetadataAction(document, diagnostic));
		}

		// Handle vulnerabilities
		if (
			diagnostic.severity === vscode.DiagnosticSeverity.Error &&
			diagnostic.message.toLowerCase().includes('vulnerability')
		) {
			actions.push(this.createFixVulnerabilityAction(document, diagnostic));
		}

		return actions;
	}

	/**
	 * Create action to remove a deprecated dependency.
	 */
	private createRemoveDeprecatedAction(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'Remove deprecated dependency',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];
		action.isPreferred = true;

		const packageName = diagnostic.code?.toString();
		if (packageName) {
			action.command = {
				title: 'Remove deprecated dependency',
				command: 'pkgsense.removeDependency',
				arguments: [document.uri, packageName],
			};
		}

		return action;
	}

	/**
	 * Create action to remove a duplicate dependency.
	 */
	private createRemoveDuplicateAction(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'Remove duplicate dependency',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];

		const packageName = diagnostic.code?.toString();
		if (packageName) {
			action.command = {
				title: 'Remove duplicate',
				command: 'pkgsense.removeDependency',
				arguments: [document.uri, packageName],
			};
		}

		return action;
	}

	/**
	 * Create action to update an outdated dependency.
	 */
	private createUpdateDependencyAction(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'Update to latest version',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];
		action.isPreferred = true;

		const packageName = diagnostic.code?.toString();
		if (packageName) {
			action.command = {
				title: 'Update dependency',
				command: 'pkgsense.updateDependency',
				arguments: [document.uri, packageName],
			};
		}

		return action;
	}

	/**
	 * Create action to add missing metadata field.
	 */
	private createAddMetadataAction(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'Add missing field',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];

		// Extract field name from message
		const match = diagnostic.message.match(/Missing.*?'(\w+)'/);
		const fieldName = match ? match[1] : 'field';

		action.command = {
			title: `Add ${fieldName}`,
			command: 'pkgsense.addMetadataField',
			arguments: [document.uri, fieldName],
		};

		return action;
	}

	/**
	 * Create action to fix a vulnerability.
	 */
	private createFixVulnerabilityAction(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'Fix vulnerability',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];
		action.isPreferred = true;

		const packageName = diagnostic.code?.toString();
		if (packageName) {
			action.command = {
				title: 'Fix vulnerability',
				command: 'pkgsense.fixVulnerability',
				arguments: [document.uri, packageName],
			};
		}

		return action;
	}
}
