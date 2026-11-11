import * as path from 'node:path';
import { applyEdits, modify } from 'jsonc-parser';
import * as vscode from 'vscode';
import { type AuditTool, findAuditTarget } from '../analyzers/auditRunner';
import { fetchLatestVersion } from '../utils/npmRegistry';

/**
 * Command handlers for package.json modifications.
 *
 * These commands are triggered by code actions and provide
 * user-friendly ways to fix issues detected by analyzers.
 */

export type DependencySection = 'dependencies' | 'devDependencies';

const ALL_SECTIONS: readonly DependencySection[] = [
	'dependencies',
	'devDependencies',
];

const DEFAULT_INDENT = '  ';

const AUDIT_FIX_COMMANDS: Record<AuditTool, string> = {
	npm: 'npm audit fix',
	pnpm: 'pnpm audit --fix',
};

const UPDATE_MANUALLY = 'Update manually';
const VIEW_ON_NPM = 'View on npm';

/**
 * Sets the value at a JSON path, or removes the property when the value is
 * undefined. Only that property is rewritten, so the rest of the file keeps
 * its layout, key order and line endings.
 */
export function editPackageJson(
	text: string,
	jsonPath: readonly string[],
	value: unknown,
): string {
	const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? DEFAULT_INDENT;
	const usesTabs = indent.startsWith('\t');

	const edits = modify(text, [...jsonPath], value, {
		formattingOptions: {
			insertSpaces: !usesTabs,
			tabSize: usesTabs ? 1 : indent.length,
			eol: text.includes('\r\n') ? '\r\n' : '\n',
		},
	});

	return applyEdits(text, edits);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sections of the package that list the dependency. */
function sectionsListing(
	text: string,
	packageName: string,
	candidates: readonly DependencySection[],
): DependencySection[] {
	const packageJson: unknown = JSON.parse(text);
	if (!isRecord(packageJson)) {
		return [];
	}

	return candidates.filter((section) => {
		const deps = packageJson[section];
		return isRecord(deps) && packageName in deps;
	});
}

async function replaceDocumentText(
	document: vscode.TextDocument,
	newText: string,
): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		document.uri,
		new vscode.Range(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		),
		newText,
	);

	if (!(await vscode.workspace.applyEdit(edit))) {
		throw new Error('VS Code rejected the edit');
	}
	await document.save();
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Remove a dependency from package.json.
 * Removes it from both dependency sections unless one is given.
 */
export async function removeDependencyCommand(
	uri: vscode.Uri,
	packageName: string,
	section?: DependencySection,
): Promise<void> {
	const document = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(document);

	try {
		const text = document.getText();
		const sections = sectionsListing(
			text,
			packageName,
			section ? [section] : ALL_SECTIONS,
		);

		if (sections.length === 0) {
			vscode.window.showWarningMessage(
				`${packageName} not found in dependencies`,
			);
			return;
		}

		const newText = sections.reduce(
			(current, name) =>
				editPackageJson(current, [name, packageName], undefined),
			text,
		);
		await replaceDocumentText(document, newText);

		vscode.window.showInformationMessage(
			`Removed ${packageName} from package.json`,
		);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to remove dependency: ${errorMessage(error)}`,
		);
	}
}

async function updateToLatest(uri: vscode.Uri, packageName: string) {
	const document = await vscode.workspace.openTextDocument(uri);
	const text = document.getText();
	const sections = sectionsListing(text, packageName, ALL_SECTIONS);

	const latest = await fetchLatestVersion(packageName);
	if (!latest.success) {
		vscode.window.showWarningMessage(
			`Could not fetch latest version for ${packageName}: ${latest.error}`,
		);
		return;
	}

	if (sections.length === 0) {
		return;
	}

	const range = `^${latest.data}`;
	const newText = sections.reduce(
		(current, name) => editPackageJson(current, [name, packageName], range),
		text,
	);
	await replaceDocumentText(document, newText);

	vscode.window.showInformationMessage(`Updated ${packageName} to ${range}`);
}

/**
 * Update a dependency to a caret range on its latest version.
 */
export async function updateDependencyCommand(
	uri: vscode.Uri,
	packageName: string,
): Promise<void> {
	try {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Updating ${packageName}...`,
				cancellable: false,
			},
			() => updateToLatest(uri, packageName),
		);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to update dependency: ${errorMessage(error)}`,
		);
	}
}

const METADATA_DEFAULTS: Readonly<Record<string, unknown>> = {
	description: 'Description of your package',
	keywords: ['keyword1', 'keyword2'],
	author: 'Your Name <your.email@example.com>',
	license: 'MIT',
	repository: {
		type: 'git',
		url: 'https://github.com/username/repo.git',
	},
	bugs: {
		url: 'https://github.com/username/repo/issues',
	},
	homepage: 'https://github.com/username/repo#readme',
};

/**
 * Add a missing metadata field to package.json.
 */
export async function addMetadataFieldCommand(
	uri: vscode.Uri,
	fieldName: string,
): Promise<void> {
	try {
		const document = await vscode.workspace.openTextDocument(uri);
		const text = document.getText();
		JSON.parse(text);

		const value = METADATA_DEFAULTS[fieldName] ?? '';
		await replaceDocumentText(
			document,
			editPackageJson(text, [fieldName], value),
		);

		vscode.window.showInformationMessage(
			`Added '${fieldName}' field to package.json`,
		);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to add metadata field: ${errorMessage(error)}`,
		);
	}
}

/**
 * Fix a vulnerability reported by the audit.
 *
 * The audit fix runs with the package manager that owns the lockfile, in the
 * lockfile's directory. Updating the dependency is only offered for advisories
 * against the dependency itself: for a vulnerable package it pulls in,
 * bumping the direct dependency is not known to help.
 */
export async function fixVulnerabilityCommand(
	uri: vscode.Uri,
	packageName: string,
	direct = true,
): Promise<void> {
	const target = findAuditTarget(path.dirname(uri.fsPath));
	const fixCommand = target ? AUDIT_FIX_COMMANDS[target.tool] : undefined;
	const fixLabel = fixCommand ? `Run ${fixCommand}` : undefined;

	const options = [fixLabel, direct ? UPDATE_MANUALLY : undefined, VIEW_ON_NPM];
	const action = await vscode.window.showInformationMessage(
		`To fix the vulnerability in ${packageName}, you can:`,
		...options.filter((option): option is string => option !== undefined),
	);

	if (target && fixCommand && action === fixLabel) {
		const terminal = vscode.window.createTerminal({
			name: fixCommand,
			cwd: target.cwd,
		});
		terminal.show();
		terminal.sendText(fixCommand);
	} else if (action === UPDATE_MANUALLY) {
		await updateDependencyCommand(uri, packageName);
	} else if (action === VIEW_ON_NPM) {
		const url = `https://www.npmjs.com/package/${packageName}`;
		vscode.env.openExternal(vscode.Uri.parse(url));
	}
}
