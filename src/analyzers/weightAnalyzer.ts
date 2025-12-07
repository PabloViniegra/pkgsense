import type * as vscode from 'vscode';
import { CONSTANTS } from '../shared/constants';
import type { Finding } from '../types';
import { fetchBundlephobia } from '../utils/bundlephobia';

export async function weightAnalyzer(
	entries: [string, string][],
	depRanges: Record<string, vscode.Range>,
): Promise<Finding[]> {
	const findings: Finding[] = [];

	for (const [name, version] of entries) {
		const result = await fetchBundlephobia(name, version);

		if (!result.success) {
			console.warn(
				`Failed to fetch bundlephobia data for ${name}: ${result.error}`,
			);
			continue;
		}

		const { size } = result.data;

		if (size > CONSTANTS.PACKAGE_SIZE_LARGE_THRESHOLD) {
			findings.push({
				type: 'error',
				message: `Paquete MUY pesado: ${name}@${version} — ${(
					size / CONSTANTS.BYTES_TO_KB
				).toFixed(1)} KB`,
				dependency: name,
				range: depRanges[name],
				tags: ['performance'],
			});
		} else if (size > CONSTANTS.PACKAGE_SIZE_MEDIUM_THRESHOLD) {
			findings.push({
				type: 'warning',
				message: `Paquete pesado: ${name}@${version} — ${(
					size / CONSTANTS.BYTES_TO_KB
				).toFixed(1)} KB`,
				dependency: name,
				range: depRanges[name],
				tags: ['performance'],
			});
		} else if (size > CONSTANTS.PACKAGE_SIZE_SMALL_THRESHOLD) {
			findings.push({
				type: 'info',
				message: `Paquete medianamente grande: ${name}@${version}`,
				dependency: name,
				range: depRanges[name],
				tags: ['performance'],
			});
		}
	}

	return findings;
}
