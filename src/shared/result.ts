export type Success<T> = {
	success: true;
	data: T;
};

export type Failure<E> = {
	success: false;
	error: E;
};

export type Result<T, E> = Success<T> | Failure<E>;

export function success<T>(data: T): Success<T> {
	return { success: true, data };
}

export function failure<E>(error: E): Failure<E> {
	return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
	return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
	return !result.success;
}
