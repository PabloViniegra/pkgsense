import type { Finding, PackageJson } from '../types';
import type { Result } from '../shared/result';

/**
 * Represents a line range in a document.
 * Decoupled from vscode.Range to enable testing without VS Code dependency.
 */
export interface LineRange {
	readonly startLine: number;
	readonly startCharacter: number;
	readonly endLine: number;
	readonly endCharacter: number;
}

/**
 * Context provided to all analyzers containing the parsed package.json
 * and computed metadata needed for analysis.
 *
 * This abstraction decouples analyzers from VS Code specifics,
 * enabling unit testing without VS Code runtime.
 */
export interface AnalysisContext {
	/** The parsed package.json content */
	readonly packageJson: PackageJson;
	/** Combined dependencies from both dependencies and devDependencies */
	readonly allDependencies: Readonly<Record<string, string>>;
	/** Line ranges for each dependency (for diagnostic positioning) */
	readonly dependencyRanges: Readonly<Record<string, LineRange>>;
	/** The workspace root path for file system operations */
	readonly workspacePath: string;
}

/**
 * Error codes for analyzer failures.
 * Using discriminated union for exhaustive error handling.
 */
export type AnalyzerErrorCode =
	| 'NETWORK_ERROR'
	| 'PARSE_ERROR'
	| 'TIMEOUT_ERROR'
	| 'VALIDATION_ERROR'
	| 'UNKNOWN_ERROR';

/**
 * Structured error type for analyzer failures.
 */
export interface AnalyzerError {
	readonly code: AnalyzerErrorCode;
	readonly message: string;
	readonly cause?: unknown;
}

/**
 * Analyzer interface following the Strategy Pattern.
 * All analyzers must implement this contract to be pluggable into the analysis pipeline.
 *
 * Benefits:
 * - Open/Closed Principle: New analyzers can be added without modifying existing code
 * - Dependency Inversion: Manager depends on abstraction, not concrete implementations
 * - Single Responsibility: Each analyzer handles one type of analysis
 */
export interface Analyzer {
	/** Unique identifier for the analyzer */
	readonly name: string;

	/**
	 * Analyze the package.json and return findings.
	 * Returns a Result type to handle errors explicitly without throwing.
	 */
	analyze(context: AnalysisContext): Promise<Result<Finding[], AnalyzerError>>;
}

/**
 * Factory function type for creating analyzers.
 * Enables dependency injection of external services.
 */
export type AnalyzerFactory<TDeps = void> = TDeps extends void
	? () => Analyzer
	: (deps: TDeps) => Analyzer;

/**
 * Error codes for AnalysisManager failures.
 */
export type AnalysisManagerErrorCode =
	| 'JSON_PARSE_ERROR'
	| 'INVALID_PACKAGE_JSON'
	| 'ANALYZER_FAILED'
	| 'UNKNOWN_ERROR';

/**
 * Structured error type for AnalysisManager failures.
 */
export interface AnalysisManagerError {
	readonly code: AnalysisManagerErrorCode;
	readonly message: string;
	readonly cause?: unknown;
}
