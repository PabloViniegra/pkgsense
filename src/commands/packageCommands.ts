import * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';

/**
 * Command handlers for package.json modifications.
 *
 * These commands are triggered by code actions and provide
 * user-friendly ways to fix issues detected by analyzers.
 */

/**
 * Remove a dependency from package.json.
 * Opens the document and removes the specified dependency line.
 */
export async function removeDependencyCommand(
	uri: vscode.Uri,
	packageName: string,
): Promise<void> {
	const document = await vscode.workspace.openTextDocument(uri);
	const editor = await vscode.window.showTextDocument(document);

	const edit = new vscode.WorkspaceEdit();
	const text = document.getText();

	try {
		const packageJson = JSON.parse(text);

		// Remove from dependencies or devDependencies
		let modified = false;
		if (packageJson.dependencies?.[packageName]) {
			delete packageJson.dependencies[packageName];
			modified = true;
		}
		if (packageJson.devDependencies?.[packageName]) {
			delete packageJson.devDependencies[packageName];
			modified = true;
		}

		if (modified) {
			const newText = JSON.stringify(packageJson, null, 2);
			edit.replace(
				uri,
				new vscode.Range(
					document.positionAt(0),
					document.positionAt(text.length),
				),
				newText,
			);

			await vscode.workspace.applyEdit(edit);
			await document.save();

			vscode.window.showInformationMessage(
				`Removed ${packageName} from package.json`,
			);
		} else {
			vscode.window.showWarningMessage(
				`${packageName} not found in dependencies`,
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		vscode.window.showErrorMessage(`Failed to remove dependency: ${message}`);
	}
}

/**
 * Update a dependency to its latest version.
 * Uses npm view to get the latest version.
 */
export async function updateDependencyCommand(
	uri: vscode.Uri,
	packageName: string,
): Promise<void> {
	try {
		// Show progress while fetching latest version
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Updating ${packageName}...`,
				cancellable: false,
			},
			async () => {
				const document = await vscode.workspace.openTextDocument(uri);
				const text = document.getText();
				const packageJson = JSON.parse(text);

				// Fetch latest version from npm
				const latestVersion = await fetchLatestVersion(packageName);

				if (!latestVersion) {
					vscode.window.showWarningMessage(
						`Could not fetch latest version for ${packageName}`,
					);
					return;
				}

				const edit = new vscode.WorkspaceEdit();
				let modified = false;

				// Update in dependencies or devDependencies
				if (packageJson.dependencies?.[packageName]) {
					packageJson.dependencies[packageName] = `^${latestVersion}`;
					modified = true;
				}
				if (packageJson.devDependencies?.[packageName]) {
					packageJson.devDependencies[packageName] = `^${latestVersion}`;
					modified = true;
				}

				if (modified) {
					const newText = JSON.stringify(packageJson, null, 2);
					edit.replace(
						uri,
						new vscode.Range(
							document.positionAt(0),
							document.positionAt(text.length),
						),
						newText,
					);

					await vscode.workspace.applyEdit(edit);
					await document.save();

					vscode.window.showInformationMessage(
						`Updated ${packageName} to ^${latestVersion}`,
					);
				}
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		vscode.window.showErrorMessage(`Failed to update dependency: ${message}`);
	}
}

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
		const packageJson = JSON.parse(text);

		const edit = new vscode.WorkspaceEdit();

		// Provide sensible defaults for common fields
		const defaultValues: Record<string, unknown> = {
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

		packageJson[fieldName] = defaultValues[fieldName] || '';

		const newText = JSON.stringify(packageJson, null, 2);
		edit.replace(
			uri,
			new vscode.Range(
				document.positionAt(0),
				document.positionAt(text.length),
			),
			newText,
		);

		await vscode.workspace.applyEdit(edit);
		await document.save();

		vscode.window.showInformationMessage(
			`Added '${fieldName}' field to package.json`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		vscode.window.showErrorMessage(`Failed to add metadata field: ${message}`);
	}
}

/**
 * Fix a vulnerability by updating to a patched version.
 */
export async function fixVulnerabilityCommand(
	uri: vscode.Uri,
	packageName: string,
): Promise<void> {
	const action = await vscode.window.showInformationMessage(
		`To fix the vulnerability in ${packageName}, you can:`,
		'Run npm audit fix',
		'Update manually',
		'View on npm',
	);

	if (action === 'Run npm audit fix') {
		const terminal = vscode.window.createTerminal('npm audit fix');
		terminal.show();
		terminal.sendText('npm audit fix');
	} else if (action === 'Update manually') {
		await updateDependencyCommand(uri, packageName);
	} else if (action === 'View on npm') {
		const url = `https://www.npmjs.com/package/${packageName}`;
		vscode.env.openExternal(vscode.Uri.parse(url));
	}
}

/**
 * Fetch the latest version of a package from npm registry.
 */
async function fetchLatestVersion(packageName: string): Promise<string | null> {
	try {
		const url = `${CONSTANTS.NPM_REGISTRY_URL}/${packageName}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			CONSTANTS.NPM_REGISTRY_TIMEOUT_MS,
		);

		const response = await fetch(url, {
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as Record<string, unknown>;
		const distTags = data['dist-tags'] as Record<string, unknown> | undefined;
		return (distTags?.latest as string) || null;
	} catch (error) {
		console.error(`Failed to fetch latest version for ${packageName}:`, error);
		return null;
	}
}
