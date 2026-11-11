import * as assert from 'node:assert';
import * as path from 'node:path';
import { suite, test } from 'mocha';
import {
	type ExecFile,
	createAuditRunner,
	findAuditTarget,
} from '../../analyzers/auditRunner';
import { failure, success } from '../../shared/result';

const REPORT = JSON.stringify({
	auditReportVersion: 2,
	vulnerabilities: { lodash: { severity: 'high', via: [] } },
});

suite('AuditRunner Test Suite', () => {
	suite('findAuditTarget', () => {
		const root = path.resolve('/repo');
		const pkgDir = path.join(root, 'packages', 'app');
		const having =
			(...files: string[]) =>
			(file: string) =>
				files.includes(file);

		test('uses npm for a package-lock.json next to package.json', () => {
			const target = findAuditTarget(
				pkgDir,
				having(path.join(pkgDir, 'package-lock.json')),
			);

			assert.deepStrictEqual(target, { tool: 'npm', cwd: pkgDir });
		});

		test('uses npm for an npm-shrinkwrap.json', () => {
			const target = findAuditTarget(
				pkgDir,
				having(path.join(pkgDir, 'npm-shrinkwrap.json')),
			);

			assert.deepStrictEqual(target, { tool: 'npm', cwd: pkgDir });
		});

		test('uses pnpm from the monorepo root that owns the lockfile', () => {
			const target = findAuditTarget(
				pkgDir,
				having(path.join(root, 'pnpm-lock.yaml')),
			);

			assert.deepStrictEqual(target, { tool: 'pnpm', cwd: root });
		});

		test('prefers the nearest lockfile', () => {
			const target = findAuditTarget(
				pkgDir,
				having(
					path.join(root, 'pnpm-lock.yaml'),
					path.join(pkgDir, 'package-lock.json'),
				),
			);

			assert.deepStrictEqual(target, { tool: 'npm', cwd: pkgDir });
		});

		test('finds nothing without a lockfile, including a yarn-only project', () => {
			const target = findAuditTarget(
				pkgDir,
				having(path.join(pkgDir, 'yarn.lock')),
			);

			assert.strictEqual(target, null);
		});
	});

	suite('createAuditRunner', () => {
		const root = path.resolve('/repo');
		const pkgDir = path.join(root, 'packages', 'app');

		const runnerWith = (lockfile: string | null, execFile: ExecFile) =>
			createAuditRunner({
				execFile,
				fileExists: (file) => file === lockfile,
			});

		test('runs the audit of the lockfile owner in the lockfile directory', async () => {
			const calls: Array<[string, readonly string[], string]> = [];
			const runAudit = runnerWith(
				path.join(root, 'pnpm-lock.yaml'),
				async (file, args, { cwd }) => {
					calls.push([file, args, cwd]);
					return { stdout: '{"advisories":{}}', stderr: '' };
				},
			);

			const result = await runAudit(pkgDir);

			assert.deepStrictEqual(calls, [['pnpm', ['audit', '--json'], root]]);
			assert.deepStrictEqual(
				result,
				success({ stdout: '{"advisories":{}}', stderr: '', tool: 'pnpm' }),
			);
		});

		test('keeps the report printed by an audit that exits non-zero because it found vulnerabilities', async () => {
			const runAudit = runnerWith(
				path.join(pkgDir, 'package-lock.json'),
				async () => {
					throw Object.assign(new Error('Command failed: npm audit --json'), {
						stdout: REPORT,
						stderr: '',
					});
				},
			);

			const result = await runAudit(pkgDir);

			assert.ok(result.success);
			assert.strictEqual(result.data.stdout, REPORT);
			assert.strictEqual(result.data.tool, 'npm');
		});

		test('fails when the audit cannot run at all', async () => {
			const runAudit = runnerWith(
				path.join(pkgDir, 'package-lock.json'),
				async () => {
					throw new Error('spawn npm ENOENT');
				},
			);

			assert.deepStrictEqual(
				await runAudit(pkgDir),
				failure('could not run npm audit: spawn npm ENOENT'),
			);
		});

		test('fails without running anything when there is no lockfile', async () => {
			const runAudit = runnerWith(null, async () =>
				assert.fail('the audit should not run'),
			);

			const result = await runAudit(pkgDir);

			assert.ok(!result.success);
			assert.match(result.error, /^no package-lock\.json/);
		});
	});
});
