import * as vscode from 'vscode';

/**
 * Configuration keys for pkgsense extension.
 */
export const CONFIG_KEYS = {
	ENABLE_ANALYZERS: 'pkgsense.enableAnalyzers',
	ANALYZERS: {
		HEURISTICS: 'pkgsense.analyzers.heuristics',
		WEIGHT: 'pkgsense.analyzers.weight',
		VULNERABILITY: 'pkgsense.analyzers.vulnerability',
		METADATA: 'pkgsense.analyzers.metadata',
		SCRIPT: 'pkgsense.analyzers.script',
		LICENSE: 'pkgsense.analyzers.license',
		UPDATE: 'pkgsense.analyzers.update',
		ENGINE: 'pkgsense.analyzers.engine',
		DEPENDENCY_GRAPH: 'pkgsense.analyzers.dependencyGraph',
	},
} as const;

/**
 * Analyzer type identifier.
 * Maps to the analyzer names used in the codebase.
 */
export type AnalyzerType =
	| 'heuristics'
	| 'weight'
	| 'vulnerability'
	| 'metadata'
	| 'script'
	| 'license'
	| 'update'
	| 'engine'
	| 'dependencyGraph';

/**
 * Configuration settings for analyzers.
 */
export interface AnalyzerConfiguration {
	/** Master switch - when false, no analyzers run */
	readonly globalEnabled: boolean;
	/** Individual analyzer settings */
	readonly analyzers: {
		readonly [K in AnalyzerType]: boolean;
	};
}

/**
 * Reads the current analyzer configuration from VS Code settings.
 * Pure function - no side effects, returns current configuration state.
 *
 * Uses atomic read to prevent inconsistent state if settings change mid-read.
 *
 * @returns Current analyzer configuration
 */
export function getAnalyzerConfiguration(): AnalyzerConfiguration {
	// Read the entire configuration object once for atomicity
	const config = vscode.workspace.getConfiguration('pkgsense');

	return {
		globalEnabled: config.get<boolean>('enableAnalyzers', true),
		analyzers: {
			heuristics: config.get<boolean>('analyzers.heuristics', true),
			weight: config.get<boolean>('analyzers.weight', true),
			vulnerability: config.get<boolean>('analyzers.vulnerability', true),
			metadata: config.get<boolean>('analyzers.metadata', true),
			script: config.get<boolean>('analyzers.script', true),
			license: config.get<boolean>('analyzers.license', true),
			update: config.get<boolean>('analyzers.update', true),
			engine: config.get<boolean>('analyzers.engine', true),
			dependencyGraph: config.get<boolean>('analyzers.dependencyGraph', true),
		},
	};
}

/**
 * Checks if a specific analyzer is enabled.
 * Takes into account both the global enable flag and individual analyzer setting.
 *
 * @param analyzerType - The type of analyzer to check
 * @returns true if the analyzer should run, false otherwise
 */
export function isAnalyzerEnabled(analyzerType: AnalyzerType): boolean {
	const config = getAnalyzerConfiguration();

	// If global flag is disabled, no analyzers should run
	if (!config.globalEnabled) {
		return false;
	}

	// Check individual analyzer setting
	return config.analyzers[analyzerType];
}

/**
 * Gets a list of all enabled analyzer types.
 * Useful for filtering which analyzers to instantiate.
 *
 * @returns Array of enabled analyzer type identifiers
 */
export function getEnabledAnalyzers(): AnalyzerType[] {
	const config = getAnalyzerConfiguration();

	// If global flag is disabled, return empty array
	if (!config.globalEnabled) {
		return [];
	}

	// Filter enabled analyzers
	return (Object.keys(config.analyzers) as AnalyzerType[]).filter(
		(type) => config.analyzers[type],
	);
}

/**
 * Checks if any configuration change affects analyzers.
 * Used to determine if analysis should be re-run when configuration changes.
 *
 * @param event - VS Code configuration change event
 * @returns true if analyzer configuration changed, false otherwise
 */
export function hasAnalyzerConfigChanged(
	event: vscode.ConfigurationChangeEvent,
): boolean {
	// Check global enable flag
	if (event.affectsConfiguration(CONFIG_KEYS.ENABLE_ANALYZERS)) {
		return true;
	}

	// Check individual analyzer settings
	const analyzerKeys = Object.values(CONFIG_KEYS.ANALYZERS);
	return analyzerKeys.some((key) => event.affectsConfiguration(key));
}
