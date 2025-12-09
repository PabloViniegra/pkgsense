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

/**
 * Represents an operation that cannot fail.
 * Use this for operations that always succeed instead of Result<T, never>.
 *
 * @template T - The type of the success data
 *
 * @example
 * ```typescript
 * async function alwaysSucceeds(): Promise<InfallibleResult<number>> {
 *   return infallible(42);
 * }
 * ```
 */
export type InfallibleResult<T> = Success<T>;

/**
 * Creates an infallible result (operation that cannot fail).
 * This is semantically clearer than success() for operations that cannot fail.
 *
 * @template T - The type of the success data
 * @param data - The success data to wrap
 * @returns An InfallibleResult containing the data
 *
 * @example
 * ```typescript
 * const result = infallible(42);
 * // result.data === 42, no need to check result.success
 * ```
 */
export function infallible<T>(data: T): InfallibleResult<T> {
	return { success: true, data };
}

/**
 * Maps a Result to a new Result by applying a function to the success value.
 *
 * @template T - The type of the input success data
 * @template U - The type of the output success data
 * @template E - The type of the error
 * @param result - The Result to map
 * @param fn - The function to apply to the success value
 * @returns A new Result with the mapped value
 *
 * @example
 * ```typescript
 * const result = success(42);
 * const doubled = mapResult(result, x => x * 2);
 * // doubled.data === 84
 * ```
 */
export function mapResult<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => U,
): Result<U, E> {
	if (result.success) {
		return success(fn(result.data));
	}
	return result;
}

/**
 * Chains Results together, propagating failures.
 *
 * @template T - The type of the input success data
 * @template U - The type of the output success data
 * @template E - The type of the error
 * @param result - The Result to chain
 * @param fn - The function that returns a new Result
 * @returns The result of fn if input succeeded, otherwise the input failure
 *
 * @example
 * ```typescript
 * const result = success(42);
 * const chained = flatMapResult(result, x => success(x * 2));
 * ```
 */
export function flatMapResult<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>,
): Result<U, E> {
	if (result.success) {
		return fn(result.data);
	}
	return result;
}
