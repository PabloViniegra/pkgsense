import * as vscode from 'vscode';
import type { Finding } from '../types';

export class DiagnosticsManager {
	private collection: vscode.DiagnosticCollection;

	constructor(name: string) {
		this.collection = vscode.languages.createDiagnosticCollection(name);
	}

	dispose() {
		this.collection.clear();
		this.collection.dispose();
	}

	clear(uri?: vscode.Uri) {
		if (uri) this.collection.delete(uri);
		else this.collection.clear();
	}

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
			d.source = 'Package Analyzer';
			if (f.dependency) d.code = f.dependency;
			return d;
		});

		this.collection.set(uri, diags);
	}
}
