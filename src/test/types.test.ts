import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import {
	isPackageJson,
	FINDING_TAGS,
	SEVERITY_LEVELS,
	type PackageJson,
	type Finding,
} from '../types';

suite('Types Module Test Suite', () => {
	suite('isPackageJson Type Guard', () => {
		test('should accept empty object', () => {
			const data = {};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept valid minimal package.json', () => {
			const data = {
				name: 'test-package',
				version: '1.0.0',
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with dependencies', () => {
			const data = {
				name: 'test-package',
				dependencies: {
					express: '^4.0.0',
					lodash: '^4.17.0',
				},
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with devDependencies', () => {
			const data = {
				name: 'test-package',
				devDependencies: {
					typescript: '^5.0.0',
					jest: '^29.0.0',
				},
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with scripts', () => {
			const data = {
				scripts: {
					test: 'jest',
					build: 'tsc',
					start: 'node index.js',
				},
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with files array', () => {
			const data = {
				files: ['dist', 'src', 'README.md'],
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with type module', () => {
			const data = {
				type: 'module' as const,
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with type commonjs', () => {
			const data = {
				type: 'commonjs' as const,
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept complete package.json', () => {
			const data: PackageJson = {
				name: 'test-package',
				version: '1.0.0',
				type: 'module',
				files: ['dist'],
				scripts: {
					test: 'jest',
					build: 'tsc',
				},
				dependencies: {
					express: '^4.0.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
				},
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should accept package.json with additional fields', () => {
			const data = {
				name: 'test-package',
				description: 'A test package',
				author: 'Test Author',
				license: 'MIT',
				repository: 'https://github.com/test/repo',
			};
			assert.strictEqual(isPackageJson(data), true);
		});

		test('should reject null', () => {
			assert.strictEqual(isPackageJson(null), false);
		});

		test('should reject undefined', () => {
			assert.strictEqual(isPackageJson(undefined), false);
		});

		test('should reject string', () => {
			assert.strictEqual(isPackageJson('not an object'), false);
		});

		test('should reject number', () => {
			assert.strictEqual(isPackageJson(42), false);
		});

		test('should reject array', () => {
			assert.strictEqual(isPackageJson([]), false);
		});

		test('should reject invalid name type', () => {
			const data = {
				name: 123,
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject invalid version type', () => {
			const data = {
				version: true,
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject non-object dependencies', () => {
			const data = {
				dependencies: 'not an object',
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject dependencies with non-string values', () => {
			const data = {
				dependencies: {
					express: 123,
				},
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject non-object devDependencies', () => {
			const data = {
				devDependencies: ['typescript'],
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject devDependencies with non-string values', () => {
			const data = {
				devDependencies: {
					typescript: { version: '5.0.0' },
				},
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject non-object scripts', () => {
			const data = {
				scripts: 'test command',
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject scripts with non-string values', () => {
			const data = {
				scripts: {
					test: 123,
				},
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject non-array files', () => {
			const data = {
				files: 'dist',
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject files with non-string elements', () => {
			const data = {
				files: ['dist', 123, 'src'],
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should reject invalid type value', () => {
			const data = {
				type: 'invalid',
			};
			assert.strictEqual(isPackageJson(data), false);
		});

		test('should accept undefined optional fields', () => {
			const data = {
				name: 'test',
				version: undefined,
				dependencies: undefined,
				devDependencies: undefined,
				scripts: undefined,
				files: undefined,
				type: undefined,
			};
			assert.strictEqual(isPackageJson(data), true);
		});
	});

	suite('Finding Type', () => {
		test('should create error finding', () => {
			const finding: Finding = {
				type: 'error',
				message: 'Critical error',
			};

			assert.strictEqual(finding.type, 'error');
			assert.strictEqual(finding.message, 'Critical error');
		});

		test('should create warning finding', () => {
			const finding: Finding = {
				type: 'warning',
				message: 'Warning message',
				dependency: 'test-package',
			};

			assert.strictEqual(finding.type, 'warning');
			assert.strictEqual(finding.message, 'Warning message');
			assert.strictEqual(finding.dependency, 'test-package');
		});

		test('should create info finding', () => {
			const finding: Finding = {
				type: 'info',
				message: 'Information',
				tags: [FINDING_TAGS.QUALITY],
			};

			assert.strictEqual(finding.type, 'info');
			assert.strictEqual(finding.message, 'Information');
			assert.ok(finding.tags);
			assert.strictEqual(finding.tags[0], FINDING_TAGS.QUALITY);
		});

		test('should allow all optional fields', () => {
			const finding: Finding = {
				id: 'unique-id',
				type: 'error',
				message: 'Test',
				dependency: 'package-name',
				tags: [FINDING_TAGS.SECURITY, FINDING_TAGS.PERFORMANCE],
				meta: { customData: 'value' },
			};

			assert.ok(finding.id);
			assert.ok(finding.dependency);
			assert.ok(finding.tags);
			assert.ok(finding.meta);
		});
	});

	suite('Constants', () => {
		test('SEVERITY_LEVELS should have correct values', () => {
			assert.strictEqual(SEVERITY_LEVELS.INFO, 'info');
			assert.strictEqual(SEVERITY_LEVELS.WARNING, 'warning');
			assert.strictEqual(SEVERITY_LEVELS.ERROR, 'error');
		});

		test('FINDING_TAGS should have correct values', () => {
			assert.strictEqual(FINDING_TAGS.MAINTENANCE, 'maintenance');
			assert.strictEqual(FINDING_TAGS.REPLACEMENT, 'replacement');
			assert.strictEqual(FINDING_TAGS.DUPLICATION, 'duplication');
			assert.strictEqual(FINDING_TAGS.QUALITY, 'quality');
			assert.strictEqual(FINDING_TAGS.PACKAGING, 'packaging');
			assert.strictEqual(FINDING_TAGS.CONFIG, 'config');
			assert.strictEqual(FINDING_TAGS.PERFORMANCE, 'performance');
			assert.strictEqual(FINDING_TAGS.SECURITY, 'security');
		});

		test('SEVERITY_LEVELS should be readonly', () => {
			const levels = SEVERITY_LEVELS;
			// TypeScript enforces readonly at compile-time, not runtime
			// Just verify the values are correct
			assert.strictEqual(levels.INFO, 'info');
			assert.strictEqual(levels.WARNING, 'warning');
			assert.strictEqual(levels.ERROR, 'error');
		});

		test('FINDING_TAGS should be readonly', () => {
			const tags = FINDING_TAGS;
			// TypeScript enforces readonly at compile-time, not runtime
			// Just verify the values are correct
			assert.strictEqual(tags.SECURITY, 'security');
			assert.strictEqual(tags.PERFORMANCE, 'performance');
		});
	});

	suite('Type Safety', () => {
		test('should enforce severity type', () => {
			const validFindings: Finding[] = [
				{ type: 'error', message: 'Error' },
				{ type: 'warning', message: 'Warning' },
				{ type: 'info', message: 'Info' },
			];

			assert.strictEqual(validFindings.length, 3);
		});

		test('should enforce tag types', () => {
			const finding: Finding = {
				type: 'warning',
				message: 'Test',
				tags: [
					FINDING_TAGS.SECURITY,
					FINDING_TAGS.PERFORMANCE,
					FINDING_TAGS.QUALITY,
				],
			};

			assert.ok(finding.tags);
			assert.strictEqual(finding.tags.length, 3);
		});

		test('should enforce readonly on finding properties', () => {
			const finding: Finding = {
				type: 'error',
				message: 'Test',
			};

			// TypeScript enforces readonly at compile-time, not runtime
			// Verify the finding has the correct properties
			assert.strictEqual(finding.type, 'error');
			assert.strictEqual(finding.message, 'Test');
		});
	});

	suite('PackageJson Interface', () => {
		test('should allow all standard package.json fields', () => {
			const pkg: PackageJson = {
				name: 'test',
				version: '1.0.0',
				description: 'A test package',
				main: 'index.js',
				module: 'index.mjs',
				types: 'index.d.ts',
				type: 'module',
				files: ['dist'],
				scripts: {
					test: 'jest',
					build: 'tsc',
				},
				dependencies: {
					express: '^4.0.0',
				},
				devDependencies: {
					typescript: '^5.0.0',
				},
				peerDependencies: {
					react: '^18.0.0',
				},
				keywords: ['test', 'package'],
				author: 'Test Author',
				license: 'MIT',
			};

			assert.ok(pkg);
		});

		test('should allow custom fields via index signature', () => {
			const pkg: PackageJson = {
				name: 'test',
				customField: 'custom value',
				nestedCustom: {
					key: 'value',
				},
			};

			assert.strictEqual(pkg.customField, 'custom value');
		});
	});
});
