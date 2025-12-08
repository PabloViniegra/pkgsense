import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { NotificationManager } from '../../decorators/notifications';
import { FINDING_TAGS } from '../../types';
import type { Finding } from '../../types';

suite('NotificationManager Test Suite', () => {
	let manager: NotificationManager;
	let showErrorMessageStub: sinon.SinonStub;
	let showInformationMessageStub: sinon.SinonStub;
	let openExternalStub: sinon.SinonStub;

	setup(() => {
		manager = new NotificationManager();
		showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
		showInformationMessageStub = sinon.stub(
			vscode.window,
			'showInformationMessage',
		);
		openExternalStub = sinon.stub(vscode.env, 'openExternal');
	});

	teardown(() => {
		sinon.restore();
	});

	suite('Critical Vulnerability Notifications', () => {
		test('should show notification for critical vulnerability', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Critical security vulnerability found',
					dependency: 'vulnerable-pkg',
					tags: [FINDING_TAGS.SECURITY],
				},
			];
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 1);
			const call = showErrorMessageStub.getCall(0);
			assert.ok(call.args[0].includes('vulnerable-pkg'));
			assert.deepStrictEqual(call.args.slice(1), ['View Details', 'Dismiss']);
		});

		test('should not notify for non-error findings', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'warning',
					message: 'Some warning',
					dependency: 'some-pkg',
					tags: [FINDING_TAGS.SECURITY],
				},
				{
					type: 'info',
					message: 'Some info',
					dependency: 'another-pkg',
					tags: [FINDING_TAGS.SECURITY],
				},
			];

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should not notify for errors without security tag', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Non-security error',
					dependency: 'some-pkg',
					tags: [FINDING_TAGS.QUALITY],
				},
			];

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should not notify for errors without dependency', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Generic error',
					tags: [FINDING_TAGS.SECURITY],
				},
			];

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should notify for multiple critical vulnerabilities', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Vulnerability 1',
					dependency: 'pkg1',
					tags: [FINDING_TAGS.SECURITY],
				},
				{
					type: 'error',
					message: 'Vulnerability 2',
					dependency: 'pkg2',
					tags: [FINDING_TAGS.SECURITY],
				},
			];
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 2);
		});
	});

	suite('Duplicate Notification Prevention', () => {
		test('should not show duplicate notification for same vulnerability', () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Critical vulnerability',
				dependency: 'vulnerable-pkg',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings([finding]);
			manager.notifyFindings([finding]);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 1);
		});

		test('should show notification after clearing history', () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Critical vulnerability',
				dependency: 'vulnerable-pkg',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings([finding]);
			manager.clearNotificationHistory();
			manager.notifyFindings([finding]);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 2);
		});

		test('should distinguish different vulnerabilities by message', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Vulnerability A',
					dependency: 'pkg',
					tags: [FINDING_TAGS.SECURITY],
				},
				{
					type: 'error',
					message: 'Vulnerability B',
					dependency: 'pkg',
					tags: [FINDING_TAGS.SECURITY],
				},
			];
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 2);
		});
	});

	suite('Notification Actions', () => {
		test('should show details when View Details is clicked', async () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Critical vulnerability found',
				dependency: 'vulnerable-pkg',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves('View Details');
			showInformationMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings([finding]);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Assert
			assert.strictEqual(showInformationMessageStub.callCount, 1);
			const call = showInformationMessageStub.getCall(0);
			assert.ok(call.args[0].includes('vulnerable-pkg'));
			assert.ok(call.args[0].includes('Critical vulnerability found'));
		});

		test('should do nothing when Dismiss is clicked', async () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Critical vulnerability',
				dependency: 'pkg',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves('Dismiss');

			// Act
			manager.notifyFindings([finding]);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Assert
			assert.strictEqual(showInformationMessageStub.callCount, 0);
		});

		test('should open npm page when Open npm Page is clicked', async () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Vulnerability',
				dependency: 'test-package',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves('View Details');
			showInformationMessageStub.resolves('Open npm Page');
			openExternalStub.resolves(true);

			// Act
			manager.notifyFindings([finding]);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Assert
			assert.strictEqual(openExternalStub.callCount, 1);
			const uri = openExternalStub.getCall(0).args[0] as vscode.Uri;
			assert.strictEqual(
				uri.toString(),
				'https://www.npmjs.com/package/test-package',
			);
		});
	});

	suite('Edge Cases', () => {
		test('should handle empty findings array', () => {
			// Arrange & Act
			manager.notifyFindings([]);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should handle findings with no tags', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Error',
					dependency: 'pkg',
				},
			];

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should handle findings with empty tags array', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Error',
					dependency: 'pkg',
					tags: [],
				},
			];

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 0);
		});

		test('should handle mixed findings correctly', () => {
			// Arrange
			const findings: Finding[] = [
				{
					type: 'error',
					message: 'Critical',
					dependency: 'pkg1',
					tags: [FINDING_TAGS.SECURITY],
				},
				{
					type: 'warning',
					message: 'Warning',
					dependency: 'pkg2',
				},
				{
					type: 'info',
					message: 'Info',
				},
			];
			showErrorMessageStub.resolves(undefined);

			// Act
			manager.notifyFindings(findings);

			// Assert
			assert.strictEqual(showErrorMessageStub.callCount, 1);
		});
	});

	suite('Clear Notification History', () => {
		test('should clear notification history', () => {
			// Arrange
			const finding: Finding = {
				type: 'error',
				message: 'Vulnerability',
				dependency: 'pkg',
				tags: [FINDING_TAGS.SECURITY],
			};
			showErrorMessageStub.resolves(undefined);
			manager.notifyFindings([finding]);

			// Act
			manager.clearNotificationHistory();

			// Assert - should be able to notify again
			manager.notifyFindings([finding]);
			assert.strictEqual(showErrorMessageStub.callCount, 2);
		});

		test('should handle clearing empty history', () => {
			// Arrange & Act & Assert
			assert.doesNotThrow(() => {
				manager.clearNotificationHistory();
			});
		});
	});
});
