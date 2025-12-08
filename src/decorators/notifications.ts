import * as vscode from 'vscode';
import { FINDING_TAGS, type Finding } from '../types';

/**
 * Manages notifications for critical findings in package.json analysis.
 *
 * This class displays VS Code notifications for critical issues that
 * require immediate user attention, such as security vulnerabilities.
 *
 * @example
 * ```typescript
 * const notifier = new NotificationManager();
 * notifier.notifyFindings(findings);
 * ```
 */
export class NotificationManager {
	private notifiedVulnerabilities = new Set<string>();

	/**
	 * Process findings and show notifications for critical issues.
	 * Only shows notifications for critical security vulnerabilities
	 * that haven't been notified before in this session.
	 *
	 * @param findings - Array of findings from analyzers
	 */
	notifyFindings(findings: Finding[]): void {
		const criticalVulnerabilities =
			this.filterCriticalVulnerabilities(findings);

		for (const finding of criticalVulnerabilities) {
			this.showVulnerabilityNotification(finding);
		}
	}

	/**
	 * Filter findings to get only critical security vulnerabilities.
	 * Pure function - no side effects.
	 */
	private filterCriticalVulnerabilities(findings: Finding[]): Finding[] {
		return findings.filter(
			(f) =>
				f.type === 'error' &&
				f.tags?.includes(FINDING_TAGS.SECURITY) &&
				f.dependency,
		);
	}

	/**
	 * Show a notification for a critical vulnerability.
	 * Prevents duplicate notifications for the same vulnerability.
	 */
	private showVulnerabilityNotification(finding: Finding): void {
		if (!finding.dependency) return;

		// Prevent duplicate notifications in the same session
		const key = `${finding.dependency}:${finding.message}`;
		if (this.notifiedVulnerabilities.has(key)) return;

		this.notifiedVulnerabilities.add(key);

		// Extract vulnerability details
		const packageName = finding.dependency;
		const message = finding.message;

		vscode.window
			.showErrorMessage(
				`Critical Vulnerability: ${packageName}`,
				'View Details',
				'Dismiss',
			)
			.then((action) => {
				if (action === 'View Details') {
					this.showVulnerabilityDetails(packageName, message);
				}
			});
	}

	/**
	 * Show detailed information about a vulnerability.
	 */
	private showVulnerabilityDetails(packageName: string, message: string): void {
		vscode.window
			.showInformationMessage(`${packageName}: ${message}`, 'Open npm Page')
			.then((action) => {
				if (action === 'Open npm Page') {
					const url = `https://www.npmjs.com/package/${packageName}`;
					vscode.env.openExternal(vscode.Uri.parse(url));
				}
			});
	}

	/**
	 * Clear all notification tracking.
	 * Useful for testing or when starting a new analysis session.
	 */
	clearNotificationHistory(): void {
		this.notifiedVulnerabilities.clear();
	}
}
