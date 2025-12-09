/**
 * Branded types for domain primitives.
 * Provides compile-time safety for validated values.
 *
 * Branded types prevent accidentally using raw strings where validated
 * strings are expected, catching bugs at compile time instead of runtime.
 */

/**
 * Brand symbol for creating branded types.
 * Using a unique symbol ensures brands cannot be faked.
 */
declare const __brand: unique symbol;

/**
 * Brand<T, TBrand> creates a branded type from a base type T.
 * The branded type is structurally identical to T but nominally different.
 */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

/**
 * Validated package name (e.g., 'react', '@types/node').
 * Must pass npm package name validation rules.
 */
export type PackageName = Brand<string, 'PackageName'>;

/**
 * Package version string (may include ranges like '^1.0.0', '~2.0.0').
 */
export type PackageVersion = Brand<string, 'PackageVersion'>;

/**
 * Semantic version string without range prefixes (e.g., '1.2.3').
 */
export type SemVerVersion = Brand<string, 'SemVerVersion'>;

const MAX_PACKAGE_NAME_LENGTH = 214;

/**
 * Validates and creates a branded PackageName.
 *
 * @param name - Raw package name string to validate
 * @returns Branded PackageName if valid, null otherwise
 *
 * @example
 * ```typescript
 * const name = createPackageName('react');
 * if (name) {
 *   // name is now PackageName type, guaranteed valid
 *   fetchPackageData(name);
 * }
 * ```
 */
export function createPackageName(name: string): PackageName | null {
	if (!name || typeof name !== 'string') {
		return null;
	}

	const trimmed = name.trim();

	if (trimmed.length === 0 || trimmed.length > MAX_PACKAGE_NAME_LENGTH) {
		return null;
	}

	// npm package name validation rules:
	// - lowercase letters, numbers, hyphens, dots, underscores
	// - may be scoped: @scope/package-name
	// - scope and package name must start with alphanumeric
	const validNameRegex = /^(@[a-z0-9-._]+\/)?[a-z0-9-._]+$/;

	if (!validNameRegex.test(trimmed)) {
		return null;
	}

	return trimmed as PackageName;
}

/**
 * Creates a branded PackageVersion from a raw version string.
 * Does not validate the version format - use for any version string.
 *
 * @param version - Raw version string (may include ranges)
 * @returns Branded PackageVersion
 *
 * @example
 * ```typescript
 * const version = createPackageVersion('^1.2.3');
 * ```
 */
export function createPackageVersion(version: string): PackageVersion {
	return version as PackageVersion;
}

/**
 * Creates a branded SemVerVersion from a raw version string.
 * Strips range prefixes and validates semver format.
 *
 * @param version - Raw version string to sanitize
 * @returns Branded SemVerVersion if valid, null otherwise
 *
 * @example
 * ```typescript
 * const version = createSemVerVersion('^1.2.3');
 * // version === '1.2.3' (SemVerVersion)
 * ```
 */
export function createSemVerVersion(version: string): SemVerVersion | null {
	if (!version || typeof version !== 'string') {
		return null;
	}

	const sanitized = version.trim().replace(/^[^0-9]*/, '');

	if (!sanitized) {
		return null;
	}

	// Basic semver validation: must have at least major.minor.patch
	const semverRegex = /^\d+\.\d+\.\d+/;
	if (!semverRegex.test(sanitized)) {
		return null;
	}

	return sanitized as SemVerVersion;
}

/**
 * Unsafe cast to PackageName without validation.
 * Use only when you're absolutely certain the string is valid.
 *
 * @param name - String to cast
 * @returns PackageName (without validation)
 */
export function unsafePackageName(name: string): PackageName {
	return name as PackageName;
}

/**
 * Unsafe cast to SemVerVersion without validation.
 * Use only when you're absolutely certain the string is valid.
 *
 * @param version - String to cast
 * @returns SemVerVersion (without validation)
 */
export function unsafeSemVerVersion(version: string): SemVerVersion {
	return version as SemVerVersion;
}

/**
 * Type guard to check if a string is a PackageName.
 * Note: This performs validation, not just type checking.
 *
 * @param value - Value to check
 * @returns True if value is a valid package name
 */
export function isPackageName(value: unknown): value is PackageName {
	if (typeof value !== 'string') {
		return false;
	}
	return createPackageName(value) !== null;
}

/**
 * Type guard to check if a string is a SemVerVersion.
 * Note: This performs validation, not just type checking.
 *
 * @param value - Value to check
 * @returns True if value is a valid semver version
 */
export function isSemVerVersion(value: unknown): value is SemVerVersion {
	if (typeof value !== 'string') {
		return false;
	}
	return createSemVerVersion(value) !== null;
}
