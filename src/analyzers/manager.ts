import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AnalyzerType } from '../config/analyzerConfig';
import { getEnabledAnalyzers } from '../config/analyzerConfig';
import type { DiagnosticsManager } from '../decorators/diagnostics';
import { NotificationManager } from '../decorators/notifications';
import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';
import { type Finding, type PackageJson, isPackageJson } from '../types';
import { createDependencyGraphAnalyzer } from './dependencyGraphAnalyzer';
import {
	type DocumentLocator,
	type KeySpan,
	createDocumentLocator,
} from './documentLocations';
import { createEngineAnalyzer } from './engineAnalyzer';
import { createHeuristicsAnalyzer } from './heuristicsAnalyzer';
import { createLicenseAnalyzer } from './licenseAnalyzer';
import { createMetadataAnalyzer } from './metadataAnalyzer';
import { createScriptAnalyzer } from './scriptAnalyzer';
import type { Analyzer, AnalysisContext, AnalysisManagerError } from './types';
import { createUpdateAnalyzer } from './updateAnalyzer';
import { createVulnerabilityAnalyzer } from './vulnerabilityAnalyzer';
import { createWeightAnalyzer } from './weightAnalyzer';

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
 * Maps analyzer types to their factory functions.
 * Enables dynamic analyzer creation based on configuration.
 */
const ANALYZER_FACTORIES: Record<AnalyzerType, () => Analyzer> = {
	heuristics: createHeuristicsAnalyzer,
	weight: createWeightAnalyzer,
	vulnerability: createVulnerabilityAnalyzer,
	metadata: createMetadataAnalyzer,
	script: createScriptAnalyzer,
	license: createLicenseAnalyzer,
	update: createUpdateAnalyzer,
	engine: createEngineAnalyzer,
	dependencyGraph: createDependencyGraphAnalyzer,
};

// On Windows a repository can ship its own node.cmd or npm.cmd, which would
// run as soon as the package.json is opened
const REQUIRES_TRUST: ReadonlySet<AnalyzerType> = new Set([
	'vulnerability',
	'engine',
]);

/**
 * Analyzers that spawn processes inside the workspace only run once the
 * workspace is trusted.
 */
export function selectAnalyzerTypes(
	enabled: readonly AnalyzerType[],
	isTrusted: boolean,
): AnalyzerType[] {
	return enabled.filter((type) => isTrusted || !REQUIRES_TRUST.has(type));
}

/**
 * Default analyzers configuration.
 * Respects user configuration and workspace trust.
 */
function createDefaultAnalyzers(): Analyzer[] {
	return selectAnalyzerTypes(getEnabledAnalyzers(), vscode.workspace.isTrusted)
		.filter((type) => {
			if (!(type in ANALYZER_FACTORIES)) {
				console.error(`Unknown analyzer type: ${type}`);
				return false;
			}
			return true;
		})
		.map((type) => ANALYZER_FACTORIES[type]());
}

function toVscodeRange(
	document: vscode.TextDocument,
	span: KeySpan,
): vscode.Range {
	return new vscode.Range(
		document.positionAt(span.offset),
		document.positionAt(span.offset + span.length),
	);
}

function findSpan(finding: Finding, locator: DocumentLocator): KeySpan | null {
	const atLocation = finding.location
		? locator.findKey(finding.location)
		: null;
	if (atLocation) {
		return atLocation;
	}

	return finding.dependency ? locator.findDependency(finding.dependency) : null;
}

/**
 * Places each finding on the key it refers to in the current text.
 * Findings with no key to point at stay at the top of the file.
 */
function locateFindings(
	findings: readonly Finding[],
	document: vscode.TextDocument,
): Finding[] {
	const locator = createDocumentLocator(document.getText());

	return findings.map((finding) => {
		if (finding.range) {
			return finding;
		}

		const span = findSpan(finding, locator);
		return span
			? { ...finding, range: toVscodeRange(document, span) }
			: finding;
	});
}

function createContext(
	json: PackageJson,
	document: vscode.TextDocument,
): AnalysisContext {
	// The "dependencies" entry wins when a package is listed in both: it is
	// the one installed for production
	return {
		packageJson: json,
		allDependencies: { ...json.devDependencies, ...json.dependencies },
		// The package's own directory: in a monorepo the first workspace
		// folder is a different project
		workspacePath: path.dirname(document.uri.fsPath),
	};
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
	private readonly notificationManager: NotificationManager;

	constructor(config: AnalysisManagerConfig = {}) {
		this.analyzers = config.analyzers ?? createDefaultAnalyzers();
		this.notificationManager = new NotificationManager();
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

		const findings = await this.runAnalyzersWithProgress(
			createContext(json, document),
		);

		const vscodeFindings = locateFindings(findings, document);

		diagnostics.setFindings(document.uri, vscodeFindings);

		// Show notifications for critical vulnerabilities
		this.notificationManager.notifyFindings(vscodeFindings);

		return success(undefined);
	}

	private runAnalyzersWithProgress(
		context: AnalysisContext,
	): Thenable<Finding[]> {
		// Show progress indicator for analysis
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: 'Analyzing package.json',
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 0, message: 'Starting analysis...' });
				const results = await this.runAnalyzers(context);
				progress.report({ increment: 100, message: 'Analysis complete' });
				return results;
			},
		);
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

			// Guard against undefined (should never happen with proper indexing)
			if (!result || !analyzer) {
				console.error(`Missing result or analyzer at index ${i}`);
				continue;
			}

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
 * Reset the default AnalysisManager.
 * Called when configuration changes to recreate analyzers with new settings.
 */
export function resetDefaultManager(): void {
	defaultManager = null;
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
