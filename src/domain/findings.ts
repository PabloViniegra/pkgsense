/**
 * Domain layer types for findings.
 *
 * These types are decoupled from VS Code to enable:
 * - Unit testing without VS Code runtime
 * - Reuse across different presentation layers
 * - Clean separation of concerns
 */

import type { LineRange } from '../analyzers/types';

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

/**
 * Base finding type that is VS Code agnostic.
 * Uses LineRange instead of vscode.Range for positioning.
 */
export interface BaseFinding {
	/** Optional unique identifier for the finding */
	readonly id?: string;
	/** Severity level of the finding */
	readonly type: Severity;
	/** Human-readable message describing the finding */
	readonly message: string;
	/** The dependency this finding relates to (if applicable) */
	readonly dependency?: string;
	/** Position in the document (VS Code agnostic) */
	readonly lineRange?: LineRange;
	/** Categorization tags for the finding */
	readonly tags?: readonly FindingTag[];
	/** Additional metadata for the finding */
	readonly meta?: unknown;
}

/**
 * Factory function to create a finding with proper typing.
 * Only includes defined optional properties to satisfy exactOptionalPropertyTypes.
 */
export function createFinding(params: BaseFinding): BaseFinding {
	// Build finding object with only defined properties
	const finding: BaseFinding = {
		type: params.type,
		message: params.message,
		...(params.id !== undefined && { id: params.id }),
		...(params.dependency !== undefined && { dependency: params.dependency }),
		...(params.lineRange !== undefined && { lineRange: params.lineRange }),
		...(params.tags !== undefined && { tags: params.tags }),
		...(params.meta !== undefined && { meta: params.meta }),
	};

	return finding;
}

/**
 * Creates an info finding.
 */
export function infoFinding(
	message: string,
	options?: Omit<BaseFinding, 'type' | 'message'>,
): BaseFinding {
	return createFinding({ ...options, type: 'info', message });
}

/**
 * Creates a warning finding.
 */
export function warningFinding(
	message: string,
	options?: Omit<BaseFinding, 'type' | 'message'>,
): BaseFinding {
	return createFinding({ ...options, type: 'warning', message });
}

/**
 * Creates an error finding.
 */
export function errorFinding(
	message: string,
	options?: Omit<BaseFinding, 'type' | 'message'>,
): BaseFinding {
	return createFinding({ ...options, type: 'error', message });
}
