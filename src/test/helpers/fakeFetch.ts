import nodeFetch = require('node-fetch');
import * as sinon from 'sinon';

export interface FakeResponse {
	readonly status?: number;
	readonly body: unknown;
}

export interface FakeFetch {
	/** URLs requested so far, in order */
	readonly requested: string[];
}

/**
 * Replaces node-fetch with canned responses keyed by URL; an Error value
 * makes the request fail. Undo with sinon.restore().
 *
 * nock cannot be used here: the extension host hands extensions its own
 * wrapped http/https modules, so nock's interceptors never see the request.
 */
export function stubFetch(
	routes: Readonly<Record<string, FakeResponse | Error>>,
): FakeFetch {
	const requested: string[] = [];

	sinon.stub(nodeFetch, 'default').callsFake(async (url) => {
		const key = String(url);
		requested.push(key);

		const route = routes[key];
		if (!route) {
			throw new Error(`Unexpected request to ${key}`);
		}
		if (route instanceof Error) {
			throw route;
		}

		return new nodeFetch.Response(JSON.stringify(route.body), {
			status: route.status ?? 200,
		});
	});

	return { requested };
}
