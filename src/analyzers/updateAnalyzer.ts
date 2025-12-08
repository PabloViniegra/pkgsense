import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import { fetchLatestVersion } from '../utils/npmRegistry';
import {
	getUpdateType,
	isPreRelease,
	sanitizeVersion,
	type UpdateType,
} from '../utils/semverHelper';
import type { Analyzer, AnalysisContext, AnalyzerError } from './types';

/**
 * Update Analyzer - Detects outdated dependencies with available updates.
 *
 * Checks for:
 * - Major updates (breaking changes) → WARNING
 * - Minor updates (new features) → INFO
 * - Patch updates (bug fixes) → INFO
 * - Pre-release versions (skipped)
 *
 * Uses NPM registry API to fetch latest versions and compares with
 * currently installed versions using semver.
 *
 * @example
 * ```typescript
 * const analyzer = createUpdateAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} outdated dependencies`);
 * }
 * ```
 */

/**
 * Information about an available update.
 */
interface UpdateInfo {
	readonly packageName: string;
	readonly currentVersion: string;
	readonly latestVersion: string;
	readonly updateType: UpdateType;
}

/**
 * Fetches latest versions for all dependencies.
 */
async function fetchLatestVersions(
	dependencies: Record<string, string>,
): Promise<Map<string, string>> {
	const latestVersions = new Map<string, string>();

	const entries = Object.entries(dependencies);

	for (const [packageName, currentVersion] of entries) {
		const result = await fetchLatestVersion(packageName);

		if (result.success) {
			latestVersions.set(packageName, result.data);
		}
		// If fetch fails, skip this package (no update info available)
	}

	return latestVersions;
}

/**
 * Compares current versions with latest versions to find updates.
 */
function findUpdates(
	dependencies: Record<string, string>,
	latestVersions: Map<string, string>,
): UpdateInfo[] {
	const updates: UpdateInfo[] = [];

	for (const [packageName, currentVersionRaw] of Object.entries(dependencies)) {
		const latestVersion = latestVersions.get(packageName);

		if (!latestVersion) {
			// No latest version info available, skip
			continue;
		}

		// Skip pre-release versions
		if (isPreRelease(latestVersion)) {
			continue;
		}

		const currentVersion = sanitizeVersion(currentVersionRaw);
		const updateType = getUpdateType(currentVersion, latestVersion);

		if (updateType) {
			updates.push({
				packageName,
				currentVersion,
				latestVersion,
				updateType,
			});
		}
	}

	return updates;
}

/**
 * Converts update info to findings.
 * Note: ranges will be converted to vscode.Range by the manager.
 */
function createFindingsFromUpdates(updates: UpdateInfo[]): Finding[] {
	const findings: Finding[] = [];

	for (const update of updates) {
		const { packageName, currentVersion, latestVersion, updateType } = update;

		// Major updates are warnings (potential breaking changes)
		if (updateType === 'major') {
			findings.push({
				type: 'warning',
				message: `${packageName}: Major update available ${currentVersion} → ${latestVersion} (may contain breaking changes)`,
				dependency: packageName,
				tags: [FINDING_TAGS.UPDATES, FINDING_TAGS.MAINTENANCE],
				meta: {
					currentVersion,
					latestVersion,
					updateType: 'major',
				},
			});
		}
		// Minor updates are info (new features, backward compatible)
		else if (updateType === 'minor') {
			findings.push({
				type: 'info',
				message: `${packageName}: Minor update available ${currentVersion} → ${latestVersion} (new features)`,
				dependency: packageName,
				tags: [FINDING_TAGS.UPDATES, FINDING_TAGS.MAINTENANCE],
				meta: {
					currentVersion,
					latestVersion,
					updateType: 'minor',
				},
			});
		}
		// Patch updates are info (bug fixes)
		else if (updateType === 'patch') {
			findings.push({
				type: 'info',
				message: `${packageName}: Patch update available ${currentVersion} → ${latestVersion} (bug fixes)`,
				dependency: packageName,
				tags: [FINDING_TAGS.UPDATES, FINDING_TAGS.MAINTENANCE],
				meta: {
					currentVersion,
					latestVersion,
					updateType: 'patch',
				},
			});
		}
	}

	return findings;
}

/**
 * Analyzes dependencies for available updates.
 */
async function analyze(
	context: AnalysisContext,
): Promise<Result<Finding[], AnalyzerError>> {
	const findings: Finding[] = [];

	// Skip if no dependencies
	if (
		!context.allDependencies ||
		Object.keys(context.allDependencies).length === 0
	) {
		return success(findings);
	}

	try {
		// Fetch latest versions for all dependencies
		const latestVersions = await fetchLatestVersions(context.allDependencies);

		// Find updates by comparing versions
		const updates = findUpdates(context.allDependencies, latestVersions);

		// Convert updates to findings
		const updateFindings = createFindingsFromUpdates(updates);

		findings.push(...updateFindings);

		return success(findings);
	} catch (error) {
		return failure({
			code: 'UPDATE_ANALYSIS_ERROR',
			message:
				error instanceof Error ? error.message : 'Failed to analyze updates',
		});
	}
}

/**
 * Creates an UpdateAnalyzer instance.
 *
 * @returns Analyzer instance for update detection
 */
export function createUpdateAnalyzer(): Analyzer {
	return {
		name: 'update',
		analyze,
	};
}

/**
 * Default UpdateAnalyzer instance.
 */
export const updateAnalyzer = createUpdateAnalyzer();
