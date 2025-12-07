import * as vscode from 'vscode';
import type { DiagnosticsManager } from '../decorators/diagnostics';
import type { Finding, PackageJson } from '../types';
import { heuristicsAnalyzer } from './heuristicsAnalyzer';
import { vulnerabilityAnalyzer } from './vulnerabilityAnalyzer';
import { weightAnalyzer } from './weightAnalyzer';

function isPackageJson(data: unknown): data is PackageJson {
	return typeof data === 'object' && data !== null;
}

export async function analyzePackageDocument(
	document: vscode.TextDocument,
	diagnostics: DiagnosticsManager,
): Promise<void> {
	try {
		const json: unknown = JSON.parse(document.getText());

		if (!isPackageJson(json)) {
			throw new Error('Invalid package.json structure');
		}

		const allDeps = { ...json.dependencies, ...json.devDependencies };
		const depRanges = computeDependencyRanges(document, Object.keys(allDeps));
		const findings: Finding[] = [];

		const [heuristics, weights, vulns] = await Promise.all([
			heuristicsAnalyzer(json, allDeps),
			weightAnalyzer(Object.entries(allDeps), depRanges),
			vulnerabilityAnalyzer(vscode.workspace.rootPath || process.cwd()),
		]);

		findings.push(...heuristics);
		findings.push(...weights);
		findings.push(...vulns);

		diagnostics.setFindings(document.uri, findings);
	} catch (err) {
		diagnostics.clear(document.uri);
		const range = new vscode.Range(0, 0, 0, 1);
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';

		diagnostics.setFindings(document.uri, [
			{
				type: 'error',
				message: `package.json inválido: ${errorMessage}`,
				range,
			},
		]);
	}
}

function computeDependencyRanges(
	document: vscode.TextDocument,
	deps: string[],
) {
	const ranges: Record<string, vscode.Range> = {};
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;
		for (const d of deps) {
			const index = line.indexOf(`"${d}"`);
			if (index !== -1) {
				const start = new vscode.Position(i, index + 1);
				const end = new vscode.Position(i, index + 1 + d.length);
				ranges[d] = new vscode.Range(start, end);
			}
		}
	}
	return ranges;
}
