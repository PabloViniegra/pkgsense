import * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';

const DUPLICATE_MESSAGE = /^Duplicate dependency/;
const UPDATE_MESSAGE = /update available/;
const MISSING_FIELD_MESSAGE = /^Missing "(\w+)" field/;
const VULNERABILITY_MESSAGE = /^Vulnerability in /;
const TRANSITIVE_VULNERABILITY_MESSAGE = /^Vulnerability in dependencies of /;

const ADDABLE_FIELDS: ReadonlySet<string> = new Set(
	CONSTANTS.RECOMMENDED_METADATA_FIELDS,
);

/**
 * Dependency a diagnostic refers to. The code is either the bare name or
 * a { value, target } pair when the diagnostic links to its evidence.
 */
function getDependencyName(diagnostic: vscode.Diagnostic): string | undefined {
	const { code } = diagnostic;

	if (typeof code === 'object' && code !== null) {
		return String(code.value);
	}

	return code?.toString();
}

function getEvidenceLink(
	diagnostic: vscode.Diagnostic,
): vscode.Uri | undefined {
	const { code } = diagnostic;
	return typeof code === 'object' && code !== null ? code.target : undefined;
}

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

		// Removing a deprecated dependency does not replace what it provides, so
		// the only action is reading the notice, which usually names a successor
		const notice = getEvidenceLink(diagnostic);
		if (diagnostic.tags?.includes(vscode.DiagnosticTag.Deprecated) && notice) {
			actions.push(this.createViewDeprecationAction(diagnostic, notice));
		}

		// Handle duplicate dependencies
		if (DUPLICATE_MESSAGE.test(diagnostic.message)) {
			actions.push(this.createRemoveDuplicateAction(document, diagnostic));
		}

		// Handle outdated dependencies
		if (UPDATE_MESSAGE.test(diagnostic.message)) {
			actions.push(this.createUpdateDependencyAction(document, diagnostic));
		}

		// Handle missing metadata
		const missingField = MISSING_FIELD_MESSAGE.exec(diagnostic.message)?.[1];
		if (missingField && ADDABLE_FIELDS.has(missingField)) {
			actions.push(
				this.createAddMetadataAction(document, diagnostic, missingField),
			);
		}

		// Handle vulnerabilities
		if (VULNERABILITY_MESSAGE.test(diagnostic.message)) {
			actions.push(this.createFixVulnerabilityAction(document, diagnostic));
		}

		return actions;
	}

	private createViewDeprecationAction(
		diagnostic: vscode.Diagnostic,
		notice: vscode.Uri,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			'View deprecation notice on npm',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];
		action.command = {
			title: 'View deprecation notice on npm',
			command: 'vscode.open',
			arguments: [notice],
		};

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
			'Remove duplicate from devDependencies',
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];

		const packageName = getDependencyName(diagnostic);
		if (packageName) {
			action.command = {
				title: 'Remove duplicate',
				command: 'pkgsense.removeDependency',
				// The entry in "dependencies" is the one that takes effect, so the
				// devDependencies copy is the redundant one
				arguments: [document.uri, packageName, 'devDependencies'],
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

		const packageName = getDependencyName(diagnostic);
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
		fieldName: string,
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			`Add missing "${fieldName}" field`,
			vscode.CodeActionKind.QuickFix,
		);

		action.diagnostics = [diagnostic];

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

		const packageName = getDependencyName(diagnostic);
		if (packageName) {
			const direct = !TRANSITIVE_VULNERABILITY_MESSAGE.test(diagnostic.message);
			action.command = {
				title: 'Fix vulnerability',
				command: 'pkgsense.fixVulnerability',
				arguments: [document.uri, packageName, direct],
			};
		}

		return action;
	}
}
