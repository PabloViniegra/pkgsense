import fetch from 'node-fetch';
import { type Result, failure, success } from '../shared/result';

export interface BundlephobiaInfo {
	size: number;
	gzip: number;
}

interface BundlephobiaResponse {
	size?: number;
	gzip?: number;
}

function isBundlephobiaResponse(data: unknown): data is BundlephobiaResponse {
	return (
		typeof data === 'object' &&
		data !== null &&
		('size' in data || 'gzip' in data)
	);
}

export async function fetchBundlephobia(
	name: string,
	version: string,
): Promise<Result<BundlephobiaInfo, string>> {
	const v = (version || '').toString().replace(/^[^0-9]*/, '') || 'latest';
	const pkg = encodeURIComponent(`${name}@${v}`);
	const url = `https://bundlephobia.com/api/size?package=${pkg}`;

	try {
		const res = await fetch(url);
		if (!res.ok) {
			return failure(
				`HTTP ${res.status}: ${res.statusText} for package ${name}@${v}`,
			);
		}

		const json: unknown = await res.json();

		if (!isBundlephobiaResponse(json)) {
			return failure(`Invalid response format from Bundlephobia for ${name}`);
		}

		return success({
			size: json.size || 0,
			gzip: json.gzip || 0,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		return failure(
			`Error fetching bundlephobia data for ${name}: ${errorMessage}`,
		);
	}
}
