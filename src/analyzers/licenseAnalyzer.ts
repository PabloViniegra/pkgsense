import * as semver from 'semver';
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
	) => Promise<Result<string | null, string>>;
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
 * Checks production dependencies for:
 * - Strong copyleft licenses (GPL/AGPL) and conflicts with the package license
 * - Dependencies declared UNLICENSED
 * - Dependencies that publish no license
 * - Dependencies whose license could not be looked up (one summary finding)
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

interface LicenseLookup {
	/** License per dependency; null when the resolved version publishes none */
	readonly licenses: Map<string, string | null>;
	/** Dependencies the registry could not answer for, with the reason */
	readonly failures: Map<string, string>;
}
const STRONG_COPYLEFT_ID = /^A?GPL/i;

/**
 * Splits an SPDX expression into its OR alternatives, each a list of license ids.
 * "(MIT OR GPL-3.0-only)" → [["MIT"], ["GPL-3.0-only"]]
 */
function licenseAlternatives(expression: string): string[][] {
	return expression
		.replace(/[()]/g, ' ')
		.split(/\s+OR\s+/i)
		.map((alternative) =>
			alternative
				.split(/\s+AND\s+/i)
				.map((id) => id.replace(/\s+WITH\s+.*$/i, '').trim())
				.filter((id) => id.length > 0),
		)
		.filter((alternative) => alternative.length > 0);
}

/**
 * A dependency is strong copyleft only when every licensing option it offers
 * is GPL/AGPL. Dual licenses such as "(MIT OR GPL-3.0)" let you pick MIT, and
 * LGPL does not extend to code that merely links the library.
 */
function isStrongCopyleft(license: string): boolean {
	const alternatives = licenseAlternatives(license);

	return (
		alternatives.length > 0 &&
		alternatives.every((ids) => ids.some((id) => STRONG_COPYLEFT_ID.test(id)))
	);
}

function normalizeLicenseId(id: string): string {
	return id
		.toUpperCase()
		.replace(/-(ONLY|OR-LATER)$/, '')
		.replace(/\+$/, '')
		.replace(/[-._ ]/g, '');
}

/**
 * Checks if two license ids are a known incompatible pair.
 */
function areIncompatible(license1: string, license2: string): boolean {
	const norm1 = normalizeLicenseId(license1);
	const norm2 = normalizeLicenseId(license2);

	return CONSTANTS.INCOMPATIBLE_LICENSE_PAIRS.some(([lic1, lic2]) => {
		const normPair1 = normalizeLicenseId(lic1);
		const normPair2 = normalizeLicenseId(lic2);

		return (
			(norm1 === normPair1 && norm2 === normPair2) ||
			(norm1 === normPair2 && norm2 === normPair1)
		);
	});
}

function conflictsWithPackageLicense(
	packageLicense: string,
	dependencyLicense: string,
): boolean {
	return licenseAlternatives(dependencyLicense)
		.flat()
		.some((id) => areIncompatible(packageLicense, id));
}

/**
 * Creates a function to fetch licenses for all dependencies.
 * Uses dependency injection for the fetch function.
 */
function createFetchDependencyLicenses(
	fetchLicense: LicenseAnalyzerDeps['fetchPackageLicense'],
) {
	return async function fetchDependencyLicenses(
		dependencies: Readonly<Record<string, string>>,
	): Promise<LicenseLookup> {
		const licenses = new Map<string, string | null>();
		const failures = new Map<string, string>();

		for (const [packageName, spec] of Object.entries(dependencies)) {
			// workspace:, file:, git URLs and aliases are not on the registry
			if (!semver.validRange(spec)) {
				continue;
			}

			const result = await fetchLicense(packageName, spec);
			if (result.success) {
				licenses.set(packageName, result.data);
			} else {
				console.warn(
					`License lookup failed for ${packageName}: ${result.error}`,
				);
				failures.set(packageName, result.error);
			}
		}

		return { licenses, failures };
	};
}

function createCopyleftFinding(
	packageName: string,
	license: string,
	packageLicense: string | undefined,
): Finding | null {
	// A copyleft package depending on copyleft code is the expected case
	if (packageLicense && isStrongCopyleft(packageLicense)) {
		return null;
	}

	const conflict =
		packageLicense !== undefined &&
		conflictsWithPackageLicense(packageLicense, license);

	const message = conflict
		? `License conflict: "${packageName}" is licensed ${license} (strong copyleft), which is incompatible with distributing your package under ${packageLicense}.`
		: `Strong copyleft dependency: "${packageName}" is licensed ${license}. Distributing your package with it requires complying with that license.`;

	return {
		type: 'warning',
		message,
		dependency: packageName,
		tags: [FINDING_TAGS.LICENSE],
		meta: { license, url: `https://www.npmjs.com/package/${packageName}` },
	};
}

function checkLicense(
	packageName: string,
	license: string | null,
	packageLicense: string | undefined,
): Finding | null {
	const evidence = { url: `https://www.npmjs.com/package/${packageName}` };

	if (license === null) {
		return {
			type: 'info',
			message: `"${packageName}" publishes no license information. Manual verification recommended.`,
			dependency: packageName,
			tags: [FINDING_TAGS.LICENSE],
			meta: evidence,
		};
	}

	if (license === 'UNLICENSED') {
		return {
			type: 'warning',
			message: `"${packageName}" is declared UNLICENSED: its author grants no usage rights.`,
			dependency: packageName,
			tags: [FINDING_TAGS.LICENSE],
			meta: { license, ...evidence },
		};
	}

	return isStrongCopyleft(license)
		? createCopyleftFinding(packageName, license, packageLicense)
		: null;
}

function createLookupFailureFinding(failures: Map<string, string>): Finding {
	const names = [...failures.keys()];
	const [firstError] = failures.values();

	return {
		type: 'info',
		message: `Could not check the license of ${names.length} ${names.length === 1 ? 'dependency' : 'dependencies'} (${names.join(', ')}): ${firstError}`,
		location: ['dependencies'],
		tags: [FINDING_TAGS.LICENSE],
		meta: { packages: names },
	};
}

/**
 * Checks the licenses of production dependencies against the package license.
 */
function checkDependencyLicenses(
	{ licenses, failures }: LicenseLookup,
	packageLicense?: string,
): Finding[] {
	const findings: Finding[] = [];

	for (const [packageName, license] of licenses) {
		const finding = checkLicense(packageName, license, packageLicense);
		if (finding) {
			findings.push(finding);
		}
	}

	if (failures.size > 0) {
		findings.push(createLookupFailureFinding(failures));
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
		// Dev dependencies are not distributed with the package, so their
		// licenses place no obligations on it
		const dependencies = pkg.dependencies ?? {};

		if (Object.keys(dependencies).length === 0) {
			return success(findings);
		}

		try {
			const lookup = await fetchDependencyLicenses(dependencies);

			const packageLicense =
				typeof pkg.license === 'string' ? pkg.license : undefined;

			findings.push(...checkDependencyLicenses(lookup, packageLicense));

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
