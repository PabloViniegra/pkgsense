import type * as vscode from 'vscode';

export type Severity = 'info' | 'warning' | 'error';

export interface Finding {
	id?: string;
	type: Severity;
	message: string;
	dependency?: string;
	range?: vscode.Range;
	tags?: string[];
	meta?: unknown;
}

export interface PackageJson {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
	files?: string[];
	type?: string;
}
