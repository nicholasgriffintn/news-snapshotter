import assert from "node:assert/strict";
import test from "node:test";

import { listCaptureFailures, storeCaptureFailure } from "./capture-failures.ts";

const failure = {
	capturedAt: "2026-07-16T10:20:30.123Z",
	device: "mobile",
	message: "x".repeat(600),
	reason: "captcha",
	triggeredAt: "2026-07-16T10:00:00.000Z",
	site: {
		brand: "bbc",
		category: "news",
		name: "BBC Home",
		url: "https://bbc.co.uk",
	},
};

test("stores a partitioned, expiring failure record with bounded messages", async () => {
	const writes = [];
	const env = { CAPTURE_FAILURES: { put: async (...args) => writes.push(args) } };

	const key = await storeCaptureFailure(env, failure);

	assert.equal(key, "failures/date=2026-07-16/2026-07-16T10-20-30-123Z-bbc-home-mobile.json");
	assert.equal(writes.length, 1);
	const [storedKey, value, options] = writes[0];
	assert.equal(storedKey, key);
	assert.equal(JSON.parse(value).message.length, 500);
	assert.equal(JSON.parse(value).triggeredAt, failure.triggeredAt);
	assert.equal(options.expirationTtl, 90 * 24 * 60 * 60);
	assert.deepEqual(options.metadata, { brand: "bbc", device: "mobile", reason: "captcha" });
});

test("returns undefined when KV persistence fails", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const env = {
		CAPTURE_FAILURES: {
			put: async () => Promise.reject(new Error("KV unavailable")),
		},
	};

	assert.equal(await storeCaptureFailure(env, failure), undefined);
});

test("lists valid failures newest first and ignores corrupt KV values", async () => {
	const records = new Map([
		[
			"older",
			JSON.stringify({
				brand: "bbc",
				capturedAt: "2026-07-16T10:00:00.000Z",
				category: "news",
				device: "desktop",
				message: "Older failure",
				name: "bbc-home",
				reason: "http-error",
				storedAt: "2026-07-16T10:00:01.000Z",
				triggeredAt: "2026-07-16T09:55:00.000Z",
				url: "https://bbc.co.uk",
			}),
		],
		[
			"newer",
			JSON.stringify({
				brand: "sky",
				capturedAt: "2026-07-16T11:00:00.000Z",
				category: "news",
				device: "mobile",
				message: "Newer failure",
				name: "sky-home",
				reason: "captcha",
				storedAt: "2026-07-16T11:00:01.000Z",
				triggeredAt: "2026-07-16T10:55:00.000Z",
				url: "https://news.sky.com",
			}),
		],
		["corrupt", "{nope"],
	]);
	const env = {
		CAPTURE_FAILURES: {
			get: async (key) => records.get(key),
			list: async () => ({
				keys: [...records.keys()].map((name) => ({ name })),
				list_complete: true,
			}),
		},
	};

	const result = await listCaptureFailures(env, { limit: 50 });

	assert.deepEqual(
		result.failures.map(({ name }) => name),
		["sky-home", "bbc-home"],
	);
	assert.equal(result.hasMore, false);
	assert.equal(result.cursor, undefined);
});
