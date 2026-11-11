import { CONSTANTS } from '../shared/constants';
import { type Result, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Script Analyzer - Detects potentially dangerous or inefficient scripts.
 *
 * Analyzes npm scripts for:
 * - Dangerous commands (rm -rf, sudo, eval)
 * - Security risks (output suppression, shell injection vectors)
 * - Best practice violations
 *
 * @example
 * ```typescript
 * const analyzer = createScriptAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} script issues`);
 * }
 * ```
 */

/**
 * Pattern for dangerous commands with severity and message.
 */
interface DangerPattern {
	readonly pattern: RegExp;
	readonly message: string;
	readonly severity: 'error' | 'warning' | 'info';
}

/**
 * Dangerous patterns to check for in scripts.
 */
const DANGER_PATTERNS: readonly DangerPattern[] = [
	{
		pattern: /\brm\s+-rf\b/,
		message:
			'"rm -rf" is not available in Windows cmd or PowerShell. Consider a cross-platform alternative such as rimraf.',
		severity: 'info',
	},
	{
		pattern: /\bsudo\s+/,
		message:
			'Requires elevated privileges (sudo). Package scripts should not require root access.',
		severity: 'warning',
	},
	{
		pattern: /\beval\s*\(/,
		message:
			'eval() detected. This is a potential security risk if used with user input.',
		severity: 'info',
	},
	{
		pattern: />\s*\/dev\/null\s+2>&1/,
		message:
			'Output suppression detected (> /dev/null). This may hide important errors.',
		severity: 'info',
	},
	{
		pattern: /\bcurl\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/,
		message: 'Piping curl to a shell runs downloaded code without inspection.',
		severity: 'warning',
	},
	{
		pattern: /\bwget\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/,
		message: 'Piping wget to a shell runs downloaded code without inspection.',
		severity: 'warning',
	},
];

/**
 * Best practice patterns to check for inefficiencies.
 */
const INEFFICIENCY_PATTERNS: readonly DangerPattern[] = [
	{
		pattern: /npm\s+install(?!\s+--)/,
		message:
			'Running "npm install" in scripts. Consider using prepare/postinstall hooks or pnpm/yarn for better performance.',
		severity: 'info',
	},
	{
		pattern: /&&\s+npm\s+run\s+\w+\s+&&\s+npm\s+run/,
		message:
			'Sequential script execution detected. Consider using npm-run-all for parallel execution.',
		severity: 'info',
	},
];

/**
 * Checks scripts for dangerous patterns.
 */
function checkDangerousPatterns(
	scriptName: string,
	scriptContent: string,
): Finding[] {
	const findings: Finding[] = [];

	for (const { pattern, message, severity } of DANGER_PATTERNS) {
		if (pattern.test(scriptContent)) {
			findings.push({
				type: severity,
				message: `Script "${scriptName}": ${message}`,
				tags: [FINDING_TAGS.SCRIPTS, FINDING_TAGS.SECURITY],
				meta: {
					script: scriptName,
					content: scriptContent,
				},
			});
		}
	}

	return findings;
}

/**
 * Checks scripts for inefficiency patterns.
 */
function checkInefficiencyPatterns(
	scriptName: string,
	scriptContent: string,
): Finding[] {
	const findings: Finding[] = [];

	for (const { pattern, message, severity } of INEFFICIENCY_PATTERNS) {
		if (pattern.test(scriptContent)) {
			findings.push({
				type: severity,
				message: `Script "${scriptName}": ${message}`,
				tags: [FINDING_TAGS.SCRIPTS, FINDING_TAGS.PERFORMANCE],
				meta: {
					script: scriptName,
					content: scriptContent,
				},
			});
		}
	}

	return findings;
}

/**
 * Checks for placeholder or missing test scripts.
 */
function checkTestScript(scripts: Record<string, string>): Finding[] {
	const findings: Finding[] = [];

	// Using bracket notation due to TypeScript strict indexing with Record<string, string>
	if (!scripts['test']) {
		findings.push({
			type: 'info',
			message:
				'No "test" script found. Add a test script to improve code quality.',
			tags: [FINDING_TAGS.SCRIPTS, FINDING_TAGS.QUALITY],
		});
		return findings;
	}

	// Check for placeholder test scripts
	const testScript = scripts['test'].toLowerCase();
	// The script "npm init" generates; a bare "exit 1" is not enough to tell,
	// since real scripts use it too ("mocha || exit 1")
	const placeholders = ['no test specified'];

	for (const placeholder of placeholders) {
		if (testScript.includes(placeholder)) {
			findings.push({
				type: 'info',
				message:
					'Test script is a placeholder. Configure actual tests for better quality.',
				tags: [FINDING_TAGS.SCRIPTS, FINDING_TAGS.QUALITY],
			});
			break;
		}
	}

	return findings;
}

/**
 * Analyzes package.json scripts for issues.
 */
async function analyze(
	context: AnalysisContext,
): Promise<Result<Finding[], never>> {
	const findings: Finding[] = [];
	const scripts = context.packageJson.scripts;

	// No scripts to analyze
	if (!scripts || Object.keys(scripts).length === 0) {
		return success(findings);
	}

	// Check test script
	findings.push(...checkTestScript(scripts));

	// Check each script for dangerous patterns and inefficiencies
	for (const [scriptName, scriptContent] of Object.entries(scripts)) {
		findings.push(...checkDangerousPatterns(scriptName, scriptContent));
		findings.push(...checkInefficiencyPatterns(scriptName, scriptContent));
	}

	return success(findings);
}

/**
 * Creates a ScriptAnalyzer instance.
 *
 * @returns Analyzer instance for script analysis
 */
export function createScriptAnalyzer(): Analyzer {
	return {
		name: 'script',
		analyze,
	};
}
