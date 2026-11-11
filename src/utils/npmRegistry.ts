import fetch from 'node-fetch';
import * as semver from 'semver';
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
				readonly license?: unknown;
				readonly licenses?: unknown;
				readonly deprecated?: unknown;
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

	// Using bracket notation due to TypeScript strict indexing with Record<string, unknown>
	return (
		typeof obj['name'] === 'string' &&
		typeof obj['versions'] === 'object' &&
		obj['versions'] !== null &&
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
	const nameResult = validatePackageName(packageName);
	if (!nameResult.success) {
		return nameResult;
	}
	const trimmedName = nameResult.data;

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
		const outcome = await attemptFetch(
			trimmedName,
			attempt === MAX_RETRIES - 1,
		);
		if (outcome.kind === 'done') {
			if (outcome.result.success) {
				// Cache the result
				npmRegistryCache.set(cacheKey, outcome.result.data);
			}
			return outcome.result;
		}
		await delay(outcome.delayMs, attempt);
	}

	return failure(
		`Failed to fetch package metadata for ${trimmedName} after ${MAX_RETRIES} attempts`,
	);
}

type AttemptOutcome =
	| {
			readonly kind: 'done';
			readonly result: Result<NpmPackageMetadata, string>;
	  }
	| { readonly kind: 'retry'; readonly delayMs: number };

const done = (result: Result<NpmPackageMetadata, string>): AttemptOutcome => ({
	kind: 'done',
	result,
});

const retryUnlessLast = (isLast: boolean, message: string): AttemptOutcome =>
	isLast ? done(failure(message)) : { kind: 'retry', delayMs: RETRY_DELAY_MS };

function validatePackageName(packageName: string): Result<string, string> {
	// Validate package name
	if (!packageName || typeof packageName !== 'string') {
		return failure('Invalid package name: must be a non-empty string');
	}

	const trimmedName = packageName.trim();
	if (trimmedName.length === 0) {
		return failure('Invalid package name: cannot be empty');
	}

	return success(trimmedName);
}

async function attemptFetch(
	name: string,
	isLast: boolean,
): Promise<AttemptOutcome> {
	try {
		const url = `${NPM_REGISTRY_URL}/${encodeURIComponent(name)}`;
		const controller = createAbortController(FETCH_TIMEOUT_MS);

		// Type cast required due to node-fetch vs DOM AbortSignal incompatibility
		// The node-fetch library expects a different AbortSignal type than the DOM standard
		// This is a known limitation and the cast is safe in this context
		const response = await fetch(url, {
			// biome-ignore lint/suspicious/noExplicitAny: node-fetch 2 types its own AbortSignal
			signal: controller.signal as any,
		});

		if (!response.ok) {
			return outcomeForStatus(response, name, isLast);
		}

		const json: unknown = await response.json();

		return done(
			isNpmPackageMetadata(json)
				? success(json)
				: failure(`Invalid metadata format for package ${name}`),
		);
	} catch (error) {
		return outcomeForError(error, name, isLast);
	}
}

function outcomeForStatus(
	response: { readonly status: number; readonly statusText: string },
	name: string,
	isLast: boolean,
): AttemptOutcome {
	// 404 means package doesn't exist, don't retry
	if (response.status === 404) {
		return done(failure(`Package "${name}" not found in NPM registry`));
	}

	// 429 means rate limited, wait longer
	if (response.status === 429) {
		return { kind: 'retry', delayMs: RETRY_DELAY_MS * 2 };
	}

	// Other errors, retry
	return retryUnlessLast(
		isLast,
		`HTTP ${response.status}: ${response.statusText} for package ${name}`,
	);
}

