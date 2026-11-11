import { success } from '../shared/result';
import { FINDING_TAGS, type Finding, type PackageJson } from '../types';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Packages that are not deprecated on npm but whose maintainers recommend
 * alternatives for new projects. Actual npm deprecations are reported by the
 * update analyzer straight from the registry notice.
 */
const MAINTENANCE_MODE_PACKAGES = [
	{
		pkg: 'moment',
		suggestion:
			'moment is in maintenance mode (no new features). Consider dayjs or luxon.',
		url: 'https://momentjs.com/docs/#/-project-status/',
	},
] as const;

/**
 * Check for packages in maintenance mode.
 * Pure function - no side effects.
 */
function checkMaintenanceModePackages(
	allDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];

	for (const rule of MAINTENANCE_MODE_PACKAGES) {
		if (allDeps[rule.pkg]) {
			findings.push({
				type: 'info',
				message: `Maintenance-mode dependency: ${rule.suggestion}`,
				dependency: rule.pkg,
				tags: [FINDING_TAGS.MAINTENANCE],
				meta: { url: rule.url },
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
					// The quick fix removes the devDependencies copy, so point there
					location: ['devDependencies', dep],
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
	// "files" only affects what gets published; private packages are never published
	if (!json.files && json['private'] !== true) {
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
				...checkMaintenanceModePackages(allDependencies),
				...checkDuplicateDependencies(packageJson),
				...checkTestScript(packageJson),
				...checkFilesField(packageJson),
				...checkTypeField(packageJson),
			];

			return success(findings);
		},
	};
}
