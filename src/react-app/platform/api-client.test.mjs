import assert from "node:assert/strict";
import test from "node:test";

import {
	fetchAvailableHistorySites,
	fetchCatalogue,
	fetchElementHistory,
	fetchHistoryCapture,
	fetchHistoryImages,
	fetchHistorySites,
	fetchSnapshots,
	searchHistory,
} from "./api-client.ts";

test("preserves research pagination cursors", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input) => {
		const url = String(input);
		requests.push(url);
		return url.startsWith("/api/history/search?")
			? Response.json({ cursor: "next-search", results: [{ elementKey: "story-2" }] })
			: Response.json({ cursor: "next-image", images: [{ imageId: "image-2" }] });
	};

	try {
		assert.deepEqual(
			await searchHistory({ query: "Burnham", site: "bbc-home" }, { cursor: "search/page-2" }),
			{ cursor: "next-search", results: [{ elementKey: "story-2" }] },
		);
		assert.deepEqual(await fetchHistoryImages("bbc-home", "2026-07", { cursor: "image/page-2" }), {
			cursor: "next-image",
			images: [{ imageId: "image-2" }],
		});
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, [
		"/api/history/search?limit=100&q=Burnham&site=bbc-home&cursor=search%2Fpage-2",
		"/api/history/bbc-home/images?limit=100&month=2026-07&cursor=image%2Fpage-2",
	]);
});

test("continues content history from the supplied cursor", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input) => {
		requests.push(String(input));
		return Response.json({ cursor: "following-page", observations: [] });
	};

	try {
		assert.deepEqual(
			await fetchElementHistory("bbc-home", "https://www.bbc.co.uk/news/story", {
				cursor: "older/capture",
			}),
			{ cursor: "following-page", observations: [] },
		);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, [
		"/api/history/bbc-home/content/https%3A%2F%2Fwww.bbc.co.uk%2Fnews%2Fstory?limit=100&cursor=older%2Fcapture",
	]);
});

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
