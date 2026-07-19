import assert from "node:assert/strict";
import test from "node:test";

import {
	fetchAvailableHistorySites,
	fetchCatalogue,
	fetchHistoryCapture,
	fetchHistorySites,
	fetchSnapshots,
} from "./api-client.ts";

test("caller cancellation does not abort or duplicate a shared public GET", async () => {
	const originalFetch = globalThis.fetch;
	const firstController = new AbortController();
	const secondController = new AbortController();
	const requests = [];
	globalThis.fetch = (input, init) => {
		return new Promise((resolve, reject) => {
			requests.push({ init, resolve, url: String(input) });
			init?.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
		});
	};

	try {
		const first = fetchHistoryCapture("bbc-home", "capture/one", {
			signal: firstController.signal,
		});
		const second = fetchHistoryCapture("bbc-home", "capture/one", {
			signal: secondController.signal,
		});
		firstController.abort();

		await assert.rejects(first, { name: "AbortError" });
		assert.equal(requests.length, 1);
		assert.equal(requests[0].init?.signal, undefined);
		requests[0].resolve(Response.json({ capture: {}, elements: [] }));
		assert.deepEqual(await second, { capture: {}, elements: [] });
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("loads the lightweight history availability contract", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input) => {
		requests.push(String(input));
		return Response.json({ sites: ["bbc-home", "guardian"] });
	};

	try {
		assert.deepEqual(await fetchAvailableHistorySites(), ["bbc-home", "guardian"]);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, ["/api/history/sites/available"]);
});

test("coalesces every duplicate public GET while it is in flight", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	const pending = [];
	globalThis.fetch = (input) => {
		const url = String(input);
		requests.push(url);
		return new Promise((resolve) => pending.push({ resolve, url }));
	};

	try {
		const results = Promise.all([
			fetchSnapshots(),
			fetchSnapshots(),
			fetchAvailableHistorySites(),
			fetchAvailableHistorySites(),
			fetchCatalogue(),
			fetchCatalogue(),
			fetchHistorySites(),
			fetchHistorySites(),
		]);

		assert.deepEqual(requests, [
			"/api/screenshots",
			"/api/history/sites/available",
			"/api/catalogue",
			"/api/history/sites",
		]);
		for (const request of pending) {
			request.resolve(
				request.url === "/api/screenshots"
					? Response.json({ screenshots: [] })
					: Response.json({ sites: request.url === "/api/catalogue" ? [] : ["bbc-home"] }),
			);
		}
		assert.equal((await results).length, 8);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
