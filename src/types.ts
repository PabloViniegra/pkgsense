import type * as vscode from 'vscode';

// Severity levels as const for better type safety
export const SEVERITY_LEVELS = {
	INFO: 'info',
	WARNING: 'warning',
	ERROR: 'error',
} as const;

export type Severity = (typeof SEVERITY_LEVELS)[keyof typeof SEVERITY_LEVELS];

// Tag categories for findings
export const FINDING_TAGS = {
	MAINTENANCE: 'maintenance',
	REPLACEMENT: 'replacement',
	DUPLICATION: 'duplication',
	QUALITY: 'quality',
	PACKAGING: 'packaging',
	CONFIG: 'config',
	PERFORMANCE: 'performance',
	SECURITY: 'security',
	LICENSE: 'license',
	UPDATES: 'updates',
	ENGINES: 'engines',
	SCRIPTS: 'scripts',
	DEPENDENCIES: 'dependencies',
} as const;

export type FindingTag = (typeof FINDING_TAGS)[keyof typeof FINDING_TAGS];

// Finding interface with discriminated type property
// Using a single interface instead of union since all branches were identical
export interface Finding {
	readonly id?: string;
	readonly type: Severity;
	readonly message: string;
	readonly dependency?: string;
	readonly range?: vscode.Range;
	/** JSON path of the key the diagnostic belongs on, e.g. ["engines", "node"] */
	readonly location?: readonly string[];
	readonly tags?: readonly FindingTag[];
	readonly meta?: Readonly<Record<string, unknown>>;
}

// PackageJson with stricter typing
export interface PackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly description?: string;
	readonly keywords?: readonly string[];
	readonly author?:
		| string
		| {
				readonly name: string;
				readonly email?: string;
				readonly url?: string;
		  };
	readonly license?: string;
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly scripts?: Readonly<Record<string, string>>;
	readonly files?: readonly string[];
	readonly type?: 'module' | 'commonjs';
	readonly repository?:
		| string
		| {
				readonly type: string;
				readonly url: string;
		  };
	readonly bugs?:
		| string
		| {
				readonly url: string;
				readonly email?: string;
		  };
	readonly homepage?: string;
	readonly engines?: {
		readonly node?: string;
		readonly npm?: string;
	};
	readonly [key: string]: unknown; // Allow other fields
}

const isString = (value: unknown): boolean => typeof value === 'string';

const PACKAGE_FIELD_VALIDATORS: Readonly<
	Record<string, (value: unknown) => boolean>
> = {
	name: isString,
	version: isString,
	dependencies: isStringRecord,
	devDependencies: isStringRecord,
	scripts: isStringRecord,
	files: isStringArray,
	type: (value) => value === 'module' || value === 'commonjs',
};

// Type guard with more comprehensive validation
export function isPackageJson(data: unknown): data is PackageJson {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return false;
	}

	const obj = data as Record<string, unknown>;

	// Using bracket notation throughout due to TypeScript strictIndexSignatureKeys
	return Object.entries(PACKAGE_FIELD_VALIDATORS).every(
		([field, isValid]) => obj[field] === undefined || isValid(obj[field]),
	);
}

// Helper type guards
function isStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	return Object.values(value).every((v) => typeof v === 'string');
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
