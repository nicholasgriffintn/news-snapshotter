import assert from "node:assert/strict";
import test from "node:test";

import { listScreenshots, serveScreenshot } from "./snapshots.ts";

function object(key, metadata = {}) {
	return {
		customMetadata: metadata,
		key,
	};
}

const newerMetadata = {
	brand: "bbc",
	capturedAt: "2026-07-16T11:00:00.000Z",
	category: "news",
	device: "mobile",
	name: "bbc-home",
	triggeredAt: "2026-07-16T09:30:00.000Z",
	url: "https://bbc.co.uk",
};

const olderMetadata = {
	brand: "sky",
	capturedAt: "2026-07-16T10:00:00.000Z",
	category: "sport",
	name: "sky-sports",
	triggeredAt: "2026-07-16T09:30:00.000Z",
	url: "https://skysports.com",
};

test("lists valid full screenshots newest first with image URLs", async () => {
	const bucket = {
		list: async () => ({
			objects: [
				object("brand=sky/category=sport/date=2026-07-16/sky-desktop.png", olderMetadata),
				object("brand=bbc/category=news/date=2026-07-16/bbc-mobile.png", newerMetadata),
			],
			truncated: false,
		}),
	};

	const result = await listScreenshots(bucket, new Map([["bbc-home", "BBC"]]));

	assert.deepEqual(
		result.screenshots.map(({ brand }) => brand),
		["bbc", "sky"],
	);
	assert.equal(result.screenshots[0].device, "mobile");
	assert.equal(result.screenshots[0].displayName, "BBC");
	assert.equal(result.screenshots[0].triggeredAt, newerMetadata.triggeredAt);
	assert.equal(result.screenshots[1].triggeredAt, olderMetadata.triggeredAt);
	assert.match(result.screenshots[0].fullImageUrl, /\/api\/screenshots\/image\?key=/);
	assert.match(result.screenshots[0].thumbnailUrl, /-thumbnail\.jpg/);
	assert.equal(result.truncated, false);
});

test("ignores thumbnails, unsupported files, and incomplete metadata", async () => {
	const bucket = {
		list: async () => ({
			objects: [
				object("capture-thumbnail.jpg", newerMetadata),
				object("capture.pdf", newerMetadata),
				object("capture.png", { ...newerMetadata, url: undefined }),
				object("missing-trigger.png", { ...newerMetadata, triggeredAt: undefined }),
			],
			truncated: false,
		}),
	};

	assert.deepEqual((await listScreenshots(bucket)).screenshots, []);
});

test("excludes admin diagnostic captures from the public archive", async () => {
	const bucket = {
		list: async () => ({
			objects: [object("amiabot.png", { ...newerMetadata, visibility: "admin" })],
			truncated: false,
		}),
	};

	assert.deepEqual((await listScreenshots(bucket)).screenshots, []);
});

test("follows paginated bucket listings", async () => {
	const cursors = [];
	const bucket = {
		list: async ({ cursor }) => {
			cursors.push(cursor);
			return cursor
				? { objects: [object("second.png", newerMetadata)], truncated: false }
				: { cursor: "next", objects: [object("first.png", olderMetadata)], truncated: true };
		},
	};

	const result = await listScreenshots(bucket);

	assert.deepEqual(cursors, [undefined, "next"]);
	assert.equal(result.screenshots.length, 2);
});

test("rejects missing and unsafe screenshot keys", async () => {
	const env = { SCREENSHOTS: { get: async () => null } };
	const missing = await serveScreenshot(
		new Request("https://archive.example/api/screenshots/image"),
		env,
	);
	const unsafe = await serveScreenshot(
		new Request("https://archive.example/api/screenshots/image?key=../../secret"),
		env,
	);

	assert.equal(missing.status, 400);
	assert.equal(unsafe.status, 400);
});

test("returns 404 when a valid screenshot key does not exist", async () => {
	const env = { SCREENSHOTS: { get: async () => null } };
	const key = "brand=bbc/category=news/date=2026-07-16/bbc-desktop-2026-07-16T10-20-30-123Z.png";
	const response = await serveScreenshot(
		new Request(`https://archive.example/api/screenshots/image?key=${encodeURIComponent(key)}`),
		env,
	);

	assert.equal(response.status, 404);
});

test("serves stored screenshots with content, cache, and entity headers", async () => {
	const env = {
		SCREENSHOTS: {
			get: async () => ({
				body: "image bytes",
				httpEtag: "etag-value",
				writeHttpMetadata: (headers) => headers.set("content-type", "image/png"),
			}),
		},
	};
	const key = "brand=bbc/category=news/date=2026-07-16/bbc-desktop-2026-07-16T10-20-30-123Z.png";

	const response = await serveScreenshot(
		new Request(`https://archive.example/api/screenshots/image?key=${encodeURIComponent(key)}`),
		env,
	);

	assert.equal(response.status, 200);
	assert.equal(await response.text(), "image bytes");
	assert.equal(response.headers.get("content-type"), "image/png");
	assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
	assert.equal(response.headers.get("etag"), "etag-value");
});
