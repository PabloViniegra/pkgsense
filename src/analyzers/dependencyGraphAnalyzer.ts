import { type Result, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Dependency Graph Analyzer - Analyzes dependency relationships and patterns.
 *
 * Performs static analysis of dependencies to detect:
 * - Excessive number of dependencies (bloat warning)
 * - Version conflicts between dependencies and devDependencies
 * - Common heavy dependencies that could be alternatives
 *
 * Note: Full dependency graph analysis with circular dependency detection
 * would require reading all of node_modules recursively, which is prohibitively
 * expensive for real-time analysis. Package managers (npm/pnpm/yarn) already
 * handle circular dependency resolution. This analyzer focuses on static
 * analysis of package.json for actionable insights.
 *
 * @example
 * ```typescript
 * const analyzer = createDependencyGraphAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} dependency issues`);
 * }
 * ```
 */

// Thresholds for dependency counts
const DEPENDENCY_COUNT_WARNING = 50;
const DEPENDENCY_COUNT_ERROR = 100;

/**
 * Checks for excessive number of dependencies.
 */
function checkDependencyCount(
	deps: Readonly<Record<string, string>>,
	devDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];
	const totalDeps = Object.keys(deps).length;
	const totalDevDeps = Object.keys(devDeps).length;
	const total = totalDeps + totalDevDeps;

	if (total >= DEPENDENCY_COUNT_ERROR) {
		findings.push({
			type: 'warning',
			message: `Very high dependency count: ${total} total (${totalDeps} prod + ${totalDevDeps} dev). Consider reducing dependencies to improve install time and security surface.`,
			tags: [FINDING_TAGS.DEPENDENCIES, FINDING_TAGS.PERFORMANCE],
			meta: {
				total,
				dependencies: totalDeps,
				devDependencies: totalDevDeps,
			},
		});
	} else if (total >= DEPENDENCY_COUNT_WARNING) {
		findings.push({
			type: 'info',
			message: `High dependency count: ${total} total (${totalDeps} prod + ${totalDevDeps} dev). Monitor for unnecessary dependencies.`,
			tags: [FINDING_TAGS.DEPENDENCIES, FINDING_TAGS.QUALITY],
			meta: {
				total,
				dependencies: totalDeps,
				devDependencies: totalDevDeps,
			},
		});
	}

	return findings;
}

/**
 * Checks for version conflicts between dependencies and devDependencies.
 * Same package with different version ranges could indicate a problem.
 */
function checkVersionConflicts(
	deps: Readonly<Record<string, string>>,
	devDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];

	// Find packages in both deps and devDeps
	const depNames = new Set(Object.keys(deps));
	const devDepNames = Object.keys(devDeps);

	for (const name of devDepNames) {
		if (depNames.has(name)) {
			const depVersion = deps[name];
			const devDepVersion = devDeps[name];

			// Only warn if versions are different
			if (depVersion !== devDepVersion) {
				findings.push({
					type: 'warning',
					message: `Version conflict for "${name}": dependencies has ${depVersion}, devDependencies has ${devDepVersion}. This is likely a duplication error.`,
					dependency: name,
					tags: [FINDING_TAGS.DEPENDENCIES, FINDING_TAGS.DUPLICATION],
					meta: {
						dependencyVersion: depVersion,
						devDependencyVersion: devDepVersion,
					},
				});
			}
		}
	}

	return findings;
}

/**
 * Detects common heavy dependencies that have lighter alternatives.
 */
function checkHeavyDependencies(
	allDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];

	// Map of heavy packages to their lighter alternatives
	const heavyPackages: Record<string, { alternative: string; reason: string }> =
		{
			lodash: {
				alternative: 'lodash-es or individual lodash methods',
				reason: 'lodash is large; tree-shakeable alternatives available',
			},
			'moment-timezone': {
				alternative: 'date-fns-tz or Luxon',
				reason: 'moment-timezone is very large; modern alternatives are smaller',
			},
			axios: {
				alternative: 'native fetch or ky',
				reason: 'axios is feature-rich but heavy; fetch API is built-in',
			},
		};

	for (const [packageName, info] of Object.entries(heavyPackages)) {
		if (allDeps[packageName]) {
			findings.push({
				type: 'info',
				message: `"${packageName}" is a heavy dependency. Consider ${info.alternative}. Reason: ${info.reason}`,
				dependency: packageName,
				tags: [FINDING_TAGS.DEPENDENCIES, FINDING_TAGS.PERFORMANCE],
				meta: {
					alternative: info.alternative,
					reason: info.reason,
				},
			});
		}
	}

	return findings;
}

/**
 * Analyzes dependency graph patterns and relationships.
 */
async function analyze(
	context: AnalysisContext,
): Promise<Result<Finding[], never>> {
	const findings: Finding[] = [];
	const deps = context.packageJson.dependencies || {};
	const devDeps = context.packageJson.devDependencies || {};

	// Check for excessive dependencies
	findings.push(...checkDependencyCount(deps, devDeps));

	// Check for version conflicts
	findings.push(...checkVersionConflicts(deps, devDeps));

	// Check for known heavy dependencies with alternatives
	findings.push(...checkHeavyDependencies(context.allDependencies));

	return success(findings);
}

/**
 * Creates a DependencyGraphAnalyzer instance.
 *
 * @returns Analyzer instance for dependency graph analysis
 */
export function createDependencyGraphAnalyzer(): Analyzer {
	return {
		name: 'dependency-graph',
		analyze,
	};
}

/**
 * Default DependencyGraphAnalyzer instance.
 */
export const dependencyGraphAnalyzer = createDependencyGraphAnalyzer();
