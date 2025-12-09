import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import { fetchPackageLicense as defaultFetchPackageLicense } from '../utils/npmRegistry';
import type { Analyzer, AnalysisContext, AnalyzerError } from './types';

/**
 * Dependencies for the license analyzer.
 * Following Dependency Inversion Principle - depend on abstractions.
 */
export interface LicenseAnalyzerDeps {
	/**
	 * Function to fetch package license information.
	 * Injected to enable testing with mock implementations.
	 */
	readonly fetchPackageLicense: (
		packageName: string,
		version?: string,
	) => Promise<Result<string, string>>;
}

/**
 * Default dependencies using the real NPM registry API.
 */
const DEFAULT_DEPS: LicenseAnalyzerDeps = {
	fetchPackageLicense: defaultFetchPackageLicense,
};

/**
 * License Analyzer - Detects license conflicts and issues.
 *
 * Checks for:
 * - GPL/AGPL licenses mixed with permissive licenses (incompatibility)
 * - Missing license information
 * - UNLICENSED packages
 * - License conflicts between dependencies
 *
 * Uses NPM registry API to fetch license information for dependencies.
 *
 * @example
 * ```typescript
 * const analyzer = createLicenseAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} license issues`);
 * }
 * ```
 */

/**
 * Checks if two licenses are incompatible.
 */
