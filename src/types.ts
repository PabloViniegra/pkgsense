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
} as const;

export type FindingTag = (typeof FINDING_TAGS)[keyof typeof FINDING_TAGS];

// Discriminated union for different types of findings
export type Finding =
	| {
			readonly id?: string;
			readonly type: 'info';
			readonly message: string;
			readonly dependency?: string;
			readonly range?: vscode.Range;
			readonly tags?: readonly FindingTag[];
			readonly meta?: unknown;
	  }
	| {
			readonly id?: string;
			readonly type: 'warning';
			readonly message: string;
			readonly dependency?: string;
			readonly range?: vscode.Range;
			readonly tags?: readonly FindingTag[];
			readonly meta?: unknown;
	  }
	| {
			readonly id?: string;
			readonly type: 'error';
			readonly message: string;
			readonly dependency?: string;
			readonly range?: vscode.Range;
			readonly tags?: readonly FindingTag[];
			readonly meta?: unknown;
	  };

// Helper type for creating findings with better type inference
export type CreateFinding<S extends Severity = Severity> = Omit<
	Extract<Finding, { type: S }>,
	'type'
> & {
	type: S;
};

// PackageJson with stricter typing
export interface PackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly scripts?: Readonly<Record<string, string>>;
	readonly files?: readonly string[];
	readonly type?: 'module' | 'commonjs';
	readonly [key: string]: unknown; // Allow other fields
}

// Type guard with more comprehensive validation
export function isPackageJson(data: unknown): data is PackageJson {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return false;
	}

	const obj = data as Record<string, unknown>;

	// Check optional name field
	if ('name' in obj && typeof obj.name !== 'string' && obj.name !== undefined) {
		return false;
	}

	// Check optional version field
	if (
		'version' in obj &&
		typeof obj.version !== 'string' &&
		obj.version !== undefined
	) {
		return false;
	}

	// Check optional dependencies
	if (
		'dependencies' in obj &&
		obj.dependencies !== undefined &&
		!isStringRecord(obj.dependencies)
	) {
		return false;
	}

	// Check optional devDependencies
	if (
		'devDependencies' in obj &&
		obj.devDependencies !== undefined &&
		!isStringRecord(obj.devDependencies)
	) {
		return false;
	}

	// Check optional scripts
	if (
		'scripts' in obj &&
		obj.scripts !== undefined &&
		!isStringRecord(obj.scripts)
	) {
		return false;
	}

	// Check optional files array
	if ('files' in obj && obj.files !== undefined && !isStringArray(obj.files)) {
		return false;
	}

	// Check optional type field
	if (
		'type' in obj &&
		obj.type !== undefined &&
		obj.type !== 'module' &&
		obj.type !== 'commonjs'
	) {
		return false;
	}

	return true;
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
