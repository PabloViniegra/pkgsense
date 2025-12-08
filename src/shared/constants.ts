export const CONSTANTS = {
	// Package size thresholds (in bytes)
	PACKAGE_SIZE_LARGE_THRESHOLD: 1024 * 1024, // 1 MB
	PACKAGE_SIZE_MEDIUM_THRESHOLD: 200 * 1024, // 200 KB
	PACKAGE_SIZE_SMALL_THRESHOLD: 50 * 1024, // 50 KB

	// Buffer sizes
	EXEC_MAX_BUFFER: 1024 * 1024, // 1 MB

	// Timeouts
	EXEC_TIMEOUT_MS: 30000, // 30 seconds
	NPM_REGISTRY_TIMEOUT_MS: 5000, // 5 seconds

	// Conversions
	BYTES_TO_KB: 1024,

	// NPM Registry
	NPM_REGISTRY_URL: 'https://registry.npmjs.org',
	CACHE_TTL_MS: 3600000, // 1 hour
	RATE_LIMIT_REQUESTS_PER_MINUTE: 100,

	// Diagnostic source names
	DIAGNOSTIC_SOURCE: 'Package Analyzer',
	DIAGNOSTIC_COLLECTION_NAME: 'packageAnalyzer',

	// File names
	PACKAGE_JSON_FILENAME: 'package.json',

	// Dangerous script patterns
	SCRIPT_DANGER_PATTERNS: [
		{ pattern: /rm\s+-rf/, message: 'Dangerous: rm -rf command detected' },
		{ pattern: /sudo\s+/, message: 'Requires elevated privileges (sudo)' },
		{ pattern: /eval\s*\(/, message: 'eval() detected - potential security risk' },
		{
			pattern: />\s*\/dev\/null\s+2>&1/,
			message: 'Output suppression may hide errors',
		},
	],

	// License compatibility (simplified - GPL incompatible with most permissive licenses)
	INCOMPATIBLE_LICENSE_PAIRS: [
		['GPL-2.0', 'MIT'],
		['GPL-2.0', 'Apache-2.0'],
		['GPL-2.0', 'BSD-2-Clause'],
		['GPL-2.0', 'BSD-3-Clause'],
		['GPL-3.0', 'MIT'],
		['GPL-3.0', 'Apache-2.0'],
		['GPL-3.0', 'BSD-2-Clause'],
		['GPL-3.0', 'BSD-3-Clause'],
		['AGPL-3.0', 'MIT'],
		['AGPL-3.0', 'Apache-2.0'],
	],

	// Required metadata fields for quality package.json
	RECOMMENDED_METADATA_FIELDS: [
		'description',
		'keywords',
		'author',
		'repository',
		'bugs',
		'homepage',
		'license',
	],

	// User messages
	ERROR_NO_EDITOR: 'Open the package.json to analyze it',
	INFO_ANALYSIS_COMPLETED: 'package.json analysis completed',
	ERROR_INVALID_PACKAGE_JSON: 'Invalid package.json',
	WARNING_UPDATE_AVAILABLE: 'Update available',
	WARNING_MAJOR_UPDATE: 'Major update available (may contain breaking changes)',
	WARNING_LICENSE_CONFLICT: 'License conflict detected',
	INFO_MISSING_METADATA: 'Missing recommended metadata field',
	WARNING_DANGEROUS_SCRIPT: 'Potentially dangerous script detected',
	WARNING_ENGINE_MISMATCH: 'Node.js version mismatch',
	WARNING_PEER_DEPENDENCY_MISSING: 'Peer dependency not satisfied',
} as const;
