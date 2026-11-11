import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import {
	type EngineTool,
	createEngineAnalyzer,
} from '../../analyzers/engineAnalyzer';
import type { AnalysisContext } from '../../analyzers/types';
import { failure, success } from '../../shared/result';
import { FINDING_TAGS, type Finding, type PackageJson } from '../../types';

suite('EngineAnalyzer Test Suite', () => {
	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {},
		workspacePath: '/projects/app',
	});

	/**
	 * Runs the analyzer with fake tool versions. Tools missing from
	 * `versions` cannot be run, like a machine without them on PATH.
	 */
	const analyze = async (
		packageJson: PackageJson,
		versions: Partial<Record<EngineTool, string>>,
		calls: [tool: EngineTool, cwd: string][] = [],
	): Promise<Finding[]> => {
		const analyzer = createEngineAnalyzer({
			getToolVersion: async (tool, cwd) => {
				calls.push([tool, cwd]);
				const version = versions[tool];
				return version ? success(version) : failure(`${tool} not found`);
			},
		});

		const result = await analyzer.analyze(createContext(packageJson));

		assert.ok(result.success, 'analysis should succeed');
		return result.data;
	};

	suite('Node.js version', () => {
		test('reports a mismatch against the node found on PATH as a warning', async () => {
			const findings = await analyze(
				{ engines: { node: '>=22.0.0' } },
				{ node: 'v20.11.1\n' },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'Node.js version mismatch: engines.node requires >=22.0.0, but the node on PATH is v20.11.1.',
			);
			assert.deepStrictEqual(findings[0].meta, {
				required: '>=22.0.0',
				current: '20.11.1',
				engine: 'node',
			});
			assert.deepStrictEqual(findings[0].location, ['engines', 'node']);
			assert.ok(findings[0].tags?.includes(FINDING_TAGS.ENGINES));
		});

		test('reports nothing when the node on PATH satisfies the range', async () => {
			const findings = await analyze(
				{ engines: { node: '^20.9.0 || >=22' } },
				{ node: 'v20.11.1' },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('judges the project node, not the runtime executing the extension', async () => {
			const hostMajor = Number(process.versions.node.split('.')[0]);
			const projectNode = `${hostMajor + 2}.0.0`;

			const satisfiedByProject = await analyze(
				{ engines: { node: `>=${hostMajor + 1}` } },
				{ node: `v${projectNode}` },
			);
			const satisfiedOnlyByHost = await analyze(
				{ engines: { node: `<=${hostMajor}.x` } },
				{ node: `v${projectNode}` },
			);

			assert.deepStrictEqual(satisfiedByProject, []);
			assert.strictEqual(satisfiedOnlyByHost.length, 1);
			assert.ok(satisfiedOnlyByHost[0].message.includes(`v${projectNode}`));
		});

		test('asks for the version in the package directory', async () => {
			const calls: [EngineTool, string][] = [];

			await analyze({ engines: { node: '>=18' } }, { node: 'v20.0.0' }, calls);

			assert.deepStrictEqual(calls, [['node', '/projects/app']]);
		});
	});

	suite('npm version', () => {
		test('reports a mismatch against the npm found on PATH', async () => {
			const findings = await analyze(
				{ engines: { npm: '>=10' } },
				{ npm: '9.8.1\n' },
			);

			assert.strictEqual(findings.length, 1);
			assert.strictEqual(findings[0].type, 'warning');
			assert.strictEqual(
				findings[0].message,
				'npm version mismatch: engines.npm requires >=10, but the npm on PATH is v9.8.1.',
			);
		});

		test('reports nothing when npm satisfies the range', async () => {
			const findings = await analyze(
				{ engines: { npm: '>=10' } },
				{ npm: '11.2.0' },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('reports each mismatching engine separately', async () => {
			const findings = await analyze(
				{ engines: { node: '>=22', npm: '>=10' } },
				{ node: 'v18.20.0', npm: '9.8.1' },
			);

			assert.deepStrictEqual(
				findings.map((f) => f.meta?.['engine']),
				['node', 'npm'],
			);
		});
	});

	suite('Cases where no mismatch can be proven', () => {
		test('reports nothing when the tool cannot be run', async () => {
			const findings = await analyze(
				{ engines: { node: '>=99', npm: '>=99' } },
				{},
			);

			assert.deepStrictEqual(findings, []);
		});

		test('reports nothing when the tool prints something that is not a version', async () => {
			const findings = await analyze(
				{ engines: { node: '>=99' } },
				{ node: 'command not found' },
			);

			assert.deepStrictEqual(findings, []);
		});

		test('ignores an engines range that is not valid semver without running the tool', async () => {
			const calls: [EngineTool, string][] = [];

			const findings = await analyze(
				{ engines: { node: 'lts/iron' } },
				{ node: 'v20.0.0' },
				calls,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(calls, []);
		});

		test('reports nothing and runs nothing without an engines field', async () => {
			const calls: [EngineTool, string][] = [];

			const findings = await analyze(
				{ name: 'app' },
				{ node: 'v1.0.0' },
				calls,
			);

			assert.deepStrictEqual(findings, []);
			assert.deepStrictEqual(calls, []);
		});

		test('does not report peerDependencies, which are requirements for consumers', async () => {
			const findings = await analyze(
				{ peerDependencies: { react: '^18.0.0' } },
				{ node: 'v20.0.0' },
			);

			assert.deepStrictEqual(findings, []);
		});
	});
});
