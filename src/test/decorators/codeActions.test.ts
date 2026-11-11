import * as assert from 'node:assert';
import { suite, suiteSetup, suiteTeardown, test } from 'mocha';
import * as vscode from 'vscode';
import { createHeuristicsAnalyzer } from '../../analyzers/heuristicsAnalyzer';
import { createMetadataAnalyzer } from '../../analyzers/metadataAnalyzer';
import type { Analyzer, AnalysisContext } from '../../analyzers/types';
import { createUpdateAnalyzer } from '../../analyzers/updateAnalyzer';
import { parseAuditOutput } from '../../analyzers/vulnerabilityAnalyzer';
import { createWeightAnalyzer } from '../../analyzers/weightAnalyzer';
import { PackageCodeActionProvider } from '../../decorators/codeActions';
import { DiagnosticsManager } from '../../decorators/diagnostics';
import { CONSTANTS } from '../../shared/constants';
import { success } from '../../shared/result';
import type { Finding, PackageJson } from '../../types';

/**
 * The provider decides from the diagnostic alone, so these tests feed it the
 * diagnostics the real analyzers produce: a quick fix that only matches a
 * made-up message is a quick fix users never see.
 */
suite('PackageCodeActionProvider Test Suite', () => {
	const provider = new PackageCodeActionProvider();
	const range = new vscode.Range(0, 0, 0, 1);
	let manager: DiagnosticsManager;
	let documentCount = 0;

	suiteSetup(() => {
		manager = new DiagnosticsManager('pkgsense-code-actions-test');
	});

	suiteTeardown(() => {
		manager.dispose();
	});

	const createDocument = (fileName: string): vscode.TextDocument => {
		const document: Pick<vscode.TextDocument, 'uri' | 'fileName'> = {
			uri: vscode.Uri.file(fileName),
			fileName,
		};
		// The provider only reads uri and fileName
		return document as vscode.TextDocument;
	};

	const createContext = (packageJson: PackageJson): AnalysisContext => ({
		packageJson,
		allDependencies: {
			...packageJson.dependencies,
			...packageJson.devDependencies,
		},
		workspacePath: '/test',
	});

	const findingsOf = async (
		analyzer: Analyzer,
		packageJson: PackageJson,
	): Promise<Finding[]> => {
		const result = await analyzer.analyze(createContext(packageJson));
		assert.ok(result.success, 'analysis should succeed');
		return result.data;
	};

	const updateAnalyzer = (
		latest: string,
		deprecation: { version: string; message: string } | null = null,
	): Analyzer =>
		createUpdateAnalyzer({
			fetchLatestVersion: async () => success(latest),
			fetchDeprecation: async () => success(deprecation),
		});

	/**
	 * Publishes findings as diagnostics and asks the provider for the
	 * actions of those matching `message`.
	 */
	const actionsFor = (
		findings: Finding[],
		message: RegExp,
	): { document: vscode.TextDocument; actions: vscode.CodeAction[] } => {
		documentCount += 1;
		const document = createDocument(
			`/pkgsense-code-actions/${documentCount}/package.json`,
		);
		manager.setFindings(document.uri, findings);

		const diagnostics = vscode.languages
			.getDiagnostics(document.uri)
			.filter((d) => message.test(d.message));
		assert.ok(diagnostics.length > 0, `no diagnostic matches ${message}`);

		const actions = provider.provideCodeActions(document, range, {
			diagnostics,
			only: undefined,
			triggerKind: vscode.CodeActionTriggerKind.Automatic,
		});

		return { document, actions: actions ?? [] };
	};

	const describe = (actions: vscode.CodeAction[]) =>
		actions.map((a) => ({
			title: a.title,
			command: a.command?.command,
			arguments: a.command?.arguments?.slice(1),
		}));

	suite('Scope', () => {
		const finding: Finding = {
			type: 'warning',
			message: 'Duplicate dependency in dependencies and devDependencies: a.',
			dependency: 'a',
		};

		const provide = (fileName: string, source: string) => {
			const diagnostic = new vscode.Diagnostic(range, finding.message);
			diagnostic.source = source;
			diagnostic.code = 'a';

			return provider.provideCodeActions(createDocument(fileName), range, {
				diagnostics: [diagnostic],
				only: undefined,
				triggerKind: vscode.CodeActionTriggerKind.Automatic,
			});
		};

		test('offers actions for pkgsense diagnostics in package.json', () => {
			const actions = provide('/app/package.json', CONSTANTS.DIAGNOSTIC_SOURCE);

			assert.strictEqual(actions?.length, 1);
		});

		test('offers nothing in other JSON files', () => {
			const actions = provide(
				'/app/tsconfig.json',
				CONSTANTS.DIAGNOSTIC_SOURCE,
			);

			assert.strictEqual(actions, undefined);
		});

		test('offers nothing for diagnostics of other extensions', () => {
			assert.strictEqual(provide('/app/package.json', 'eslint'), undefined);
		});

		test('offers nothing without diagnostics', () => {
			const actions = provider.provideCodeActions(
				createDocument('/app/package.json'),
				range,
				{
					diagnostics: [],
					only: undefined,
					triggerKind: vscode.CodeActionTriggerKind.Automatic,
				},
			);

			assert.strictEqual(actions, undefined);
		});
	});

	suite('Duplicate dependencies', () => {
		test('offers to remove the devDependencies copy only', async () => {
			const findings = await findingsOf(createHeuristicsAnalyzer(), {
				dependencies: { lodash: '^4.17.21' },
				devDependencies: { lodash: '^4.17.21' },
			});

			const { document, actions } = actionsFor(findings, /^Duplicate/);

			assert.deepStrictEqual(describe(actions), [
				{
					title: 'Remove duplicate from devDependencies',
					command: 'pkgsense.removeDependency',
					arguments: ['lodash', 'devDependencies'],
				},
			]);
			assert.strictEqual(
				String(actions[0].command?.arguments?.[0]),
				String(document.uri),
			);
		});
	});

	suite('Updates', () => {
		test('offers the update and does not offer to remove the dependency', async () => {
			const findings = await findingsOf(updateAnalyzer('18.3.1'), {
				dependencies: { react: '^17.0.2' },
			});

			const { actions } = actionsFor(findings, /update available/);

			assert.deepStrictEqual(describe(actions), [
				{
					title: 'Update to latest version',
					command: 'pkgsense.updateDependency',
					arguments: ['react'],
				},
			]);
			assert.strictEqual(actions[0].isPreferred, true);
		});
	});

	suite('Deprecated packages', () => {
		test('links to the deprecation notice instead of removing the package', async () => {
			const analyzer = updateAnalyzer('2.88.2', {
				version: '2.88.2',
				message: 'request has been deprecated',
			});
			const findings = await findingsOf(analyzer, {
				dependencies: { request: '^2.88.0' },
			});

			const { actions } = actionsFor(findings, /^Deprecated on npm/);

			assert.deepStrictEqual(
				actions.map((a) => ({
					title: a.title,
					command: a.command?.command,
					target: String(a.command?.arguments?.[0]),
				})),
				[
					{
						title: 'View deprecation notice on npm',
						command: 'vscode.open',
						target: 'https://www.npmjs.com/package/request/v/2.88.2',
					},
				],
			);
		});

		test('does not offer to remove a package that is only in maintenance mode', async () => {
			const findings = await findingsOf(createHeuristicsAnalyzer(), {
				dependencies: { moment: '^2.30.1' },
			});

			const { actions } = actionsFor(findings, /^Maintenance-mode/);

			assert.deepStrictEqual(actions, []);
		});
	});

	suite('Missing fields', () => {
		test('offers to add each recommended metadata field that is missing', async () => {
			const findings = await findingsOf(createMetadataAnalyzer(), {
				name: 'app',
				version: '1.0.0',
			});

			const { actions } = actionsFor(findings, /^Missing "/);

			assert.deepStrictEqual(
				describe(actions)
					.map((a) => a.arguments?.[0])
					.sort(),
				[...CONSTANTS.RECOMMENDED_METADATA_FIELDS].sort(),
			);
			for (const action of actions) {
				const field = action.command?.arguments?.[1];
				assert.strictEqual(action.title, `Add missing "${field}" field`);
				assert.strictEqual(
					action.command?.command,
					'pkgsense.addMetadataField',
				);
			}
		});

		test('does not offer to add fields that have no sensible default', async () => {
			const findings = await findingsOf(createHeuristicsAnalyzer(), {
				name: 'app',
			});

			const { actions } = actionsFor(
				findings,
				/^(Missing "(files|type)"|No tests configured)/,
			);

			assert.deepStrictEqual(actions, []);
		});
	});

	suite('Vulnerabilities', () => {
		const parseReport = (stdout: string, deps: string[]): Finding[] => {
			const result = parseAuditOutput(stdout, deps, 'npm');
			assert.ok(result.success, 'the report should parse');
			return result.data;
		};

		const report = (severity: string) =>
			JSON.stringify({
				vulnerabilities: {
					lodash: {
						name: 'lodash',
						severity,
						via: [
							{
								source: 1,
								title: 'Prototype Pollution in lodash',
								url: 'https://github.com/advisories/GHSA-p6mc-m468-83gw',
								severity,
							},
						],
					},
					express: { name: 'express', severity, via: ['qs'] },
					qs: { name: 'qs', severity, via: [{ source: 2, severity }] },
				},
			});

		for (const severity of ['high', 'moderate']) {
			test(`offers a fix for a ${severity} advisory`, () => {
				const findings = parseReport(report(severity), ['lodash']);

				const { actions } = actionsFor(findings, /^Vulnerability in lodash/);

				assert.deepStrictEqual(describe(actions), [
					{
						title: 'Fix vulnerability',
						command: 'pkgsense.fixVulnerability',
						arguments: ['lodash', true],
					},
				]);
			});
		}

		test('targets the direct dependency for a transitive vulnerability and marks it as indirect', () => {
			const findings = parseReport(report('high'), ['express']);

			const { actions } = actionsFor(
				findings,
				/^Vulnerability in dependencies/,
			);

			assert.deepStrictEqual(
				describe(actions).map((a) => a.arguments),
				[['express', false]],
			);
		});
	});

	suite('Findings without a quick fix', () => {
		test('offers nothing for a heavy package', async () => {
			const analyzer = createWeightAnalyzer({
				fetchPackageSize: async () =>
					success({ size: 3 * 1024 * 1024, gzip: 1024, version: '1.0.0' }),
			});
			const findings = await findingsOf(analyzer, {
				dependencies: { heavy: '^1.0.0' },
			});

			const { actions } = actionsFor(findings, /^Very heavy package/);

			assert.deepStrictEqual(actions, []);
		});
	});
});
