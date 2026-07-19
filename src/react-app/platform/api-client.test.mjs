import assert from "node:assert/strict";
import test from "node:test";

import {
	clearCaptureFailures,
	clearHistoryExtractionFailures,
	fetchAvailableHistorySites,
	fetchCatalogue,
	fetchElementHistory,
	fetchHistoryCapture,
	fetchHistoryChanges,
	fetchHistoryExtractionFailures,
	fetchHistoryFailures,
	fetchHistoryImages,
	fetchHistorySites,
	fetchSnapshots,
	searchHistory,
} from "./api-client.ts";

test("loads every change page for one capture timestamp", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	const controller = new AbortController();
	globalThis.fetch = async (input, init) => {
		requests.push({ signal: init?.signal, url: String(input) });
		return String(input).includes("cursor=next%2Fpage")
			? Response.json({ changes: [{ changeId: "change-2" }] })
			: Response.json({ changes: [{ changeId: "change-1" }], cursor: "next/page" });
	};

	try {
		assert.deepEqual(
			await fetchHistoryChanges("express-news", "2026-07-19T20:10:43.651Z", {
				signal: controller.signal,
			}),
			[{ changeId: "change-1" }, { changeId: "change-2" }],
		);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, [
		{
			signal: undefined,
			url: "/api/history/express-news/changes?from=2026-07-19T20%3A10%3A43.651Z&limit=100&to=2026-07-19T20%3A10%3A43.651Z",
		},
		{
			signal: undefined,
			url: "/api/history/express-news/changes?from=2026-07-19T20%3A10%3A43.651Z&limit=100&to=2026-07-19T20%3A10%3A43.651Z&cursor=next%2Fpage",
		},
	]);
});

test("clears every capture-failure batch and site-scoped extraction failures", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input, init) => {
		requests.push({ headers: init?.headers, method: init?.method, url: String(input) });
		if (String(input) === "/api/admin/failures") {
			return Response.json({ cleared: 100, cursor: "next-page", hasMore: true });
		}
		if (String(input) === "/api/admin/failures?cursor=next-page") {
			return Response.json({ cleared: 12, hasMore: false });
		}
		return Response.json({ cleared: 3 });
	};

	try {
		assert.equal(await clearCaptureFailures("secret"), 112);
		assert.equal(await clearHistoryExtractionFailures("secret", "bbc-home"), 3);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, [
		{
			headers: { authorization: "Bearer secret" },
			method: "DELETE",
			url: "/api/admin/failures",
		},
		{
			headers: { authorization: "Bearer secret" },
			method: "DELETE",
			url: "/api/admin/failures?cursor=next-page",
		},
		{
			headers: { authorization: "Bearer secret" },
			method: "DELETE",
			url: "/api/admin/history/extraction-failures?site=bbc-home",
		},
	]);
});

test("loads private extraction failures for one site", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input, init) => {
		requests.push({ headers: init?.headers, url: String(input) });
		return Response.json({ cursor: "older", failures: [{ failureId: 1 }] });
	};

	try {
		assert.deepEqual(
			await fetchHistoryExtractionFailures("secret", {
				cursor: "next/page",
				site: "bbc-home",
			}),
			{ cursor: "older", failures: [{ failureId: 1 }] },
		);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, [
		{
			headers: { authorization: "Bearer secret" },
			url: "/api/admin/history/extraction-failures?limit=50&cursor=next%2Fpage&site=bbc-home",
		},
	]);
});

test("preserves the history failure continuation cursor", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		return Response.json({ cursor: "older-failures", failures: [{ stage: "validation" }] });
	};

	try {
		assert.deepEqual(await fetchHistoryFailures("bbc-home"), {
			cursor: "older-failures",
			failures: [{ stage: "validation" }],
		});
	} finally {
		globalThis.fetch = originalFetch;
	}
});

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

test("requests only the selected screenshot storage dates", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (input) => {
		requests.push(String(input));
		return Response.json({ screenshots: [] });
	};

	try {
		assert.deepEqual(await fetchSnapshots(["2026-07-18", "2026-07-19"]), []);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(requests, ["/api/screenshots?date=2026-07-18&date=2026-07-19"]);
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
