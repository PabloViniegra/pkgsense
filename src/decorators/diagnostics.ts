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
	private disposed = false;

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
	 * Safe to call multiple times.
	 */
	dispose() {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
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
	 *
	 * Enhanced color coding:
	 * - Deprecated packages get DiagnosticTag.Deprecated (strikethrough)
	 * - Unnecessary code gets DiagnosticTag.Unnecessary (faded)
	 * - Related information links provide additional context
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

			// VS Code requires non-empty message
			const message = f.message.trim() || '(No message provided)';

			const d = new vscode.Diagnostic(range, message, sev);
			d.source = CONSTANTS.DIAGNOSTIC_SOURCE;
			if (f.dependency) d.code = f.dependency;

			// Enhanced color coding with tags
			d.tags = this.computeDiagnosticTags(f);

			// Add related information for better context
			if (f.dependency) {
				d.relatedInformation = this.createRelatedInformation(f);
			}

			return d;
		});

		this.collection.set(uri, diags);
	}

	/**
	 * Compute VS Code diagnostic tags based on finding tags.
	 * Pure function - no side effects.
	 */
	private computeDiagnosticTags(finding: Finding): vscode.DiagnosticTag[] {
		const tags: vscode.DiagnosticTag[] = [];

		if (!finding.tags) return tags;

		// Check for replacement/maintenance patterns (deprecated packages)
		if (
			finding.tags.includes('replacement') ||
			finding.tags.includes('maintenance')
		) {
			tags.push(vscode.DiagnosticTag.Deprecated);
		}

		// Check for duplication patterns (unnecessary dependencies)
		if (finding.tags.includes('duplication')) {
			tags.push(vscode.DiagnosticTag.Unnecessary);
		}

		return tags;
	}

	/**
	 * Create related information links for diagnostics.
	 * Provides additional context and helpful resources.
	 */
	private createRelatedInformation(
		finding: Finding,
	): vscode.DiagnosticRelatedInformation[] {
		if (!finding.dependency) return [];

		const info: vscode.DiagnosticRelatedInformation[] = [];

		// Add npm package link
		const message = `View ${finding.dependency} on npm`;
		info.push(
			new vscode.DiagnosticRelatedInformation(
				new vscode.Location(
					vscode.Uri.parse(
						`https://www.npmjs.com/package/${finding.dependency}`,
					),
					new vscode.Range(0, 0, 0, 0),
				),
				message,
			),
		);

		return info;
	}
}
