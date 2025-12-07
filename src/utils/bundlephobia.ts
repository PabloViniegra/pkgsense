import fetch from 'node-fetch';
import { type Result, failure, success } from '../shared/result';

// Bundlephobia package information with readonly fields
export interface BundlephobiaInfo {
	readonly size: number;
	readonly gzip: number;
}

// Raw API response from Bundlephobia
interface BundlephobiaResponse {
	readonly size?: number;
	readonly gzip?: number;
}

// Type guard with comprehensive validation
function isBundlephobiaResponse(data: unknown): data is BundlephobiaResponse {
	if (typeof data !== 'object' || data === null) {
		return false;
	}

	const obj = data as Record<string, unknown>;

	// Check that size and gzip are numbers if present
	if ('size' in obj && obj.size !== undefined && typeof obj.size !== 'number') {
		return false;
	}

	if ('gzip' in obj && obj.gzip !== undefined && typeof obj.gzip !== 'number') {
		return false;
	}

	// Must have at least one of size or gzip
	return 'size' in obj || 'gzip' in obj;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_PACKAGE_NAME_LENGTH = 214;

function createAbortController(timeoutMs: number): AbortController {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), timeoutMs);
	return controller;
}

function sanitizePackageName(name: string): Result<string, string> {
	if (!name || typeof name !== 'string') {
		return failure('Invalid package name: must be a non-empty string');
	}

	const trimmed = name.trim();

	if (trimmed.length === 0) {
		return failure('Invalid package name: cannot be empty');
	}

	if (trimmed.length > MAX_PACKAGE_NAME_LENGTH) {
		return failure(
			`Invalid package name: exceeds maximum length of ${MAX_PACKAGE_NAME_LENGTH} characters`,
		);
	}

	const validNameRegex =
		/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
	if (!validNameRegex.test(trimmed)) {
		return failure('Invalid package name: contains invalid characters');
	}

	return success(trimmed);
}

function sanitizeVersion(version: string): string {
	const sanitized = (version || '').toString().replace(/^[^0-9]*/, '');
	return sanitized || 'latest';
}

/**
 * Fetches package bundle size information from the Bundlephobia API.
 *
 * @param name - The package name (e.g., 'react' or '@types/node')
 * @param version - The package version (e.g., '18.0.0' or '^18.0.0')
 * @returns A Result containing BundlephobiaInfo with size data, or an error string
 *
 * @example
 * ```typescript
 * const result = await fetchBundlephobia('react', '18.2.0');
 * if (result.success) {
 *   console.log(`Size: ${result.data.size} bytes`);
 * }
 * ```
 *
 * @remarks
 * - Validates and sanitizes package names to prevent injection attacks
 * - Applies a 5-second timeout to prevent hanging requests
 * - Handles network errors and invalid responses gracefully
 */
export async function fetchBundlephobia(
	name: string,
	version: string,
): Promise<Result<BundlephobiaInfo, string>> {
	const nameValidation = sanitizePackageName(name);
	if (!nameValidation.success) {
		return failure(nameValidation.error);
	}

	const sanitizedName = nameValidation.data;
	const sanitizedVersion = sanitizeVersion(version);
	const pkg = encodeURIComponent(`${sanitizedName}@${sanitizedVersion}`);
	const url = `https://bundlephobia.com/api/size?package=${pkg}`;

	const controller = createAbortController(FETCH_TIMEOUT_MS);

	try {
		const res = await fetch(url, { signal: controller.signal });

		if (!res.ok) {
			return failure(
				`HTTP ${res.status}: ${res.statusText} for package ${sanitizedName}@${sanitizedVersion}`,
			);
		}

		const json: unknown = await res.json();

		if (!isBundlephobiaResponse(json)) {
			return failure(
				`Invalid response format from Bundlephobia for ${sanitizedName}`,
			);
		}

		return success({
			size: json.size || 0,
			gzip: json.gzip || 0,
		});
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				return failure(
					`Request timeout: Bundlephobia API did not respond within ${FETCH_TIMEOUT_MS}ms for ${sanitizedName}`,
				);
			}
			return failure(
				`Error fetching bundlephobia data for ${sanitizedName}: ${error.message}`,
			);
		}
		return failure(
			`Error fetching bundlephobia data for ${sanitizedName}: Unknown error`,
		);
	}
}
