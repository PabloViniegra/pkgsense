import * as vscode from 'vscode';
import type { DiagnosticsManager } from '../decorators/diagnostics';
import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';
import { type Finding, isPackageJson } from '../types';
import {
	createDependencyGraphAnalyzer,
	dependencyGraphAnalyzer,
} from './dependencyGraphAnalyzer';
import { createEngineAnalyzer, engineAnalyzer } from './engineAnalyzer';
import {
	createHeuristicsAnalyzer,
	heuristicsAnalyzer,
} from './heuristicsAnalyzer';
import { createLicenseAnalyzer, licenseAnalyzer } from './licenseAnalyzer';
import { createMetadataAnalyzer, metadataAnalyzer } from './metadataAnalyzer';
import { createScriptAnalyzer, scriptAnalyzer } from './scriptAnalyzer';
import type {
	Analyzer,
	AnalysisContext,
	AnalysisManagerError,
	LineRange,
} from './types';
import { createUpdateAnalyzer, updateAnalyzer } from './updateAnalyzer';
import {
	createVulnerabilityAnalyzer,
	vulnerabilityAnalyzer,
} from './vulnerabilityAnalyzer';
import { createWeightAnalyzer, weightAnalyzer } from './weightAnalyzer';

/**
 * Configuration for the AnalysisManager.
 * Enables customization and dependency injection.
 */
export interface AnalysisManagerConfig {
	/**
	 * Array of analyzers to run.
	 * Defaults to all built-in analyzers if not provided.
	 */
	readonly analyzers?: readonly Analyzer[];
}

/**
 * Default analyzers configuration.
 * Following Open/Closed Principle - new analyzers can be added
 * without modifying the manager.
 */
function createDefaultAnalyzers(): Analyzer[] {
	return [
		createHeuristicsAnalyzer(),
		createWeightAnalyzer(),
		createVulnerabilityAnalyzer(),
		createMetadataAnalyzer(),
		createScriptAnalyzer(),
		createLicenseAnalyzer(),
		createUpdateAnalyzer(),
		createEngineAnalyzer(),
		createDependencyGraphAnalyzer(),
	];
}

/**
 * Creates a vscode.Range from a LineRange.
 * Bridges the platform-agnostic LineRange to VS Code specific Range.
 */
function toVscodeRange(lineRange: LineRange): vscode.Range {
	return new vscode.Range(
		lineRange.startLine,
		lineRange.startCharacter,
		lineRange.endLine,
		lineRange.endCharacter,
	);
}

/**
 * Creates a LineRange from document position data.
 * Pure function - no side effects.
 */
function createLineRange(
	lineIndex: number,
	columnIndex: number,
	depName: string,
): LineRange {
	return {
		startLine: lineIndex,
		startCharacter: columnIndex + 1,
		endLine: lineIndex,
		endCharacter: columnIndex + 1 + depName.length,
	};
}

/**
 * Finds the column index of a dependency name in a line.
 * Pure function - no side effects.
 */
function findDependencyInLine(
	line: string,
	depName: string,
): number | undefined {
	const index = line.indexOf(`"${depName}"`);
	return index !== -1 ? index : undefined;
}

/**
 * Computes line ranges for all dependencies in a document.
 * Extracts position information for diagnostic highlighting.
 */
function computeDependencyRanges(
	document: vscode.TextDocument,
	deps: readonly string[],
): Record<string, LineRange> {
	const ranges: Record<string, LineRange> = {};

	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i).text;

		for (const depName of deps) {
			const columnIndex = findDependencyInLine(line, depName);

			if (columnIndex !== undefined) {
				ranges[depName] = createLineRange(i, columnIndex, depName);
			}
		}
	}

	return ranges;
}

/**
 * Converts findings with LineRange to findings with vscode.Range.
 * Bridges platform-agnostic findings to VS Code specific format.
 */
function convertFindingsToVscode(
	findings: Finding[],
	dependencyRanges: Record<string, LineRange>,
): Finding[] {
	return findings.map((finding) => {
		// If finding already has a range (vscode.Range), keep it
		if (finding.range) {
			return finding;
		}

		// If finding has a dependency, try to get its range
		if (finding.dependency && dependencyRanges[finding.dependency]) {
			return {
				...finding,
				range: toVscodeRange(dependencyRanges[finding.dependency]),
			};
		}

		return finding;
	});
}

/**
 * Analysis Manager - Orchestrates package.json analysis.
 *
 * Responsibilities:
 * - Coordinate multiple analyzers
 * - Aggregate findings
 * - Handle errors gracefully
 *
 * Design Patterns:
 * - Strategy Pattern: Analyzers are interchangeable strategies
 * - Dependency Injection: Analyzers are injected via config
 * - Facade Pattern: Provides simple interface for complex analysis
 */
