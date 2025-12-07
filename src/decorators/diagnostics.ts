import * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';
import type { Finding } from '../types';

/**
 * Manages VS Code diagnostics for package.json analysis findings.
 *
 * This class acts as a bridge between analyzer findings and VS Code's
 * diagnostic system, converting our custom Finding type into VS Code diagnostics.
 *
 * @example
 * ```typescript
 * const diagnostics = new DiagnosticsManager('packageAnalyzer');
 * diagnostics.setFindings(document.uri, findings);
 * ```
 */
export class DiagnosticsManager {
	private collection: vscode.DiagnosticCollection;

	/**
	 * Creates a new DiagnosticsManager.
	 *
	 * @param name - The name for the diagnostic collection (appears in VS Code UI)
	 */
	constructor(name: string) {
		this.collection = vscode.languages.createDiagnosticCollection(name);
	}

	/**
	 * Disposes of the diagnostic collection and clears all diagnostics.
	 * Should be called when the extension is deactivated.
	 */
	dispose() {
		this.collection.clear();
		this.collection.dispose();
	}

	/**
	 * Clears diagnostics for a specific URI or all diagnostics.
	 *
	 * @param uri - Optional URI to clear diagnostics for. If not provided, clears all diagnostics.
	 */
	clear(uri?: vscode.Uri) {
		if (uri) this.collection.delete(uri);
		else this.collection.clear();
	}

	/**
	 * Sets diagnostics for a document from analysis findings.
	 * Converts Finding objects to VS Code Diagnostic objects.
	 *
	 * @param uri - The URI of the document to set diagnostics for
	 * @param findings - Array of findings from analyzers to display as diagnostics
	 *
	 * @remarks
	 * Each finding's severity is mapped to VS Code diagnostic severity:
	 * - 'error' → DiagnosticSeverity.Error
	 * - 'warning' → DiagnosticSeverity.Warning
	 * - 'info' → DiagnosticSeverity.Information
	 */
	setFindings(uri: vscode.Uri, findings: Finding[]) {
		const diags: vscode.Diagnostic[] = findings.map((f) => {
			const range = f.range || new vscode.Range(0, 0, 0, 1);
			const sev =
				f.type === 'error'
					? vscode.DiagnosticSeverity.Error
					: f.type === 'warning'
						? vscode.DiagnosticSeverity.Warning
						: vscode.DiagnosticSeverity.Information;

			const d = new vscode.Diagnostic(range, f.message, sev);
			d.source = CONSTANTS.DIAGNOSTIC_SOURCE;
			if (f.dependency) d.code = f.dependency;
			return d;
		});

		this.collection.set(uri, diags);
	}
}