function outcomeForError(
	error: unknown,
	name: string,
	isLast: boolean,
): AttemptOutcome {
	if (!(error instanceof Error)) {
		return done(
			failure(`Unknown error fetching NPM registry data for ${name}`),
		);
	}

	// AbortError means timeout
	if (error.name === 'AbortError') {
		return retryUnlessLast(
			isLast,
			`Timeout: NPM registry did not respond within ${FETCH_TIMEOUT_MS}ms for ${name}`,
		);
	}

	// Network error, retry
	return retryUnlessLast(
		isLast,
		`Error fetching NPM registry data for ${name}: ${error.message}`,
	);
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

type NpmVersionInfo = NpmPackageMetadata['versions'][string];

function hasStringType(value: unknown): value is { type: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

/**
 * Normalizes the license of a published version to an SPDX-like string.
 * Old packages publish `license: { type }` or a `licenses` array instead of a string.
 */
export function normalizeLicense(versionInfo: NpmVersionInfo): string | null {
	const { license, licenses } = versionInfo;

	if (typeof license === 'string' && license.trim().length > 0) {
		return license.trim();
	}
	if (hasStringType(license)) {
		return license.type;
	}
	if (Array.isArray(licenses)) {
		const types = licenses.filter(hasStringType).map((l) => l.type);
		if (types.length > 0) {
			return types.length === 1
				? (types[0] ?? null)
				: `(${types.join(' OR ')})`;
		}
	}

	return null;
}

function isDeprecated(info: NpmVersionInfo | undefined): boolean {
	return typeof info?.deprecated === 'string' && info.deprecated.trim() !== '';
}

/**
 * Resolves the version a package.json specifier points to, the way a fresh
 * npm install would: the latest dist-tag if it satisfies the range and is not
 * deprecated, otherwise the highest satisfying version that is not deprecated,
 * and only when every match is deprecated, the highest match.
 * Returns null for specifiers that are not registry ranges (workspace:, file:, git, tags).
 */
export function resolveVersion(
	metadata: NpmPackageMetadata,
	spec: string | undefined,
): string | null {
	const latest = metadata['dist-tags'].latest;

	if (!spec || spec.trim() === '' || spec === 'latest') {
		return latest && metadata.versions[latest] ? latest : null;
	}
	if (metadata.versions[spec]) {
		return spec;
	}
	if (!semver.validRange(spec)) {
		return null;
	}

	const latestInfo = latest ? metadata.versions[latest] : undefined;
	if (
		latest &&
		latestInfo &&
		!isDeprecated(latestInfo) &&
		semver.satisfies(latest, spec)
	) {
		return latest;
	}

	const versions = Object.keys(metadata.versions);
	const supported = versions.filter((v) => !isDeprecated(metadata.versions[v]));

	return (
		semver.maxSatisfying(supported, spec) ??
		semver.maxSatisfying(versions, spec)
	);
}

/**
 * Fetches license information for the version a specifier resolves to.
 * Succeeds with null when that version publishes no license; fails only when
 * the lookup itself could not be completed.
 *
 * @param packageName The package name
 * @param version The version or range from package.json (defaults to latest)
 */
export async function fetchPackageLicense(
	packageName: string,
	version?: string,
): Promise<Result<string | null, string>> {
	const metadataResult = await fetchPackageMetadata(packageName);

	if (!metadataResult.success) {
		return failure(metadataResult.error);
	}

	const targetVersion = resolveVersion(metadataResult.data, version);
	const versionInfo = targetVersion
		? metadataResult.data.versions[targetVersion]
		: undefined;

	if (!targetVersion || !versionInfo) {
		return failure(
			`No published version of ${packageName} matches "${version ?? 'latest'}"`,
		);
	}

	return success(normalizeLicense(versionInfo));
}

/**
 * Deprecation notice published on the npm registry for a resolved version.
 */
export interface DeprecationNotice {
	readonly version: string;
	readonly message: string;
}

/**
 * Fetches the deprecation notice of the version a specifier resolves to.
 * Succeeds with null when that version is not deprecated.
 */
export async function fetchDeprecation(
	packageName: string,
	spec: string,
): Promise<Result<DeprecationNotice | null, string>> {
	const metadataResult = await fetchPackageMetadata(packageName);

	if (!metadataResult.success) {
		return failure(metadataResult.error);
	}

	const version = resolveVersion(metadataResult.data, spec);
	const deprecated = version
		? metadataResult.data.versions[version]?.deprecated
		: undefined;

	if (!version || typeof deprecated !== 'string' || deprecated.trim() === '') {
		return success(null);
	}

	return success({ version, message: deprecated.trim() });
}