export class AnalysisManager {
	private readonly analyzers: readonly Analyzer[];

	constructor(config: AnalysisManagerConfig = {}) {
		this.analyzers = config.analyzers ?? createDefaultAnalyzers();
	}

	/**
	 * Analyze a package.json document and report findings.
	 * Returns a Result type for explicit error handling.
	 */
	async analyzeDocument(
		document: vscode.TextDocument,
		diagnostics: DiagnosticsManager,
	): Promise<Result<void, AnalysisManagerError>> {
		// Parse JSON
		const parseResult = this.parseDocument(document);
		if (!parseResult.success) {
			this.handleAnalysisError(document, diagnostics, parseResult.error);
			return failure(parseResult.error);
		}

		const json = parseResult.data;

		// Validate package.json structure
		if (!isPackageJson(json)) {
			const error: AnalysisManagerError = {
				code: 'INVALID_PACKAGE_JSON',
				message: 'Invalid package.json structure',
			};
			this.handleAnalysisError(document, diagnostics, error);
			return failure(error);
		}

		const allDependencies = { ...json.dependencies, ...json.devDependencies };
		const dependencyRanges = computeDependencyRanges(
			document,
			Object.keys(allDependencies),
		);

		const context: AnalysisContext = {
			packageJson: json,
			allDependencies,
			dependencyRanges,
			workspacePath:
				vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
		};

		const findings = await this.runAnalyzers(context);

		// Convert LineRange to vscode.Range for diagnostics
		const vscodeFindings = convertFindingsToVscode(findings, dependencyRanges);

		diagnostics.setFindings(document.uri, vscodeFindings);

		return success(undefined);
	}

	/**
	 * Parse the document text as JSON.
	 * Pure function - no side effects.
	 */
	private parseDocument(
		document: vscode.TextDocument,
	): Result<unknown, AnalysisManagerError> {
		try {
			const json = JSON.parse(document.getText());
			return success(json);
		} catch (err) {
			return failure({
				code: 'JSON_PARSE_ERROR',
				message: err instanceof Error ? err.message : 'Failed to parse JSON',
				cause: err,
			});
		}
	}

	/**
	 * Run all analyzers in parallel and collect findings.
	 */
	private async runAnalyzers(context: AnalysisContext): Promise<Finding[]> {
		const results = await Promise.allSettled(
			this.analyzers.map((analyzer) => analyzer.analyze(context)),
		);

		const findings: Finding[] = [];

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const analyzer = this.analyzers[i];

			if (result.status === 'fulfilled') {
				if (result.value.success) {
					findings.push(...result.value.data);
				} else {
					console.warn(
						`Analyzer '${analyzer.name}' failed: ${result.value.error.message}`,
					);
				}
			} else {
				console.error(
					`Analyzer '${analyzer.name}' threw an error: ${result.reason}`,
				);
			}
		}

		return findings;
	}

	/**
	 * Handle analysis errors by showing appropriate diagnostics.
	 */
	private handleAnalysisError(
		document: vscode.TextDocument,
		diagnostics: DiagnosticsManager,
		error: AnalysisManagerError,
	): void {
		diagnostics.clear(document.uri);
		const range = new vscode.Range(0, 0, 0, 1);

		diagnostics.setFindings(document.uri, [
			{
				type: 'error',
				message: `${CONSTANTS.ERROR_INVALID_PACKAGE_JSON}: ${error.message}`,
				range,
			},
		]);

		// Log detailed error for debugging
		if (error.cause) {
			console.error(`Analysis error [${error.code}]:`, error.cause);
		}
	}
}

/**
 * Default AnalysisManager instance for convenience.
 */
let defaultManager: AnalysisManager | null = null;

/**
 * Get or create the default AnalysisManager.
 */
function getDefaultManager(): AnalysisManager {
	if (!defaultManager) {
		defaultManager = new AnalysisManager();
	}
	return defaultManager;
}

/**
 * Analyze a package.json document using the default manager.
 * Maintains backward compatibility with existing code.
 *
 * Note: This function ignores the Result return value for backward compatibility.
 * For proper error handling, use AnalysisManager.analyzeDocument() directly.
 */
export async function analyzePackageDocument(
	document: vscode.TextDocument,
	diagnostics: DiagnosticsManager,
): Promise<void> {
	const result = await getDefaultManager().analyzeDocument(
		document,
		diagnostics,
	);

	// Log errors but don't throw (backward compatibility)
	if (!result.success) {
		console.error(
			`Analysis failed [${result.error.code}]: ${result.error.message}`,
		);
	}
}

/**
 * Create a custom AnalysisManager with specific configuration.
 * Enables dependency injection for testing and customization.
 */
export function createAnalysisManager(
	config: AnalysisManagerConfig = {},
): AnalysisManager {
	return new AnalysisManager(config);
}
