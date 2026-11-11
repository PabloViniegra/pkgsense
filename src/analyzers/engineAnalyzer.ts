import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as semver from 'semver';
import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import type { Analyzer, AnalysisContext } from './types';

const execFileAsync = promisify(execFile);

export type EngineTool = 'node' | 'npm';

/**
 * Dependencies for the engine analyzer.
 */
export interface EngineAnalyzerDeps {
	/**
	 * Returns the version of the tool the project would actually run with.
	 * Injected to enable testing without spawning processes.
	 */
	readonly getToolVersion: (
		tool: EngineTool,
		cwd: string,
	) => Promise<Result<string, string>>;
}

/**
 * Asks the tool on PATH for its version. process.version is not usable here:
 * inside VS Code it is the editor's bundled runtime, not the project's Node.js.
 */
async function defaultGetToolVersion(
	tool: EngineTool,
	cwd: string,
): Promise<Result<string, string>> {
	try {
		const { stdout } = await execFileAsync(tool, ['--version'], {
			cwd,
			timeout: CONSTANTS.EXEC_TIMEOUT_MS,
			// npm is a .cmd shim on Windows and needs a shell to run
			shell: process.platform === 'win32',
		});

		return success(stdout);
	} catch (error) {
		return failure(
			`Could not run ${tool} --version: ${error instanceof Error ? error.message : 'unknown error'}`,
		);
	}
}

const DEFAULT_DEPS: EngineAnalyzerDeps = {
	getToolVersion: defaultGetToolVersion,
};

const ENGINE_TOOLS: readonly EngineTool[] = ['node', 'npm'];

const TOOL_LABELS: Record<EngineTool, string> = {
	node: 'Node.js',
	npm: 'npm',
};

/**
 * Compares the tool found on PATH with the range declared in "engines".
 * Stays silent when the range is not valid semver or the tool cannot be run:
 * neither case proves a mismatch.
 */
async function checkEngine(
	deps: EngineAnalyzerDeps,
	tool: EngineTool,
	context: AnalysisContext,
): Promise<Finding[]> {
	const requiredRange = context.packageJson.engines?.[tool];
	if (typeof requiredRange !== 'string') {
		return [];
	}
	if (!semver.validRange(requiredRange)) {
		return [];
	}

	const versionResult = await deps.getToolVersion(tool, context.workspacePath);
	if (!versionResult.success) {
		console.warn(versionResult.error);
		return [];
	}

	const current = semver.valid(semver.clean(versionResult.data));
	if (!current || semver.satisfies(current, requiredRange)) {
		return [];
	}

	return [
		{
			type: 'warning',
			message: `${TOOL_LABELS[tool]} version mismatch: engines.${tool} requires ${requiredRange}, but the ${tool} on PATH is v${current}.`,
			location: ['engines', tool],
			tags: [FINDING_TAGS.ENGINES, FINDING_TAGS.CONFIG],
			meta: {
				required: requiredRange,
				current,
				engine: tool,
			},
		},
	];
}

/**
 * Creates an EngineAnalyzer instance.
 *
 * Validates the Node.js and npm versions available to the project against
 * the "engines" field. Severity is warning, matching npm's own EBADENGINE.
 *
 * @returns Analyzer instance for engine validation
 */
export function createEngineAnalyzer(
	deps: EngineAnalyzerDeps = DEFAULT_DEPS,
): Analyzer {
	return {
		name: 'engine',

		async analyze(context: AnalysisContext) {
			const findings = await Promise.all(
				ENGINE_TOOLS.map((tool) => checkEngine(deps, tool, context)),
			);

			return success(findings.flat());
		},
	};
}
