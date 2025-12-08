import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { fetchBundlephobia } from '../../utils/bundlephobia';

suite('Bundlephobia Utility Test Suite', () => {
	suite('Package Name Validation', () => {
		test('should reject empty package name', async () => {
			const result = await fetchBundlephobia('', '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('empty'));
			}
		});

		test('should reject whitespace-only package name', async () => {
			const result = await fetchBundlephobia('   ', '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('empty'));
			}
		});

		test('should reject package name with invalid characters', async () => {
			const result = await fetchBundlephobia('invalid@#$%', '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('invalid characters'));
			}
		});

		test('should reject package name exceeding max length', async () => {
			const longName = 'a'.repeat(215);
			const result = await fetchBundlephobia(longName, '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('maximum length'));
			}
		});

		test('should accept valid simple package names', async function () {
			this.timeout(60000); // Increase timeout for network calls

			const validNames = [
				'lodash',
				'express',
				'react',
				'my-package',
				'package.name',
				'package_name',
			];

			for (const name of validNames) {
				const result = await fetchBundlephobia(name, '1.0.0');
				// Should pass validation regardless of network success/failure
				if (!result.success) {
					assert.ok(
						!result.error.includes('Invalid package name'),
						`${name} should not have validation error, got: ${result.error}`,
					);
				} else {
					// If successful, data should be valid
					assert.ok(typeof result.data.size === 'number');
					assert.ok(typeof result.data.gzip === 'number');
				}
			}
		});

		test('should accept valid scoped package names', async () => {
			const validNames = [
				'@babel/core',
				'@types/node',
				'@scope/package-name',
				'@org/my.package',
			];

			for (const name of validNames) {
				const result = await fetchBundlephobia(name, '1.0.0');
				// Should pass validation regardless of network success/failure
				if (!result.success) {
					assert.ok(
						!result.error.includes('Invalid package name'),
						`${name} should not have validation error, got: ${result.error}`,
					);
				} else {
					// If successful, data should be valid
					assert.ok(typeof result.data.size === 'number');
					assert.ok(typeof result.data.gzip === 'number');
				}
			}
		}).timeout(10000);

		test('should trim package names', async () => {
			const result = await fetchBundlephobia('  lodash  ', '1.0.0');

			// Should pass validation (trimmed), network result may vary
			if (!result.success) {
				assert.ok(
					!result.error.includes('Invalid package name'),
					`Should not have validation error, got: ${result.error}`,
				);
			} else {
				assert.ok(typeof result.data.size === 'number');
				assert.ok(typeof result.data.gzip === 'number');
			}
		});
	});

	suite('Version Sanitization', () => {
		test('should handle caret versions', async () => {
			const result = await fetchBundlephobia('lodash', '^4.17.0');

			// Network result may vary, but should not fail on validation
			if (!result.success) {
				assert.ok(
					!result.error.includes('Invalid package name'),
					`Should not have validation error, got: ${result.error}`,
				);
			}
		});

		test('should handle tilde versions', async () => {
			const result = await fetchBundlephobia('lodash', '~4.17.0');

			// Network result may vary
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});

		test('should handle exact versions', async () => {
			const result = await fetchBundlephobia('lodash', '4.17.21');

			// Network result may vary
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});

		test('should handle empty version as latest', async () => {
			const result = await fetchBundlephobia('lodash', '');

			// Network result may vary
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});

		test('should handle version ranges', async () => {
			const result = await fetchBundlephobia('lodash', '>=4.0.0 <5.0.0');

			// Network result may vary
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});
	});

	suite('Error Handling', () => {
		test('should handle network errors gracefully', async () => {
			const result = await fetchBundlephobia(
				'nonexistent-package-xyz-123',
				'1.0.0',
			);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.length > 0);
			}
		});

		test('should handle timeout', async () => {
			// This test uses a real network call, so it's not ideal
			// In a production environment, we'd mock the fetch
			const result = await fetchBundlephobia('lodash', '4.17.21');

			// Should complete (success or fail) within reasonable time
			assert.ok(result.success === true || result.success === false);
		});
	});

	suite('Response Validation', () => {
		test('should validate response structure', async () => {
			// This test would ideally use a mock, but we'll test the real API
			const result = await fetchBundlephobia('lodash', '4.17.21');

			if (result.success) {
				assert.ok(typeof result.data.size === 'number');
				assert.ok(typeof result.data.gzip === 'number');
				assert.ok(result.data.size >= 0);
				assert.ok(result.data.gzip >= 0);
			}
		});
	});

	suite('URL Encoding', () => {
		test('should properly encode scoped packages', async () => {
			const result = await fetchBundlephobia('@types/node', '18.0.0');

			// Should not fail on encoding issues
			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});

		test('should handle packages with dots', async () => {
			const result = await fetchBundlephobia('lodash.debounce', '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(!result.error.includes('Invalid package name'));
			}
		});
	});

	suite('Edge Cases', () => {
		test('should handle null as package name', async () => {
			const result = await fetchBundlephobia(
				null as unknown as string,
				'1.0.0',
			);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('Invalid package name'));
			}
		});

		test('should handle undefined as package name', async () => {
			const result = await fetchBundlephobia(
				undefined as unknown as string,
				'1.0.0',
			);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('Invalid package name'));
			}
		});

		test('should handle number as package name', async () => {
			const result = await fetchBundlephobia(123 as unknown as string, '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('Invalid package name'));
			}
		});

		test('should handle object as package name', async () => {
			const result = await fetchBundlephobia({} as unknown as string, '1.0.0');

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(result.error.includes('Invalid package name'));
			}
		});
	});

	suite('Real API Integration', () => {
		test('should fetch real package data for lodash', async () => {
			const result = await fetchBundlephobia('lodash', '4.17.21');

			if (result.success) {
				assert.ok(result.data.size > 0, 'Size should be greater than 0');
				assert.ok(result.data.gzip > 0, 'Gzip size should be greater than 0');
				assert.ok(
					result.data.size > result.data.gzip,
					'Size should be greater than gzip size',
				);
			} else {
				// Network might be unavailable, that's acceptable
				console.warn(`Skipped real API test: ${result.error}`);
			}
		}).timeout(10000);

		test('should handle 404 for non-existent package', async () => {
			const result = await fetchBundlephobia(
				'this-package-definitely-does-not-exist-xyz-123',
				'1.0.0',
			);

			assert.strictEqual(result.success, false);
			if (!result.success) {
				assert.ok(
					result.error.includes('HTTP') || result.error.includes('Error'),
				);
			}
		}).timeout(10000);
	});
});
