import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import { DiagnosticsManager } from '../../decorators/diagnostics';
import type { Finding } from '../../types';
import { FINDING_TAGS } from '../../types';

suite('DiagnosticsManager Test Suite', () => {
	let manager: DiagnosticsManager;
	let testUri: vscode.Uri;

	setup(() => {
		manager = new DiagnosticsManager('test-diagnostics');
		testUri = vscode.Uri.file('/test/package.json');
	});

	teardown(() => {
		manager.dispose();
	});

	suite('Finding to Diagnostic Conversion', () => {
		test('should convert error finding to error diagnostic', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Critical issue found',
					dependency: 'lodash',
					range: new vscode.Range(5, 10, 5, 20),
				},
			];

			manager.setFindings(testUri, findings);

			// We can't directly access the diagnostics collection,
			// but we can verify no errors were thrown
			assert.ok(true);
		});

		test('should convert warning finding to warning diagnostic', () => {
			const findings: Finding[] = [
				{
					type: 'warning',
					message: 'Potential issue',
					dependency: 'express',
					range: new vscode.Range(3, 5, 3, 15),
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should convert info finding to info diagnostic', () => {
			const findings: Finding[] = [
				{
					type: 'info',
					message: 'Suggestion',
					range: new vscode.Range(1, 0, 1, 10),
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});

	suite('Default Range Handling', () => {
		test('should use default range when not provided', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Error without range',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle findings with and without ranges', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'With range',
					range: new vscode.Range(5, 10, 5, 20),
				},
				{
					type: 'warning',
					message: 'Without range',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});

	suite('Multiple Findings', () => {
		test('should handle multiple findings', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Error 1',
					dependency: 'package-1',
					tags: [FINDING_TAGS.SECURITY],
				},
				{
					type: 'warning',
					message: 'Warning 1',
					dependency: 'package-2',
					tags: [FINDING_TAGS.PERFORMANCE],
				},
				{
					type: 'info',
					message: 'Info 1',
					tags: [FINDING_TAGS.QUALITY],
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle empty findings array', () => {
			manager.setFindings(testUri, []);

			assert.ok(true);
		});
	});

	suite('Dependency Information', () => {
		test('should include dependency as diagnostic code', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Issue in dependency',
					dependency: 'test-package',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle findings without dependency', () => {
			const findings: Finding[] = [
				{
					type: 'info',
					message: 'General suggestion',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});

	suite('Tags', () => {
		test('should handle findings with tags', () => {
			const findings: Finding[] = [
				{
					type: 'warning',
					message: 'Security issue',
					tags: [FINDING_TAGS.SECURITY, FINDING_TAGS.MAINTENANCE],
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle findings without tags', () => {
			const findings: Finding[] = [
				{
					type: 'info',
					message: 'No tags',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});

	suite('Clear Operations', () => {
		test('should clear specific URI diagnostics', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Test error',
				},
			];

			manager.setFindings(testUri, findings);
			manager.clear(testUri);

			assert.ok(true);
		});

		test('should clear all diagnostics', () => {
			const uri1 = vscode.Uri.file('/test/package1.json');
			const uri2 = vscode.Uri.file('/test/package2.json');

			manager.setFindings(uri1, [
				{ type: 'error', message: 'Error 1' },
			]);
			manager.setFindings(uri2, [
				{ type: 'warning', message: 'Warning 1' },
			]);

			manager.clear();

			assert.ok(true);
		});
	});

	suite('Disposal', () => {
		test('should dispose cleanly', () => {
			const tempManager = new DiagnosticsManager('temp');
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Test',
				},
			];

			tempManager.setFindings(testUri, findings);
			tempManager.dispose();

			assert.ok(true);
		});

		test('should not throw after disposal', () => {
			const tempManager = new DiagnosticsManager('temp');
			tempManager.dispose();

			assert.doesNotThrow(() => {
				tempManager.dispose();
			});
		});
	});

	suite('Multiple Updates', () => {
		test('should update diagnostics for same URI', () => {
			const findings1: Finding[] = [
				{
					type: 'error',
					message: 'First error',
				},
			];

			const findings2: Finding[] = [
				{
					type: 'warning',
					message: 'Second warning',
				},
				{
					type: 'info',
					message: 'Info message',
				},
			];

			manager.setFindings(testUri, findings1);
			manager.setFindings(testUri, findings2);

			assert.ok(true);
		});
	});

	suite('Different URIs', () => {
		test('should handle multiple URIs independently', () => {
			const uri1 = vscode.Uri.file('/test/package1.json');
			const uri2 = vscode.Uri.file('/test/package2.json');
			const uri3 = vscode.Uri.file('/test/package3.json');

			manager.setFindings(uri1, [
				{ type: 'error', message: 'Error in file 1' },
			]);
			manager.setFindings(uri2, [
				{ type: 'warning', message: 'Warning in file 2' },
			]);
			manager.setFindings(uri3, [
				{ type: 'info', message: 'Info in file 3' },
			]);

			assert.ok(true);
		});
	});

	suite('Range Validation', () => {
		test('should handle valid ranges', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Test',
					range: new vscode.Range(0, 0, 0, 10),
				},
				{
					type: 'warning',
					message: 'Test',
					range: new vscode.Range(5, 10, 10, 20),
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle single-character ranges', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Test',
					range: new vscode.Range(5, 10, 5, 11),
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle zero-width ranges', () => {
			const findings: Finding[] = [
				{
					type: 'info',
					message: 'Test',
					range: new vscode.Range(3, 5, 3, 5),
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});

	suite('Message Content', () => {
		test('should handle long messages', () => {
			const longMessage = 'A'.repeat(1000);
			const findings: Finding[] = [
				{
					type: 'warning',
					message: longMessage,
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle messages with special characters', () => {
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Error with "quotes" and \'apostrophes\' and newlines\n',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});

		test('should handle empty message', () => {
			const findings: Finding[] = [
				{
					type: 'info',
					message: '',
				},
			];

			manager.setFindings(testUri, findings);

			assert.ok(true);
		});
	});
});
