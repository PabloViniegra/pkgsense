import * as semver from 'semver';
import { CONSTANTS } from '../shared/constants';
import { type Result, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import {
	type BundlephobiaInfo,
	fetchBundlephobia,
} from '../utils/bundlephobia';
import type { Analyzer, AnalysisContext } from './types';

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

interface SizeCategory {
	readonly threshold: number;
	readonly label: string;
	readonly type: Finding['type'];
}

// Ordered from largest to smallest threshold
const SIZE_CATEGORIES: readonly SizeCategory[] = [
	{
		threshold: CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD,
		label: 'Very heavy package',
		type: 'warning',
	},
	{
		threshold: CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD,
		label: 'Heavy package',
		type: 'info',
	},
	{
		threshold: CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD,
		label: 'Moderately large package',
		type: 'info',
	},
];

function formatKB(bytes: number): string {
	return `${(bytes / CONSTANTS.BYTES_TO_KB).toFixed(1)} KB`;
}

const BUNDLEPHOBIA_PACKAGE_URL = 'https://bundlephobia.com/package/';

/**
 * What was measured. A range is never presented as a version: when
 * Bundlephobia does not say which version it measured, the message says so.
 */
function describeMeasured(name: string, spec: string, version?: string) {
	return version
		? {
				label: `${name}@${version}`,
				url: `${BUNDLEPHOBIA_PACKAGE_URL}${name}@${version}`,
			}
		: {
				label: `${name} (range ${spec}, measured version not reported)`,
				url: `${BUNDLEPHOBIA_PACKAGE_URL}${name}`,
			};
}

/**
 * Categorizes package size and returns appropriate finding.
 * The message names the version that was measured so the figure can be
 * checked on bundlephobia.com.
 */
function categorizePackageSize(
	name: string,
	spec: string,
	info: BundlephobiaInfo,
): Finding | null {
	const category = SIZE_CATEGORIES.find((c) => info.size > c.threshold);
	if (!category) {
		return null;
	}

	const measured = describeMeasured(name, spec, info.version);
	return {
		type: category.type,
		message: `${category.label}: ${measured.label} - ${formatKB(info.size)} minified (${formatKB(info.gzip)} gzipped)`,
		dependency: name,
		tags: [FINDING_TAGS.PERFORMANCE],
		meta: { size: info.size, gzip: info.gzip, url: measured.url },
	};
}

/**
 * Creates a weight analyzer that checks package bundle sizes.
 *
 * Only production dependencies are measured: devDependencies never reach a
 * bundle. Specifiers that are not registry ranges (workspace:, file:, git)
 * are skipped because Bundlephobia cannot resolve them.
 */
export function createWeightAnalyzer(
	deps: WeightAnalyzerDeps = DEFAULT_DEPS,
): Analyzer {
	return {
		name: 'weight',

		async analyze(context: AnalysisContext) {
			const { packageJson } = context;
			const entries = Object.entries(packageJson.dependencies ?? {}).filter(
				([, spec]) => semver.validRange(spec) !== null,
			);

			// Process dependencies in parallel for better performance
			const results = await Promise.allSettled(
				entries.map(async ([name, spec]) => {
					const result = await deps.fetchPackageSize(name, spec);

					if (!result.success) {
						console.warn(
							`Failed to fetch bundlephobia data for ${name}: ${result.error}`,
						);
						return null;
					}

					return categorizePackageSize(name, spec, result.data);
				}),
			);

			const findings: Finding[] = [];
			for (const result of results) {
				if (result.status === 'fulfilled' && result.value !== null) {
					findings.push(result.value);
				}
			}

			return success(findings);
		},
	};
}