function areIncompatible(license1: string, license2: string): boolean {
	// Normalize license strings (remove version numbers, spaces)
	const norm1 = license1.toUpperCase().replace(/[-._ ]/g, '');
	const norm2 = license2.toUpperCase().replace(/[-._ ]/g, '');

	for (const [lic1, lic2] of CONSTANTS.INCOMPATIBLE_LICENSE_PAIRS) {
		const normPair1 = lic1.toUpperCase().replace(/[-._ ]/g, '');
		const normPair2 = lic2.toUpperCase().replace(/[-._ ]/g, '');

		// Check both directions
		if (
			(norm1 === normPair1 && norm2 === normPair2) ||
			(norm1 === normPair2 && norm2 === normPair1)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Categorizes a license as copyleft or permissive.
 */
function isCopyleftLicense(license: string): boolean {
	const normalized = license.toUpperCase().replace(/[-._ ]/g, '');

	return (
		normalized.includes('GPL') ||
		normalized.includes('AGPL') ||
		normalized.includes('LGPL')
	);
}

/**
 * Creates a function to fetch licenses for all dependencies.
 * Uses dependency injection for the fetch function.
 */
function createFetchDependencyLicenses(
	fetchLicense: LicenseAnalyzerDeps['fetchPackageLicense'],
) {
	return async function fetchDependencyLicenses(
		dependencies: Record<string, string>,
	): Promise<Map<string, string>> {
		const licenses = new Map<string, string>();

		// Fetch licenses in batches to respect rate limiting
		const entries = Object.entries(dependencies);

		for (const [packageName, version] of entries) {
			const result = await fetchLicense(packageName, version);

			if (result.success) {
				licenses.set(packageName, result.data);
			} else {
				// If we can't fetch license, mark as unknown
				licenses.set(packageName, 'UNKNOWN');
			}
		}

		return licenses;
	};
}

/**
 * Checks for license conflicts between dependencies.
 */
function checkLicenseConflicts(
	licenses: Map<string, string>,
	packageLicense?: string,
): Finding[] {
	const findings: Finding[] = [];

	// If package has no license, warn
	if (!packageLicense) {
		findings.push({
			type: 'warning',
			message: 'Package has no license. This may cause legal issues for users.',
			tags: [FINDING_TAGS.LICENSE, FINDING_TAGS.PACKAGING],
		});
	}

	// Check for UNLICENSED
	if (packageLicense === 'UNLICENSED') {
		findings.push({
			type: 'warning',
			message:
				'Package is marked as UNLICENSED. Consider using a standard open-source license.',
			tags: [FINDING_TAGS.LICENSE, FINDING_TAGS.PACKAGING],
		});
	}

	// Check for GPL/AGPL in dependencies
	const copyleftDeps: string[] = [];
	const permissiveDeps: string[] = [];

	for (const [packageName, license] of licenses.entries()) {
		if (license === 'UNKNOWN') {
			findings.push({
				type: 'info',
				message: `Could not determine license for "${packageName}". Manual verification recommended.`,
				dependency: packageName,
				tags: [FINDING_TAGS.LICENSE],
			});
			continue;
		}

		if (isCopyleftLicense(license)) {
			copyleftDeps.push(packageName);
		} else {
			permissiveDeps.push(packageName);
		}
	}

	// Warn about copyleft dependencies
	if (copyleftDeps.length > 0) {
		findings.push({
			type: 'warning',
			message: `Copyleft licenses detected (GPL/AGPL): ${copyleftDeps.join(', ')}. These may require you to open-source your code.`,
			tags: [FINDING_TAGS.LICENSE, FINDING_TAGS.SECURITY],
			meta: {
				copyleftDependencies: copyleftDeps,
			},
		});
	}

	// Check for specific incompatibilities
	if (packageLicense && copyleftDeps.length > 0) {
		for (const dep of copyleftDeps) {
			const depLicense = licenses.get(dep);
			if (depLicense && areIncompatible(packageLicense, depLicense)) {
				findings.push({
					type: 'error',
					message: `License conflict: Your package license (${packageLicense}) is incompatible with dependency "${dep}" (${depLicense}).`,
					dependency: dep,
					tags: [FINDING_TAGS.LICENSE, FINDING_TAGS.SECURITY],
				});
			}
		}
	}

	// Warn about UNLICENSED dependencies
	const unlicensedDeps = Array.from(licenses.entries())
		.filter(([_, license]) => license === 'UNLICENSED')
		.map(([name, _]) => name);

	if (unlicensedDeps.length > 0) {
		findings.push({
			type: 'warning',
			message: `Dependencies without license: ${unlicensedDeps.join(', ')}. Use with caution.`,
			tags: [FINDING_TAGS.LICENSE, FINDING_TAGS.SECURITY],
		});
	}

	return findings;
}

/**
 * Creates an analyze function with injected dependencies.
 */
function createAnalyze(deps: LicenseAnalyzerDeps) {
	const fetchDependencyLicenses = createFetchDependencyLicenses(
		deps.fetchPackageLicense,
	);

	return async function analyze(
		context: AnalysisContext,
	): Promise<Result<Finding[], AnalyzerError>> {
		const findings: Finding[] = [];
		const pkg = context.packageJson;

		// Skip if no dependencies
		if (
			!context.allDependencies ||
			Object.keys(context.allDependencies).length === 0
		) {
			return success(findings);
		}

		try {
			// Fetch licenses for all dependencies
			const licenses = await fetchDependencyLicenses(context.allDependencies);

			// Check for conflicts
			findings.push(...checkLicenseConflicts(licenses, pkg.license));

			return success(findings);
		} catch (error) {
			return failure({
				code: 'LICENSE_ANALYSIS_ERROR',
				message:
					error instanceof Error ? error.message : 'Failed to analyze licenses',
			});
		}
	};
}

/**
 * Creates a LicenseAnalyzer instance with optional dependency injection.
 *
 * Factory pattern with dependency injection enables:
 * - Testing with mock license fetch implementations
 * - Swapping API providers without changing analyzer logic
 * - Dependency inversion principle compliance
 *
 * @param deps - Optional dependencies to inject (defaults to real NPM registry API)
 * @returns Analyzer instance for license analysis
 */
export function createLicenseAnalyzer(
	deps: LicenseAnalyzerDeps = DEFAULT_DEPS,
): Analyzer {
	return {
		name: 'license',
		analyze: createAnalyze(deps),
	};
}

/**
 * Default LicenseAnalyzer instance.
 */
export const licenseAnalyzer = createLicenseAnalyzer();
