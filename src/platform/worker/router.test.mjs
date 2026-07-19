import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "./router.ts";

function environment(overrides = {}) {
	return {
		API_KEY: "secret",
		NEWS_SNAPSHOTTER: {
			create: async () => ({ id: "workflow-123", status: async () => ({ status: "queued" }) }),
			get: async () => ({ status: async () => ({ status: "running" }) }),
		},
		SCREENSHOTS: {
			list: async () => ({ objects: [], truncated: false }),
		},
		...overrides,
	};
}

function apiRequest(path, init = {}) {
	return new Request(`https://archive.example${path}`, init);
}

test("serves the public site catalogue without authentication", async () => {
	const response = await handleRequest(apiRequest("/api/catalogue"), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.sites.length > 0);
	assert.equal(body.sites.find(({ name }) => name === "bbc-home").displayName, "BBC");
	assert.deepEqual(Object.keys(body.sites[0]).sort(), [
		"brand",
		"captureRegion",
		"category",
		"displayName",
		"name",
		"priority",
		"provider",
	]);
	assert.ok(
		body.sites.every((site) => {
			return [1, 2, 3, 4].includes(site.priority);
		}),
	);
	assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
	assert.equal(
		response.headers.get("cloudflare-cdn-cache-control"),
		"max-age=86400, stale-while-revalidate=604800",
	);
});

test("lists the supported capture providers", async () => {
	const response = await handleRequest(apiRequest("/api/capture-providers"), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body.providers, ["cloudflare", "hyperbrowser"]);
});

test("serves the public screenshot listing", async () => {
	const listOptions = [];
	const response = await handleRequest(
		apiRequest("/api/screenshots?date=2026-07-19"),
		environment({
			SCREENSHOTS: {
				list: async (options) => {
					listOptions.push(options);
					return { objects: [], truncated: false };
				},
			},
		}),
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body, { screenshots: [], truncated: false });
	assert.equal(response.headers.get("cache-control"), "public, max-age=60");
	assert.equal(
		response.headers.get("cloudflare-cdn-cache-control"),
		"max-age=300, stale-while-revalidate=3600",
	);
	assert.ok(listOptions.length > 0);
	assert.ok(listOptions.every(({ prefix }) => prefix.includes("date=2026-07-19/")));
});

test("rejects invalid screenshot storage dates", async () => {
	const response = await handleRequest(
		apiRequest("/api/screenshots?date=2026-02-30"),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "date parameters must be valid dates");
});

test("caches the lightweight public history availability response", async () => {
	const response = await handleRequest(
		apiRequest("/api/history/sites/available"),
		environment({
			HISTORY_DB: {
				prepare: () => ({
					all: async () => ({ results: [{ site: "bbc-home" }] }),
				}),
			},
		}),
	);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { sites: ["bbc-home"] });
	assert.equal(response.headers.get("cache-control"), "public, max-age=60");
	assert.equal(
		response.headers.get("cloudflare-cdn-cache-control"),
		"max-age=300, stale-while-revalidate=3600",
	);
});

test("does not expose unexpected infrastructure failures", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/screenshots"),
		environment({
			SCREENSHOTS: {
				list: async () => {
					throw new Error("private R2 failure details");
				},
			},
		}),
	);

	assert.equal(response.status, 500);
	assert.equal(response.headers.get("cache-control"), null);
	assert.deepEqual(await response.json(), {
		message: "Internal server error",
		status: "error",
	});
});

test("lists the supported capture profiles", async () => {
	const response = await handleRequest(apiRequest("/api/capture-profiles"), environment());
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.ok(body.profiles.includes("default"));
	assert.ok(body.profiles.includes("bbc"));
});

test("reports unavailable public history storage without requiring authentication", async () => {
	const response = await handleRequest(
		apiRequest("/api/history/bbc-home/captures"),
		environment({ HISTORY_DB: undefined }),
	);

	assert.equal(response.status, 503);
	assert.equal((await response.json()).message, "History storage is not configured");
});

