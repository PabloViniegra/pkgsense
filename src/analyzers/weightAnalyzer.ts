import * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';
import { type Result, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import {
	type BundlephobiaInfo,
	fetchBundlephobia,
} from '../utils/bundlephobia';
import type { Analyzer, AnalysisContext, LineRange } from './types';

/**
 * Dependencies for the weight analyzer.
 * Following Dependency Inversion Principle - depend on abstractions.
 */
export interface WeightAnalyzerDeps {
	/**
	 * Function to fetch package size information.
	 * Injected to enable testing with mock implementations.
	 */
	readonly fetchPackageSize: (
		name: string,
		version: string,
	) => Promise<Result<BundlephobiaInfo, string>>;
}

/**
 * Default dependencies using the real bundlephobia API.
 */
const DEFAULT_DEPS: WeightAnalyzerDeps = {
	fetchPackageSize: fetchBundlephobia,
};

/**
 * Categorizes package size and returns appropriate finding.
 * Pure function - no side effects.
 */
function categorizePackageSize(
	name: string,
	version: string,
	size: number,
	range: LineRange | undefined,
): Finding | null {
	const sizeInKB = (size / CONSTANTS.BYTES_TO_KB).toFixed(1);

	// Convert LineRange to vscode.Range if available
	const vscodeRange = range
		? new vscode.Range(
				range.startLine,
				range.startCharacter,
				range.endLine,
				range.endCharacter,
			)
		: undefined;

	if (size > CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD) {
		return {
			type: 'error',
			message: `Very heavy package: ${name}@${version} - ${sizeInKB} KB`,
			dependency: name,
			range: vscodeRange,
			tags: [FINDING_TAGS.PERFORMANCE],
		};
	}

	if (size > CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD) {
		return {
			type: 'warning',
			message: `Heavy package: ${name}@${version} - ${sizeInKB} KB`,
			dependency: name,
			range: vscodeRange,
			tags: [FINDING_TAGS.PERFORMANCE],
		};
	}

	if (size > CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD) {
		return {
			type: 'info',
			message: `Moderately large package: ${name}@${version}`,
			dependency: name,
			range: vscodeRange,
			tags: [FINDING_TAGS.PERFORMANCE],
		};
	}

	return null;
}

/**
 * Creates a weight analyzer that checks package bundle sizes.
 *
 * Factory pattern with dependency injection enables:
 * - Testing with mock bundlephobia client
 * - Swapping API providers without changing analyzer logic
 * - Dependency inversion principle compliance
 */
export function createWeightAnalyzer(
	deps: WeightAnalyzerDeps = DEFAULT_DEPS,
): Analyzer {
	return {
		name: 'weight',

		async analyze(context: AnalysisContext) {
			const { allDependencies, dependencyRanges } = context;
			const findings: Finding[] = [];
			const entries = Object.entries(allDependencies);

			// Process dependencies in parallel for better performance
			const results = await Promise.allSettled(
				entries.map(async ([name, version]) => {
					const result = await deps.fetchPackageSize(name, version);

					if (!result.success) {
						console.warn(
							`Failed to fetch bundlephobia data for ${name}: ${result.error}`,
						);
						return null;
					}

					return categorizePackageSize(
						name,
						version,
						result.data.size,
						dependencyRanges[name],
					);
				}),
			);

			// Collect successful findings
			for (const result of results) {
				if (result.status === 'fulfilled' && result.value !== null) {
					findings.push(result.value);
				}
			}

			return success(findings);
		},
	};
}

// Type alias for dependency entries
type DependencyEntry = readonly [name: string, version: string];

// Readonly map of dependency ranges
type DependencyRanges = Readonly<Record<string, vscode.Range>>;

/**
 * @deprecated Use createWeightAnalyzer() factory instead.
 * Kept for backward compatibility during migration.
 */
export async function weightAnalyzer(
	entries: readonly DependencyEntry[],
	depRanges: DependencyRanges,
): Promise<readonly Finding[]> {
	const findings: Finding[] = [];

	for (const [name, version] of entries) {
		const result = await fetchBundlephobia(name, version);

		if (!result.success) {
			console.warn(
				`Failed to fetch bundlephobia data for ${name}: ${result.error}`,
			);
			continue;
		}

		const { size } = result.data;
		const sizeInKB = (size / CONSTANTS.BYTES_TO_KB).toFixed(1);

		if (size > CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD) {
			findings.push({
				type: 'error',
				message: `Very heavy package: ${name}@${version} - ${sizeInKB} KB`,
				dependency: name,
				range: depRanges[name],
				tags: [FINDING_TAGS.PERFORMANCE],
			});
		} else if (size > CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD) {
			findings.push({
				type: 'warning',
				message: `Heavy package: ${name}@${version} - ${sizeInKB} KB`,
				dependency: name,
				range: depRanges[name],
				tags: [FINDING_TAGS.PERFORMANCE],
			});
		} else if (size > CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD) {
			findings.push({
				type: 'info',
				message: `Moderately large package: ${name}@${version}`,
				dependency: name,
				range: depRanges[name],
				tags: [FINDING_TAGS.PERFORMANCE],
			});
		}
	}

	return findings;
}
