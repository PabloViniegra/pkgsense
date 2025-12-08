import fetch from 'node-fetch';
import { type Result, failure, success } from '../shared/result';
import { npmRegistryCache } from './cache';
import { npmRegistryRateLimiter } from './rateLimiter';

/**
 * NPM Package metadata from the registry.
 * Contains information about all versions of a package.
 */
export interface NpmPackageMetadata {
	readonly name: string;
	readonly versions: Readonly<
		Record<
			string,
			{
				readonly version: string;
				readonly license?: string;
				readonly engines?: {
					readonly node?: string;
					readonly npm?: string;
				};
				readonly peerDependencies?: Readonly<Record<string, string>>;
				readonly dependencies?: Readonly<Record<string, string>>;
			}
		>
	>;
	readonly 'dist-tags': {
		readonly latest: string;
		readonly [tag: string]: string;
	};
	readonly time: Readonly<Record<string, string>>; // version -> publish date
}

/**
 * Type guard for NPM package metadata validation.
 */
function isNpmPackageMetadata(data: unknown): data is NpmPackageMetadata {
	if (typeof data !== 'object' || data === null) {
		return false;
	}

	const obj = data as Record<string, unknown>;

	return (
		typeof obj.name === 'string' &&
		typeof obj.versions === 'object' &&
		obj.versions !== null &&
		typeof obj['dist-tags'] === 'object' &&
		obj['dist-tags'] !== null
	);
}

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Creates an AbortController with a timeout.
 */
function createAbortController(timeoutMs: number): AbortController {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), timeoutMs);
	return controller;
}

/**
 * Exponential backoff delay.
 */
async function delay(ms: number, attempt: number): Promise<void> {
	const backoffMs = ms * 2 ** attempt;
	await new Promise((resolve) => setTimeout(resolve, backoffMs));
}

/**
 * Fetches package metadata from NPM registry with retries and caching.
 *
 * @param packageName The package name (e.g., 'react' or '@types/node')
 * @returns Result containing package metadata or error string
 *
 * @example
 * ```typescript
 * const result = await fetchPackageMetadata('react');
 * if (result.success) {
 *   console.log(`Latest version: ${result.data['dist-tags'].latest}`);
 * }
 * ```
 *
 * @remarks
 * - Uses global cache to minimize API calls
 * - Implements rate limiting (100 req/min)
 * - Retries up to 3 times with exponential backoff
 * - Timeout after 5 seconds
 */
export async function fetchPackageMetadata(
	packageName: string,
): Promise<Result<NpmPackageMetadata, string>> {
	// Validate package name
	if (!packageName || typeof packageName !== 'string') {
		return failure('Invalid package name: must be a non-empty string');
	}

	const trimmedName = packageName.trim();
	if (trimmedName.length === 0) {
		return failure('Invalid package name: cannot be empty');
	}

	// Check cache first
	const cacheKey = `metadata:${trimmedName}`;
	const cached = npmRegistryCache.get(cacheKey);
	if (cached && isNpmPackageMetadata(cached)) {
		return success(cached);
	}

	// Acquire rate limit token
	await npmRegistryRateLimiter.acquire();

	// Fetch with retries
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const url = `${NPM_REGISTRY_URL}/${encodeURIComponent(trimmedName)}`;
			const controller = createAbortController(FETCH_TIMEOUT_MS);

			const response = await fetch(url, { signal: controller.signal });

			if (!response.ok) {
				// 404 means package doesn't exist, don't retry
				if (response.status === 404) {
					return failure(
						`Package "${trimmedName}" not found in NPM registry`,
					);
				}

				// 429 means rate limited, wait longer
				if (response.status === 429) {
					await delay(RETRY_DELAY_MS * 2, attempt);
					continue;
				}

				// Other errors, retry
				if (attempt < MAX_RETRIES - 1) {
					await delay(RETRY_DELAY_MS, attempt);
					continue;
				}

				return failure(
					`HTTP ${response.status}: ${response.statusText} for package ${trimmedName}`,
				);
			}

			const json: unknown = await response.json();

			if (!isNpmPackageMetadata(json)) {
				return failure(`Invalid metadata format for package ${trimmedName}`);
			}

			// Cache the result
			npmRegistryCache.set(cacheKey, json);

			return success(json);
		} catch (error) {
			if (error instanceof Error) {
				// AbortError means timeout
				if (error.name === 'AbortError') {
					if (attempt < MAX_RETRIES - 1) {
						await delay(RETRY_DELAY_MS, attempt);
						continue;
					}
					return failure(
						`Timeout: NPM registry did not respond within ${FETCH_TIMEOUT_MS}ms for ${trimmedName}`,
					);
				}

				// Network error, retry
				if (attempt < MAX_RETRIES - 1) {
					await delay(RETRY_DELAY_MS, attempt);
					continue;
				}

				return failure(
					`Error fetching NPM registry data for ${trimmedName}: ${error.message}`,
				);
			}

			return failure(
				`Unknown error fetching NPM registry data for ${trimmedName}`,
			);
		}
	}

	return failure(`Failed to fetch package metadata for ${trimmedName} after ${MAX_RETRIES} attempts`);
}

/**
 * Fetches latest version information for a package.
 * More efficient than fetching full metadata when only latest version is needed.
 *
 * @param packageName The package name
 * @returns Result containing the latest version string
 */
export async function fetchLatestVersion(
	packageName: string,
): Promise<Result<string, string>> {
	const metadataResult = await fetchPackageMetadata(packageName);

	if (!metadataResult.success) {
		return failure(metadataResult.error);
	}

	const latest = metadataResult.data['dist-tags'].latest;

	if (!latest) {
		return failure(`No latest version found for package ${packageName}`);
	}

	return success(latest);
}

/**
 * Fetches license information for a specific package version.
 *
 * @param packageName The package name
 * @param version The package version (defaults to latest)
 * @returns Result containing the license string
 */
export async function fetchPackageLicense(
	packageName: string,
	version?: string,
): Promise<Result<string, string>> {
	const metadataResult = await fetchPackageMetadata(packageName);

	if (!metadataResult.success) {
		return failure(metadataResult.error);
	}

	const targetVersion =
		version || metadataResult.data['dist-tags'].latest;
	const versionInfo = metadataResult.data.versions[targetVersion];

	if (!versionInfo) {
		return failure(
			`Version ${targetVersion} not found for package ${packageName}`,
		);
	}

	if (!versionInfo.license) {
		return failure(`No license information found for ${packageName}@${targetVersion}`);
	}

	return success(versionInfo.license);
}
