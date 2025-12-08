import * as semver from 'semver';

/**
 * Type of version update (major, minor, or patch).
 */
export type UpdateType = 'major' | 'minor' | 'patch';

/**
 * Sanitizes a version string by removing common prefixes and ranges.
 *
 * @param version Raw version string (e.g., '^1.2.3', '~2.0.0', '>=1.0.0')
 * @returns Clean semver version (e.g., '1.2.3', '2.0.0', '1.0.0')
 *
 * @example
 * ```typescript
 * sanitizeVersion('^1.2.3')  // '1.2.3'
 * sanitizeVersion('~2.0.0')  // '2.0.0'
 * sanitizeVersion('latest')  // 'latest'
 * ```
 */
export function sanitizeVersion(version: string): string {
	const sanitized = (version || '').toString().trim();

	// If it's a specific keyword, return as-is
	if (sanitized === 'latest' || sanitized === 'next' || sanitized === '') {
		return 'latest';
	}

	// Remove common prefixes and operators
	const cleaned = sanitized.replace(/^[^0-9]*/, '');

	// Try to coerce to valid semver
	const coerced = semver.coerce(cleaned);
	return coerced ? coerced.version : sanitized;
}

/**
 * Compares two semver versions.
 *
 * @param version1 First version
 * @param version2 Second version
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2, null if invalid
 *
 * @example
 * ```typescript
 * compareVersions('1.0.0', '2.0.0')  // -1
 * compareVersions('2.0.0', '2.0.0')  // 0
 * compareVersions('3.0.0', '2.0.0')  // 1
 * ```
 */
export function compareVersions(
	version1: string,
	version2: string,
): number | null {
	const v1 = semver.valid(sanitizeVersion(version1));
	const v2 = semver.valid(sanitizeVersion(version2));

	if (!v1 || !v2) {
		return null;
	}

	return semver.compare(v1, v2);
}

/**
 * Determines the type of update between two versions.
 *
 * @param currentVersion Current version
 * @param latestVersion Latest available version
 * @returns Type of update or null if invalid/no update
 *
 * @example
 * ```typescript
 * getUpdateType('1.0.0', '2.0.0')  // 'major'
 * getUpdateType('1.0.0', '1.1.0')  // 'minor'
 * getUpdateType('1.0.0', '1.0.1')  // 'patch'
 * getUpdateType('2.0.0', '1.0.0')  // null (downgrade)
 * ```
 */
export function getUpdateType(
	currentVersion: string,
	latestVersion: string,
): UpdateType | null {
	const current = semver.valid(sanitizeVersion(currentVersion));
	const latest = semver.valid(sanitizeVersion(latestVersion));

	if (!current || !latest) {
		return null;
	}

	// If current is newer or equal, no update needed
	if (semver.gte(current, latest)) {
		return null;
	}

	const currentParsed = semver.parse(current);
	const latestParsed = semver.parse(latest);

	if (!currentParsed || !latestParsed) {
		return null;
	}

	// Check major version difference
	if (currentParsed.major < latestParsed.major) {
		return 'major';
	}

	// Check minor version difference
	if (currentParsed.minor < latestParsed.minor) {
		return 'minor';
	}

	// Check patch version difference
	if (currentParsed.patch < latestParsed.patch) {
		return 'patch';
	}

	return null;
}

/**
 * Checks if a version satisfies a version range.
 *
 * @param version Version to check
 * @param range Version range (e.g., '^1.0.0', '>=2.0.0 <3.0.0')
 * @returns True if version satisfies range
 *
 * @example
 * ```typescript
 * satisfiesRange('1.2.3', '^1.0.0')        // true
 * satisfiesRange('2.0.0', '^1.0.0')        // false
 * satisfiesRange('18.0.0', '>=16.0.0')     // true
 * ```
 */
export function satisfiesRange(version: string, range: string): boolean {
	const cleanVersion = sanitizeVersion(version);
	const valid = semver.valid(cleanVersion);

	if (!valid) {
		return false;
	}

	return semver.satisfies(valid, range);
}

/**
 * Checks if a version is a pre-release version.
 *
 * @param version Version to check
 * @returns True if version is a pre-release (alpha, beta, rc, etc.)
 *
 * @example
 * ```typescript
 * isPreRelease('1.0.0-alpha.1')  // true
 * isPreRelease('1.0.0-beta')     // true
 * isPreRelease('1.0.0')          // false
 * ```
 */
export function isPreRelease(version: string): boolean {
	const cleanVersion = sanitizeVersion(version);
	const parsed = semver.parse(cleanVersion);

	if (!parsed) {
		return false;
	}

	return parsed.prerelease.length > 0;
}

/**
 * Gets the major version number from a version string.
 *
 * @param version Version string
 * @returns Major version number or null if invalid
 *
 * @example
 * ```typescript
 * getMajorVersion('1.2.3')   // 1
 * getMajorVersion('^2.0.0')  // 2
 * ```
 */
export function getMajorVersion(version: string): number | null {
	const cleanVersion = sanitizeVersion(version);
	const parsed = semver.parse(cleanVersion);

	return parsed ? parsed.major : null;
}
