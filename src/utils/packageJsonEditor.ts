import * as vscode from 'vscode';
import type { PackageJson } from '../types';

/**
 * Result of a package.json edit operation.
 */
export interface EditResult {
	readonly success: boolean;
	readonly message: string;
}

/**
 * Utility class for editing package.json files.
 *
 * Centralizes common edit operations to reduce duplication
 * and ensure consistent behavior across commands.
 *
 * @example
 * ```typescript
 * const editor = new PackageJsonEditor(document.uri);
 * const result = await editor.removeDependency('lodash');
 * if (result.success) {
 *   vscode.window.showInformationMessage(result.message);
 * }
 * ```
 */
export class PackageJsonEditor {
	constructor(private readonly uri: vscode.Uri) {}

	/**
	 * Reads and parses the package.json content.
	 * @returns The parsed package.json or null if parsing fails
	 */
	async read(): Promise<PackageJson | null> {
		try {
			const document = await vscode.workspace.openTextDocument(this.uri);
			return JSON.parse(document.getText()) as PackageJson;
		} catch (error) {
			console.error('Failed to read package.json:', error);
			return null;
		}
	}

	/**
	 * Writes the package.json content back to the file.
	 * @param packageJson - The modified package.json object
	 * @returns Result indicating success or failure
	 */
	async write(packageJson: PackageJson): Promise<EditResult> {
		try {
			const document = await vscode.workspace.openTextDocument(this.uri);
			const edit = new vscode.WorkspaceEdit();
			const text = document.getText();
			const newText = JSON.stringify(packageJson, null, 2);

			edit.replace(
				this.uri,
				new vscode.Range(
					document.positionAt(0),
					document.positionAt(text.length),
				),
				newText,
			);

			const applied = await vscode.workspace.applyEdit(edit);
			if (!applied) {
				return { success: false, message: 'Failed to apply edit' };
			}

			await document.save();
			return { success: true, message: 'Changes saved successfully' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message };
		}
	}

	/**
	 * Removes a dependency from the package.json.
	 * Checks both dependencies and devDependencies.
	 *
	 * @param packageName - Name of the package to remove
	 * @returns Result indicating success or failure
	 */
	async removeDependency(packageName: string): Promise<EditResult> {
		const packageJson = await this.read();
		if (!packageJson) {
			return { success: false, message: 'Failed to read package.json' };
		}

		let modified = false;

		// Create mutable copies for modification
		const deps = { ...packageJson.dependencies } as Record<string, string>;
		const devDeps = { ...packageJson.devDependencies } as Record<
			string,
			string
		>;

		if (deps[packageName]) {
			delete deps[packageName];
			modified = true;
		}

		if (devDeps[packageName]) {
			delete devDeps[packageName];
			modified = true;
		}

		if (!modified) {
			return {
				success: false,
				message: `${packageName} not found in dependencies`,
			};
		}

		const result = await this.write({
			...packageJson,
			dependencies: deps,
			devDependencies: devDeps,
		});

		if (result.success) {
			return {
				success: true,
				message: `Removed ${packageName} from package.json`,
			};
		}

		return result;
	}

	/**
	 * Updates a dependency to a new version.
	 *
	 * @param packageName - Name of the package to update
	 * @param version - New version to set
	 * @returns Result indicating success or failure
	 */
	async updateDependency(
		packageName: string,
		version: string,
	): Promise<EditResult> {
		const packageJson = await this.read();
		if (!packageJson) {
			return { success: false, message: 'Failed to read package.json' };
		}

		let modified = false;

		// Create mutable copies for modification
		const deps = { ...packageJson.dependencies } as Record<string, string>;
		const devDeps = { ...packageJson.devDependencies } as Record<
			string,
			string
		>;

		if (deps[packageName]) {
			deps[packageName] = version;
			modified = true;
		}

		if (devDeps[packageName]) {
			devDeps[packageName] = version;
			modified = true;
		}

		if (!modified) {
			return {
				success: false,
				message: `${packageName} not found in dependencies`,
			};
		}

		const result = await this.write({
			...packageJson,
			dependencies: deps,
			devDependencies: devDeps,
		});

		if (result.success) {
			return {
				success: true,
				message: `Updated ${packageName} to ${version}`,
			};
		}

		return result;
	}

	/**
	 * Adds a field to the package.json.
	 *
	 * @param fieldName - Name of the field to add
	 * @param value - Value to set for the field
	 * @returns Result indicating success or failure
	 */
	async addField(fieldName: string, value: unknown): Promise<EditResult> {
		const packageJson = await this.read();
		if (!packageJson) {
			return { success: false, message: 'Failed to read package.json' };
		}

		const result = await this.write({
			...packageJson,
			[fieldName]: value,
		});

		if (result.success) {
			return {
				success: true,
				message: `Added '${fieldName}' field to package.json`,
			};
		}

		return result;
	}
}

/**
 * Default values for common package.json metadata fields.
 */
export const DEFAULT_METADATA_VALUES: Record<string, unknown> = {
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