test("protects bot checks with the configured API key", async () => {
	const response = await handleRequest(
		apiRequest("/api/admin/bot-checks", {
			body: JSON.stringify({ profile: "default" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 401);
});

test("rejects unknown bot-check profiles before opening a browser", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/admin/bot-checks", {
			body: JSON.stringify({ profile: "untrusted" }),
			headers: { authorization: "Bearer secret", "content-type": "application/json" },
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "Choose a valid capture profile");
});

test("protects workflow routes with the configured API key", async () => {
	const response = await handleRequest(
		apiRequest("/api/workflows", { method: "POST" }),
		environment(),
	);

	assert.equal(response.status, 401);
	assert.equal((await response.json()).message, "Invalid API key");
	assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("protects capture failures with the configured API key", async () => {
	const response = await handleRequest(apiRequest("/api/admin/failures"), environment());
	const clearResponse = await handleRequest(
		apiRequest("/api/admin/failures", { method: "DELETE" }),
		environment(),
	);

	assert.equal(response.status, 401);
	assert.equal((await response.json()).message, "Invalid API key");
	assert.equal(clearResponse.status, 401);
	assert.equal((await clearResponse.json()).message, "Invalid API key");
});

test("protects history administration with the configured API key", async () => {
	const response = await handleRequest(apiRequest("/api/admin/history/status"), environment());
	const clearResponse = await handleRequest(
		apiRequest("/api/admin/history/extraction-failures", { method: "DELETE" }),
		environment(),
	);

	assert.equal(response.status, 401);
	assert.equal((await response.json()).message, "Invalid API key");
	assert.equal(clearResponse.status, 401);
	assert.equal((await clearResponse.json()).message, "Invalid API key");
});

test("lists bounded capture failures for admins", async () => {
	const listCalls = [];
	const record = {
		brand: "bbc",
		capturedAt: "2026-07-16T10:20:30.123Z",
		category: "news",
		device: "desktop",
		message: "Navigation returned HTTP 503",
		name: "bbc-home",
		reason: "http-error",
		storedAt: "2026-07-16T10:20:31.123Z",
		triggeredAt: "2026-07-16T10:00:00.000Z",
		url: "https://www.bbc.co.uk/",
	};
	const response = await handleRequest(
		apiRequest("/api/admin/failures?limit=25&cursor=next-page", {
			headers: { authorization: "Bearer secret" },
		}),
		environment({
			CAPTURE_FAILURES: {
				get: async () => JSON.stringify(record),
				list: async (options) => {
					listCalls.push(options);
					return {
						cursor: "final-page",
						keys: [{ name: "failures/date=2026-07-16/failure.json" }],
						list_complete: false,
					};
				},
			},
		}),
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(listCalls, [{ cursor: "next-page", limit: 25, prefix: "failures/" }]);
	assert.deepEqual(body.failures, [record]);
	assert.equal(body.cursor, "final-page");
	assert.equal(body.hasMore, true);
});

test("clears a bounded capture-failure batch for admins", async () => {
	const deleted = [];
	const response = await handleRequest(
		apiRequest("/api/admin/failures", {
			headers: { authorization: "Bearer secret" },
			method: "DELETE",
		}),
		environment({
			CAPTURE_FAILURES: {
				delete: async (key) => deleted.push(key),
				list: async () => ({
					keys: [{ name: "failures/a.json" }, { name: "failures/b.json" }],
					list_complete: true,
				}),
			},
		}),
	);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { cleared: 2, hasMore: false });
	assert.deepEqual(deleted, ["failures/a.json", "failures/b.json"]);
});

test("rejects an oversized extraction-failure clear scope", async () => {
	const response = await handleRequest(
		apiRequest(`/api/admin/history/extraction-failures?site=${"x".repeat(201)}`, {
			headers: { authorization: "Bearer secret" },
			method: "DELETE",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "site is invalid");
});

test("rejects invalid failure list pagination", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/admin/failures?limit=500", {
			headers: { authorization: "Bearer secret" },
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "limit must be between 1 and 100");
});

test("starts a workflow for a valid named site selection", async () => {
	const creations = [];
	const env = environment({
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);
				return { id: "workflow-123", status: async () => ({ status: "queued" }) };
			},
		},
	});
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({ name: "bbc-home" }),
			headers: { authorization: "Bearer secret", "content-type": "application/json" },
			method: "POST",
		}),
		env,
	);
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.equal(body.workflowId, "workflow-123");
	assert.deepEqual(body.workflowIds, ["workflow-123"]);
	assert.equal(body.runnerCount, 1);
	assert.equal(creations[0].params.sites.length, 1);
	assert.equal(creations[0].params.sites[0].name, "bbc-home");
});

