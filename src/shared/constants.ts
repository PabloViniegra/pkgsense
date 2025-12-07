export const CONSTANTS = {
	// Package size thresholds (in bytes)
	PACKAGE_SIZE_LARGE_THRESHOLD: 1024 * 1024, // 1 MB
	PACKAGE_SIZE_MEDIUM_THRESHOLD: 200 * 1024, // 200 KB
	PACKAGE_SIZE_SMALL_THRESHOLD: 50 * 1024, // 50 KB

	// Buffer sizes
	EXEC_MAX_BUFFER: 1024 * 1024, // 1 MB

	// Timeouts
	EXEC_TIMEOUT_MS: 30000, // 30 seconds

	// Conversions
	BYTES_TO_KB: 1024,

	// Diagnostic source names
	DIAGNOSTIC_SOURCE: 'Package Analyzer',
	DIAGNOSTIC_COLLECTION_NAME: 'packageAnalyzer',

	// File names
	PACKAGE_JSON_FILENAME: 'package.json',

	// User messages
	ERROR_NO_EDITOR: 'Open the package.json to analyze it',
	INFO_ANALYSIS_COMPLETED: 'package.json analysis completed',
	ERROR_INVALID_PACKAGE_JSON: 'Invalid package.json',
} as const;
