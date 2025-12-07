export const CONSTANTS = {
	// Package size thresholds (in bytes)
	PACKAGE_SIZE_LARGE_THRESHOLD: 1024 * 1024, // 1 MB
	PACKAGE_SIZE_MEDIUM_THRESHOLD: 200 * 1024, // 200 KB
	PACKAGE_SIZE_SMALL_THRESHOLD: 50 * 1024, // 50 KB

	// Buffer sizes
	EXEC_MAX_BUFFER: 1024 * 1024, // 1 MB

	// Conversions
	BYTES_TO_KB: 1024,
} as const;
