import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import {
	success,
	failure,
	isSuccess,
	isFailure,
	type Result,
} from '../../shared/result';

suite('Result Type Test Suite', () => {
	suite('Success Creation', () => {
		test('should create success with string data', () => {
			const result = success('test data');

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, 'test data');
			}
		});

		test('should create success with number data', () => {
			const result = success(42);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, 42);
			}
		});

		test('should create success with object data', () => {
			const data = { name: 'test', value: 123 };
			const result = success(data);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.data, data);
			}
		});

		test('should create success with array data', () => {
			const data = [1, 2, 3, 4, 5];
			const result = success(data);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.data, data);
			}
		});

		test('should create success with null data', () => {
			const result = success(null);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, null);
			}
		});

		test('should create success with undefined data', () => {
			const result = success(undefined);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, undefined);
			}
		});
	});

	suite('Failure Creation', () => {
		test('should create failure with string error', () => {
			const result = failure('error message');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error, 'error message');
			}
		});

		test('should create failure with error object', () => {
			const error = new Error('test error');
			const result = failure(error);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error, error);
			}
		});

		test('should create failure with custom error type', () => {
			const error = { code: 'TEST_ERROR', message: 'Test failed' };
			const result = failure(error);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.deepStrictEqual(result.error, error);
			}
		});

		test('should create failure with number error', () => {
			const result = failure(404);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.strictEqual(result.error, 404);
			}
		});
	});

	suite('Type Guards', () => {
		test('isSuccess should return true for success', () => {
			const result = success('data');

			assert.strictEqual(isSuccess(result), true);
		});

		test('isSuccess should return false for failure', () => {
			const result = failure('error');

			assert.strictEqual(isSuccess(result), false);
		});

		test('isFailure should return true for failure', () => {
			const result = failure('error');

			assert.strictEqual(isFailure(result), true);
		});

		test('isFailure should return false for success', () => {
			const result = success('data');

			assert.strictEqual(isFailure(result), false);
		});

		test('type guards should narrow types correctly', () => {
			const result: Result<string, Error> = success('test');

			if (isSuccess(result)) {
				// TypeScript should know result.data is string
				const data: string = result.data;
				assert.strictEqual(data, 'test');
			}
		});
	});

	suite('Pattern Matching', () => {
		test('should handle success in if statement', () => {
			const result = success(42);
			let value = 0;

			if (result.success) {
				value = result.data;
			}

			assert.strictEqual(value, 42);
		});

		test('should handle failure in if statement', () => {
			const result = failure('error');
			let errorMessage = '';

			if (!result.success) {
				errorMessage = result.error;
			}

			assert.strictEqual(errorMessage, 'error');
		});

		test('should handle success with early return', () => {
			function processResult(result: Result<number, string>): number {
				if (!result.success) {
					return -1;
				}
				return result.data * 2;
			}

			assert.strictEqual(processResult(success(10)), 20);
			assert.strictEqual(processResult(failure('error')), -1);
		});
	});

	suite('Composition', () => {
		test('should compose multiple results', () => {
			function divide(a: number, b: number): Result<number, string> {
				if (b === 0) {
					return failure('Division by zero');
				}
				return success(a / b);
			}

			function sqrt(n: number): Result<number, string> {
				if (n < 0) {
					return failure('Negative number');
				}
				return success(Math.sqrt(n));
			}

			const divResult = divide(16, 4);
			assert.strictEqual(divResult.success, true);

			if (divResult.success) {
				const sqrtResult = sqrt(divResult.data);
				assert.strictEqual(sqrtResult.success, true);
				if (sqrtResult.success) {
					assert.strictEqual(sqrtResult.data, 2);
				}
			}
		});

		test('should handle chained failures', () => {
			function step1(): Result<number, string> {
				return failure('Step 1 failed');
			}

			function step2(n: number): Result<number, string> {
				return success(n * 2);
			}

			const result1 = step1();
			if (result1.success) {
				step2(result1.data);
				assert.fail('Should not reach here');
			} else {
				assert.strictEqual(result1.error, 'Step 1 failed');
			}
		});
	});

	suite('Edge Cases', () => {
		test('should handle success with empty object', () => {
			const result = success({});

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.data, {});
			}
		});

		test('should handle success with empty array', () => {
			const result = success([]);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.data, []);
			}
		});

		test('should handle success with false value', () => {
			const result = success(false);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, false);
			}
		});

		test('should handle success with zero', () => {
			const result = success(0);

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, 0);
			}
		});

		test('should handle success with empty string', () => {
			const result = success('');

			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.strictEqual(result.data, '');
			}
		});
	});

	suite('Type Inference', () => {
		test('should infer correct types', () => {
			const stringResult: Result<string, Error> = success('test');
			const numberResult: Result<number, string> = success(42);
			const boolResult: Result<boolean, number> = failure(404);

			assert.strictEqual(stringResult.success, true);
			assert.strictEqual(numberResult.success, true);
			assert.strictEqual(boolResult.success, false);
		});

		test('should work with generic functions', () => {
			function wrapInResult<T>(value: T): Result<T, never> {
				return success(value);
			}

			const result1 = wrapInResult(42);
			const result2 = wrapInResult('test');
			const result3 = wrapInResult({ key: 'value' });

			assert.strictEqual(result1.success, true);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result3.success, true);
		});
	});
});
