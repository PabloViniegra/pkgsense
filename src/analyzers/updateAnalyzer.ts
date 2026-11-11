import * as semver from 'semver';
import { type Result, failure, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import {
	type DeprecationNotice,
	fetchDeprecation as defaultFetchDeprecation,
	fetchLatestVersion as defaultFetchLatestVersion,
} from '../utils/npmRegistry';
import { type UpdateType, getUpdateType } from '../utils/semverHelper';
import type { Analyzer, AnalysisContext, AnalyzerError } from './types';

/**
 * Dependencies for the update analyzer.
 * Following Dependency Inversion Principle - depend on abstractions.
 */
export interface UpdateAnalyzerDeps {
	/**
	 * Function to fetch latest version information.
	 * Injected to enable testing with mock implementations.
	 */
	readonly fetchLatestVersion: (
		packageName: string,
	) => Promise<Result<string, string>>;
	/**
	 * Function to fetch the registry deprecation notice of the version a
	 * specifier resolves to. Omit to skip deprecation checks.
	 */
	readonly fetchDeprecation?: (
		packageName: string,
		spec: string,
	) => Promise<Result<DeprecationNotice | null, string>>;
}

/**
 * Default dependencies using the real NPM registry API.
 */
const DEFAULT_DEPS: UpdateAnalyzerDeps = {
	fetchLatestVersion: defaultFetchLatestVersion,
	fetchDeprecation: defaultFetchDeprecation,
};

interface UpdateDescription {
	readonly label: string;
	readonly hint: string;
	readonly type: Finding['type'];
}

const UPDATE_DESCRIPTIONS: Record<UpdateType, UpdateDescription> = {
	major: {
		label: 'Major',
		hint: 'may contain breaking changes',
		type: 'warning',
	},
	minor: { label: 'Minor', hint: 'new features', type: 'info' },
	patch: { label: 'Patch', hint: 'bug fixes', type: 'info' },
};

function npmPackageUrl(packageName: string): string {
	return `https://www.npmjs.com/package/${packageName}`;
}

/**
 * Reports an update only when the declared range cannot reach the latest
 * release. A range that already admits it (e.g. ^1.2.0 with latest 1.9.0)
 * says nothing about what is installed, so there is nothing verifiable to flag.
 */
function createUpdateFinding(
	packageName: string,
	spec: string,
	latestVersion: string,
): Finding | null {
	if (!semver.valid(latestVersion) || semver.prerelease(latestVersion)) {
		return null;
	}
	if (semver.satisfies(latestVersion, spec)) {
		return null;
	}

	const declaredMinimum = semver.minVersion(spec);
	if (!declaredMinimum) {
		return null;
	}

	const updateType = getUpdateType(declaredMinimum.version, latestVersion);
	if (!updateType) {
		return null;
	}

	const { label, hint, type } = UPDATE_DESCRIPTIONS[updateType];

	return {
		type,
		message: `${packageName}: ${label} update available ${spec} → ${latestVersion} (${hint})`,
		dependency: packageName,
		tags: [FINDING_TAGS.UPDATES],
		meta: {
			currentVersion: spec,
			latestVersion,
			updateType,
			url: `${npmPackageUrl(packageName)}/v/${latestVersion}`,
		},
	};
}

function createDeprecationFinding(
	packageName: string,
	notice: DeprecationNotice,
): Finding {
	return {
		type: 'warning',
		message: `Deprecated on npm: ${packageName}@${notice.version} - ${notice.message}`,
		dependency: packageName,
		tags: [FINDING_TAGS.MAINTENANCE, FINDING_TAGS.REPLACEMENT],
		meta: {
			deprecatedVersion: notice.version,
			url: `${npmPackageUrl(packageName)}/v/${notice.version}`,
		},
	};
}

interface DependencyCheck {
	readonly findings: Finding[];
	/** Why the registry could not answer, when it could not */
	readonly error?: string;
}

async function analyzeDependency(
	deps: UpdateAnalyzerDeps,
	packageName: string,
	spec: string,
): Promise<DependencyCheck> {
	// workspace:, file:, git URLs, aliases and dist-tags are not registry ranges
	if (!semver.validRange(spec)) {
		return { findings: [] };
	}

	const latest = await deps.fetchLatestVersion(packageName);
	if (!latest.success) {
		return { findings: [], error: latest.error };
	}

	const findings: Finding[] = [];
	const update = createUpdateFinding(packageName, spec, latest.data);
	if (update) {
		findings.push(update);
	}

	const deprecation = deps.fetchDeprecation
		? await deps.fetchDeprecation(packageName, spec)
		: null;
	if (deprecation && !deprecation.success) {
		return { findings, error: deprecation.error };
	}
	if (deprecation?.data) {
		findings.push(createDeprecationFinding(packageName, deprecation.data));
	}

	return { findings };
}

function createLookupFailureFinding(failures: Map<string, string>): Finding {
	const names = [...failures.keys()];
	const [firstError] = failures.values();

	return {
		type: 'info',
		message: `Could not check ${names.length} ${names.length === 1 ? 'dependency' : 'dependencies'} for updates (${names.join(', ')}): ${firstError}`,
		location: ['dependencies'],
		tags: [FINDING_TAGS.UPDATES],
		meta: { packages: names },
	};
}

/**
 * Creates an UpdateAnalyzer instance with optional dependency injection.
 *
 * Reports, per dependency:
 * - updates the declared range cannot reach (major → warning, minor/patch → info)
 * - the deprecation notice npm publishes for the resolved version (warning)
 *
 * @param deps - Optional dependencies to inject (defaults to real NPM registry API)
 * @returns Analyzer instance for update detection
 */
export function createUpdateAnalyzer(
	deps: UpdateAnalyzerDeps = DEFAULT_DEPS,
): Analyzer {
	return {
		name: 'update',

		async analyze(
			context: AnalysisContext,
		): Promise<Result<Finding[], AnalyzerError>> {
			const findings: Finding[] = [];
			const failures = new Map<string, string>();

			try {
				for (const [name, spec] of Object.entries(context.allDependencies)) {
					const check = await analyzeDependency(deps, name, spec);
					findings.push(...check.findings);
					if (check.error) {
						console.warn(`Update check failed for ${name}: ${check.error}`);
						failures.set(name, check.error);
					}
				}

				if (failures.size > 0) {
					findings.push(createLookupFailureFinding(failures));
				}

				return success(findings);
			} catch (error) {
				return failure({
					code: 'UPDATE_ANALYSIS_ERROR',
					message:
						error instanceof Error
							? error.message
							: 'Failed to analyze updates',
				});
			}
		},
	};
}
