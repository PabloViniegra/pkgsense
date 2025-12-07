/**
 * Represents a successful operation result.
 * @template T - The type of the success data
 */
export type Success<T> = {
	success: true;
	data: T;
};

/**
 * Represents a failed operation result.
 * @template E - The type of the error
 */
export type Failure<E> = {
	success: false;
	error: E;
};

/**
 * Discriminated union type for operation results.
 * Enables explicit error handling without exceptions.
 *
 * @template T - The type of the success data
 * @template E - The type of the error
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return failure('Division by zero');
 *   return success(a / b);
 * }
 * ```
 */
export type Result<T, E> = Success<T> | Failure<E>;

/**
 * Creates a successful Result.
 *
 * @template T - The type of the success data
 * @param data - The success data to wrap
 * @returns A Success Result containing the data
 *
 * @example
 * ```typescript
 * const result = success(42);
 * // result.success === true
 * // result.data === 42
 * ```
 */
export function success<T>(data: T): Success<T> {
	return { success: true, data };
}

/**
 * Creates a failed Result.
 *
 * @template E - The type of the error
 * @param error - The error to wrap
 * @returns A Failure Result containing the error
 *
 * @example
 * ```typescript
 * const result = failure('Something went wrong');
 * // result.success === false
 * // result.error === 'Something went wrong'
 * ```
 */
export function failure<E>(error: E): Failure<E> {
	return { success: false, error };
}

/**
 * Type guard to check if a Result is successful.
 *
 * @template T - The type of the success data
 * @template E - The type of the error
 * @param result - The Result to check
 * @returns True if the result is a Success, false otherwise
 *
 * @example
 * ```typescript
 * const result = success(42);
 * if (isSuccess(result)) {
 *   console.log(result.data); // TypeScript knows result.data exists
 * }
 * ```
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
	return result.success;
}

/**
 * Type guard to check if a Result is a failure.
 *
 * @template T - The type of the success data
 * @template E - The type of the error
 * @param result - The Result to check
 * @returns True if the result is a Failure, false otherwise
 *
 * @example
 * ```typescript
 * const result = failure('error');
 * if (isFailure(result)) {
 *   console.error(result.error); // TypeScript knows result.error exists
 * }
 * ```
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
	return !result.success;
}
