import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { CONSTANTS } from '../shared/constants';
import { type Result, failure, success } from '../shared/result';

const execFileAsync = promisify(execFile);

export type AuditTool = 'npm' | 'pnpm';

const LOCKFILES: readonly (readonly [string, AuditTool])[] = [
	['package-lock.json', 'npm'],
	['npm-shrinkwrap.json', 'npm'],
	['pnpm-lock.yaml', 'pnpm'],
];

/**
 * Audit command execution result.
 */
export interface AuditResult {
	readonly stdout: string;
	readonly stderr: string;
	/** Tool that produced the report; used to tell the user what to run */
	readonly tool: AuditTool;
}

export type AuditRunner = (cwd: string) => Promise<Result<AuditResult, string>>;

export interface AuditTarget {
	readonly tool: AuditTool;
	readonly cwd: string;
}

/**
 * Finds the nearest lockfile at or above a directory and the tool that owns it.
 * Audits are only meaningful against a lockfile: without one there are no
 * resolved versions to check.
 */
export function findAuditTarget(
	startDir: string,
	fileExists: (filePath: string) => boolean = existsSync,
): AuditTarget | null {
	let dir = startDir;

	for (;;) {
		for (const [lockfile, tool] of LOCKFILES) {
			if (fileExists(path.join(dir, lockfile))) {
				return { tool, cwd: dir };
			}
		}

		const parent = path.dirname(dir);
		if (parent === dir) {
			return null;
		}
		dir = parent;
	}
}

function hasStdout(
	error: unknown,
): error is { stdout: string; stderr?: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'stdout' in error &&
		typeof error.stdout === 'string' &&
		error.stdout.length > 0
	);
}

export type ExecFile = (
	file: string,
	args: readonly string[],
	options: { readonly cwd: string },
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

export interface AuditRunnerDeps {
	readonly execFile: ExecFile;
	readonly fileExists: (filePath: string) => boolean;
}

const runProcess: ExecFile = (file, args, { cwd }) =>
	execFileAsync(file, [...args], {
		cwd,
		maxBuffer: CONSTANTS.EXEC_MAX_BUFFER,
		timeout: CONSTANTS.EXEC_TIMEOUT_MS,
		// npm and pnpm are .cmd shims on Windows and need a shell to run
		shell: process.platform === 'win32',
	});

/**
 * Creates the audit executor: it runs the audit of whichever package manager
 * owns the nearest lockfile, in the lockfile's directory.
 */
export function createAuditRunner(
	deps: AuditRunnerDeps = { execFile: runProcess, fileExists: existsSync },
): AuditRunner {
	return (cwd) => runAudit(deps, cwd);
}

async function runAudit(
	deps: AuditRunnerDeps,
	cwd: string,
): Promise<Result<AuditResult, string>> {
	const target = findAuditTarget(cwd, deps.fileExists);
	if (!target) {
		return failure(
			'no package-lock.json, npm-shrinkwrap.json or pnpm-lock.yaml found at or above this package',
		);
	}

	try {
		const { stdout, stderr } = await deps.execFile(
			target.tool,
			['audit', '--json'],
			{ cwd: target.cwd },
		);

		return success({ stdout, stderr, tool: target.tool });
	} catch (error) {
		// Audit tools exit non-zero when vulnerabilities are found
		// but still provide valid JSON output
		if (hasStdout(error)) {
			return success({
				stdout: error.stdout,
				stderr: error.stderr ?? '',
				tool: target.tool,
			});
		}

		const message = error instanceof Error ? error.message : 'unknown error';
		return failure(`could not run ${target.tool} audit: ${message}`);
	}
}
