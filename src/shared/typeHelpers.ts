/**
 * Type helper utilities for enhanced type safety.
 */

/**
 * Ensures exhaustive checking in switch statements.
 * TypeScript will error if not all cases are handled.
 *
 * @param value - The value that should be of type never if all cases are handled
 * @returns Never returns (throws error)
 *
 * @example
 * ```typescript
 * function handleStatus(status: 'pending' | 'success' | 'error') {
 *   switch (status) {
 *     case 'pending': return 'Processing...';
 *     case 'success': return 'Done!';
 *     case 'error': return 'Failed!';
 *     default: return assertNever(status); // Compile error if a case is missing
 *   }
 * }
 * ```
 */
export function assertNever(value: never): never {
	throw new Error(
		`Unexpected value: ${JSON.stringify(value)}. This should never happen.`,
	);
}

/**
 * Makes all properties in T optional recursively.
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Makes all properties in T required recursively.
 */
export type DeepRequired<T> = {
	[P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Makes all properties in T readonly recursively.
 */
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extracts keys of T where the value type extends U.
 *
 * @example
 * ```typescript
 * type Example = { a: string; b: number; c: string };
 * type StringKeys = KeysOfType<Example, string>; // 'a' | 'c'
 * ```
 */
export type KeysOfType<T, U> = {
	[K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Extracts values from a const object as a union type.
 *
 * @example
 * ```typescript
 * const STATUS = { PENDING: 'pending', SUCCESS: 'success' } as const;
 * type Status = ValuesOf<typeof STATUS>; // 'pending' | 'success'
 * ```
 */
export type ValuesOf<T> = T[keyof T];

/**
 * Makes specified keys K of T required.
 *
 * @example
 * ```typescript
 * type User = { name?: string; age?: number; email?: string };
 * type UserWithRequiredEmail = RequireKeys<User, 'email'>;
 * // { name?: string; age?: number; email: string }
 * ```
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Excludes keys K from T and makes the rest partial.
 *
 * @example
 * ```typescript
 * type User = { id: string; name: string; email: string };
 * type UserUpdate = PartialExcept<User, 'id'>;
 * // { id: string; name?: string; email?: string }
 * ```
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> &
	Pick<T, K>;

/**
 * Type-safe Object.keys that preserves key types.
 * Note: Use with caution - assumes object has no extra properties at runtime.
 */
export function typedKeys<T extends object>(obj: T): Array<keyof T> {
	return Object.keys(obj) as Array<keyof T>;
}

/**
 * Type-safe Object.entries that preserves types.
 * Note: Use with caution - assumes object has no extra properties at runtime.
 */
export function typedEntries<T extends object>(
	obj: T,
): Array<[keyof T, T[keyof T]]> {
	return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}
