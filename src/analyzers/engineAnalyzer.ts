import { CONSTANTS } from '../shared/constants';
import { type InfallibleResult, infallible } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import { satisfiesRange } from '../utils/semverHelper';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Engine Analyzer - Validates Node.js and npm version requirements,
 * and checks peer dependency satisfaction.
 *
 * Checks for:
 * - Node.js version compatibility with engines.node
 * - npm version compatibility with engines.npm
 * - Peer dependency requirements from package.json
 *
 * @example
 * ```typescript
 * const analyzer = createEngineAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} engine/peer dependency issues`);
 * }
 * ```
 */

/**
 * Gets the current Node.js version.
 * Removes the 'v' prefix from process.version.
 */
function getCurrentNodeVersion(): string {
	return process.version.replace(/^v/, '');
}

/**
 * Checks if the current Node.js version satisfies the required range.
 */
function checkNodeVersion(requiredRange: string): Finding[] {
	const findings: Finding[] = [];
	const currentVersion = getCurrentNodeVersion();

	if (!satisfiesRange(currentVersion, requiredRange)) {
		findings.push({
			type: 'error',
			message: `Node.js version mismatch: required ${requiredRange}, found v${currentVersion}. This package may not work correctly.`,
			tags: [FINDING_TAGS.ENGINES, FINDING_TAGS.CONFIG],
			meta: {
				required: requiredRange,
				current: currentVersion,
				engine: 'node',
			},
		});
	}

	return findings;
}

/**
 * Checks npm version compatibility.
 * Note: We don't execute npm --version here to avoid subprocess overhead.
 * This is a simplified check that assumes npm is installed.
 */
function checkNpmVersion(requiredRange: string): Finding[] {
	const findings: Finding[] = [];

	// Info level warning since we can't easily check npm version without subprocess
	findings.push({
		type: 'info',
		message: `npm version ${requiredRange} is required. Please verify your npm version manually with 'npm --version'.`,
		tags: [FINDING_TAGS.ENGINES, FINDING_TAGS.CONFIG],
		meta: {
			required: requiredRange,
			engine: 'npm',
		},
	});

	return findings;
}

/**
 * Checks if peer dependencies are specified.
 * Note: Full peer dependency validation would require reading node_modules,
 * which is expensive. This provides basic awareness.
 */
function checkPeerDependencies(
	peerDeps: Readonly<Record<string, string>>,
): Finding[] {
	const findings: Finding[] = [];

	if (Object.keys(peerDeps).length === 0) {
		return findings;
	}

	// Inform about peer dependencies
	const peerDepNames = Object.keys(peerDeps);

	findings.push({
		type: 'info',
		message: `This package has ${peerDepNames.length} peer ${peerDepNames.length === 1 ? 'dependency' : 'dependencies'}: ${peerDepNames.join(', ')}. Ensure ${peerDepNames.length === 1 ? 'it is' : 'they are'} installed.`,
		tags: [FINDING_TAGS.ENGINES, FINDING_TAGS.DEPENDENCIES],
		meta: {
			peerDependencies: peerDeps,
		},
	});

	return findings;
}

/**
 * Validates engines and peer dependencies.
 * This analyzer never fails - it always returns findings (even if empty).
 */
async function analyze(
	context: AnalysisContext,
): Promise<InfallibleResult<Finding[]>> {
	const findings: Finding[] = [];
	const pkg = context.packageJson;

	// Check Node.js version if engines.node is specified
	if (pkg.engines?.node) {
		findings.push(...checkNodeVersion(pkg.engines.node));
	}

	// Check npm version if engines.npm is specified
	if (pkg.engines?.npm) {
		findings.push(...checkNpmVersion(pkg.engines.npm));
	}

	// Check peer dependencies if specified
	if (pkg.peerDependencies) {
		findings.push(...checkPeerDependencies(pkg.peerDependencies));
	}

	return infallible(findings);
}

/**
 * Creates an EngineAnalyzer instance.
 *
 * @returns Analyzer instance for engine and peer dependency validation
 */
export function createEngineAnalyzer(): Analyzer {
	return {
		name: 'engine',
		analyze,
	};
}

/**
 * Default EngineAnalyzer instance.
 */
export const engineAnalyzer = createEngineAnalyzer();
