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

	const result = await listScreenshots(bucket, ["date=2026-07-16/"], new Map([["bbc-home", "BBC"]]));

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

	assert.deepEqual((await listScreenshots(bucket, ["date=2026-07-16/"])).screenshots, []);
});

test("excludes admin diagnostic captures from the public archive", async () => {
	const bucket = {
		list: async () => ({
			objects: [object("amiabot.png", { ...newerMetadata, visibility: "admin" })],
			truncated: false,
		}),
	};

	assert.deepEqual((await listScreenshots(bucket, ["date=2026-07-16/"])).screenshots, []);
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

	const result = await listScreenshots(bucket, ["date=2026-07-16/"]);

	assert.deepEqual(cursors, [undefined, "next"]);
	assert.equal(result.screenshots.length, 2);
});

test("lists requested date partitions instead of truncating global key order", async () => {
	const prefixes = [
		"brand=alpha/category=news/date=2026-07-19/",
		"brand=zulu/category=news/date=2026-07-19/",
	];
	const older = {
		...olderMetadata,
		brand: "alpha",
		category: "news",
		displayName: "Alpha",
		name: "old-site",
	};
	const newer = {
		...newerMetadata,
		brand: "zulu",
		displayName: "Zulu",
		name: "new-site",
	};
	const calls = [];
	const bucket = {
		list: async (options) => {
			calls.push(options);
			if (options.prefix === prefixes[0]) {
				return {
					objects: [object(`${prefixes[0]}old-site-desktop.png`, older)],
					truncated: false,
				};
			}
			if (options.prefix === prefixes[1]) {
				return {
					objects: [object(`${prefixes[1]}new-site-mobile.png`, newer)],
					truncated: false,
				};
			}
			return {
				cursor: "newer-publishers",
				objects: Array.from({ length: 2_000 }, (_, index) =>
					object(`brand=alpha/${index}.png`, older),
				),
				truncated: true,
			};
		},
	};

	const result = await listScreenshots(bucket, prefixes, new Map());

	assert.deepEqual(
		result.screenshots.map(({ name }) => name),
		["new-site", "old-site"],
	);
	assert.equal(result.truncated, false);
	assert.deepEqual(
		calls.map(({ prefix }) => prefix),
		prefixes,
	);
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

test("serves stored screenshots with immutable caching and entity headers", async () => {
	const getOptions = [];
	const env = {
		SCREENSHOTS: {
			get: async (_key, options) => {
				getOptions.push(options);
				return {
				body: "image bytes",
				httpEtag: "etag-value",
				writeHttpMetadata: (headers) => headers.set("content-type", "image/png"),
				};
			},
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
	assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
	assert.equal(response.headers.get("etag"), "etag-value");
	assert.equal(getOptions[0].onlyIf.get("if-none-match"), null);
});

test("returns not modified when the screenshot entity matches", async () => {
	const getOptions = [];
	const env = {
		SCREENSHOTS: {
			get: async (_key, options) => {
				getOptions.push(options);
				return {
					httpEtag: '"etag-value"',
					writeHttpMetadata: (headers) => headers.set("content-type", "image/png"),
				};
			},
		},
	};
	const key = "brand=bbc/category=news/date=2026-07-16/bbc-desktop-2026-07-16T10-20-30-123Z.png";
	const response = await serveScreenshot(
		new Request(`https://archive.example/api/screenshots/image?key=${encodeURIComponent(key)}`, {
			headers: { "if-none-match": '"etag-value"' },
		}),
		env,
	);

	assert.equal(response.status, 304);
	assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
	assert.equal(response.headers.get("etag"), '"etag-value"');
	assert.equal(getOptions[0].onlyIf.get("if-none-match"), '"etag-value"');
});