test("overrides the profile provider for an admin capture", async () => {
	const creations = [];
	const env = environment({
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);

				return {
					id: "workflow-123",
					status: async () => ({
						status: "queued",
					}),
				};
			},
		},
	});
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({
				name: "bbc-home",
				provider: "hyperbrowser",
			}),
			headers: {
				authorization: "Bearer secret",
				"content-type": "application/json",
			},
			method: "POST",
		}),
		env,
	);
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.equal(body.selectedSites[0].provider, "hyperbrowser");
	assert.equal(creations[0].params.sites[0].provider, "hyperbrowser");
});

test("defaults an unfiltered capture to priority one", async () => {
	const creations = [];
	const env = environment({
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);
				const id = `workflow-${creations.length}`;
				return { id, status: async () => ({ status: "queued" }) };
			},
		},
	});

	const response = await handleRequest(
		apiRequest("/api/workflows", {
			headers: { authorization: "Bearer secret" },
			method: "POST",
		}),
		env,
	);
	const body = await response.json();
	const sizes = creations.map(({ params }) => params.sites.length);

	assert.equal(response.status, 202);
	assert.ok(body.runnerCount > 0);
	assert.ok(body.runnerCount <= 6);
	assert.equal(body.workflowIds.length, body.runnerCount);
	assert.ok(
		body.selectedSites.every((site) => {
			return site.priority === 1;
		}),
	);
	assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
	assert.equal(
		sizes.reduce((total, size) => total + size, 0),
		body.selectedSites.length,
	);
	assert.equal(new Set(creations.map(({ params }) => params.triggeredAt)).size, 1);
	assert.equal(body.triggeredAt, creations[0].params.triggeredAt);
	assert.deepEqual(
		creations.map(({ params }) => params.startDelaySeconds),
		Array.from({ length: body.runnerCount }, (_, index) => index),
	);
});

test("starts a workflow for an explicit capture priority", async () => {
	const creations = [];
	const env = environment({
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);
				return {
					id: `workflow-${creations.length}`,
					status: async () => ({ status: "queued" }),
				};
			},
		},
	});
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({ priority: 4 }),
			headers: {
				authorization: "Bearer secret",
				"content-type": "application/json",
			},
			method: "POST",
		}),
		env,
	);
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.ok(body.selectedSites.length > 0);
	assert.ok(
		body.selectedSites.every((site) => {
			return site.priority === 4;
		}),
	);
	assert.ok(
		creations.every(({ params }) => {
			return params.sites.every((site) => site.priority === 4);
		}),
	);
});

test("returns workflow status by identifier", async () => {
	const response = await handleRequest(
		apiRequest("/api/workflows/workflow-123", {
			headers: { authorization: "Bearer secret" },
		}),
		environment(),
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.workflowId, "workflow-123");
	assert.deepEqual(body.workflowStatus, { status: "running" });
	assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("rejects malformed JSON without exposing parser details", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: "{",
			headers: { authorization: "Bearer secret", "content-type": "application/json" },
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "Request body must be valid JSON");
});

test("turns invalid workflow selections into a 400 response", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({ brand: "bbc", name: "bbc-home" }),
			headers: { authorization: "Bearer secret", "content-type": "application/json" },
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.match((await response.json()).message, /Specify only one/);
});

test("rejects an invalid capture priority", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({ priority: 5 }),
			headers: {
				authorization: "Bearer secret",
				"content-type": "application/json",
			},
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.match((await response.json()).message, /priority must be 1, 2, 3, or 4/);
});

test("rejects an unknown capture provider", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const response = await handleRequest(
		apiRequest("/api/workflows", {
			body: JSON.stringify({
				provider: "custom-websocket",
			}),
			headers: {
				authorization: "Bearer secret",
				"content-type": "application/json",
			},
			method: "POST",
		}),
		environment(),
	);

	assert.equal(response.status, 400);
	assert.equal((await response.json()).message, "provider must be cloudflare or hyperbrowser");
});

test("returns 404 for an unknown authorised API route", async () => {
	const response = await handleRequest(
		apiRequest("/api/missing", { headers: { authorization: "Bearer secret" } }),
		environment(),
	);

	assert.equal(response.status, 404);
});
