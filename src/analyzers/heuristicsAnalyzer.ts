import { success } from '../shared/result';
import { FINDING_TAGS, type Finding, type PackageJson } from '../types';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Configuration for deprecated package detection.
 * Extracted to enable easy extension and configuration.
 */
interface DeprecatedPackageRule {
	readonly pkg: string;
	readonly suggestion: string;
}

const DEPRECATED_PACKAGES = [
	{
		pkg: 'moment',
		suggestion:
			'Consider using dayjs or luxon (moment is in maintenance mode).',
	},
	{
		pkg: 'request',
		suggestion: 'request is deprecated; use fetch or axios instead.',
	},
	{
		pkg: 'left-pad',
		suggestion: 'Unnecessary package.',
	},
] as const satisfies readonly DeprecatedPackageRule[];

/**
 * Union type of all deprecated package names.
 * Automatically derived from the DEPRECATED_PACKAGES array.
 */
type DeprecatedPackageName = (typeof DEPRECATED_PACKAGES)[number]['pkg'];

/**
 * Check for deprecated or problematic packages.
 * Pure function - no side effects.
 */
function checkDeprecatedPackages(
	allDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];

	for (const rule of DEPRECATED_PACKAGES) {
		if (allDeps[rule.pkg]) {
			findings.push({
				type: 'warning',
				message: `Deprecated dependency detected: ${rule.pkg}. ${rule.suggestion}`,
				dependency: rule.pkg,
				tags: [FINDING_TAGS.MAINTENANCE, FINDING_TAGS.REPLACEMENT],
			});
		}
	}

	return findings;
}

/**
 * Check for dependencies duplicated in both dependencies and devDependencies.
 * Pure function - no side effects.
 */
function checkDuplicateDependencies(json: PackageJson): Finding[] {
	const findings: Finding[] = [];

	if (json.dependencies && json.devDependencies) {
		for (const dep of Object.keys(json.dependencies)) {
			if (json.devDependencies[dep]) {
				findings.push({
					type: 'warning',
					message: `Duplicate dependency in dependencies and devDependencies: ${dep}.`,
					dependency: dep,
					tags: [FINDING_TAGS.DUPLICATION],
				});
			}
		}
	}

	return findings;
}

/**
 * Check for missing or placeholder test scripts.
 * Pure function - no side effects.
 */
function checkTestScript(json: PackageJson): Finding[] {
	// Using bracket notation due to TypeScript strict indexing with Record<string, string>
	const hasTestScript = json.scripts?.['test'];
	const hasValidTest = hasTestScript && !hasTestScript.includes('no test');

	if (!hasValidTest) {
		return [
			{
				type: 'info',
				message: 'No tests configured. Add a "test" script.',
				tags: [FINDING_TAGS.QUALITY],
			},
		];
	}

	return [];
}

/**
 * Check for missing "files" field which helps reduce published package size.
 * Pure function - no side effects.
 */
function checkFilesField(json: PackageJson): Finding[] {
	if (!json.files) {
		return [
			{
				type: 'info',
				message:
					'Missing "files" field. Adding it reduces the published package size.',
				tags: [FINDING_TAGS.PACKAGING],
			},
		];
	}

	return [];
}

/**
 * Check for missing "type" field for ESM/CJS module resolution.
 * Pure function - no side effects.
 */
function checkTypeField(json: PackageJson): Finding[] {
	if (!json.type) {
		return [
			{
				type: 'info',
				message: 'Missing "type" field. Consider using "type": "module".',
				tags: [FINDING_TAGS.CONFIG],
			},
		];
	}

	return [];
}

/**
 * Creates a heuristics analyzer that checks for common package.json issues.
 *
 * Factory pattern enables:
 * - Future configuration injection
 * - Easy testing with mock configurations
 * - Dependency inversion principle compliance
 */
export function createHeuristicsAnalyzer(): Analyzer {
	return {
		name: 'heuristics',

		async analyze(context: AnalysisContext) {
			const { packageJson, allDependencies } = context;

			const findings: Finding[] = [
				...checkDeprecatedPackages(allDependencies),
				...checkDuplicateDependencies(packageJson),
				...checkTestScript(packageJson),
				...checkFilesField(packageJson),
				...checkTypeField(packageJson),
			];

			return success(findings);
		},
	};
}

/**
 * @deprecated Use createHeuristicsAnalyzer() factory instead.
 * Kept for backward compatibility during migration.
 */
export async function heuristicsAnalyzer(
	json: PackageJson,
	allDeps: Readonly<Record<string, string>>,
): Promise<readonly Finding[]> {
	const analyzer = createHeuristicsAnalyzer();
	const context: AnalysisContext = {
		packageJson: json,
		allDependencies: allDeps,
		dependencyRanges: {},
		workspacePath: '',
	};

	const result = await analyzer.analyze(context);
	return result.success ? result.data : [];
}
