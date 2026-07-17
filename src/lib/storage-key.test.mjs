import assert from "node:assert/strict";
import test from "node:test";

import { safeSegment, screenshotKey, thumbnailKey } from "./storage-key.ts";

const site = {
	brand: "BBC News!",
	category: "news",
	name: "UK & World",
	url: "https://bbc.co.uk/news",
};

test("normalises unsafe storage-key segments", () => {
	assert.equal(safeSegment("  BBC News & Sport!  "), "bbc-news-sport");
	assert.equal(safeSegment("Already-safe"), "already-safe");
});

test("partitions screenshot keys by brand, category, and date", () => {
	assert.equal(
		screenshotKey(site, "2026-07-16T10:20:30.123Z", "mobile", "webp"),
		"brand=bbc-news/category=news/date=2026-07-16/uk-world-mobile-2026-07-16T10-20-30-123Z.webp",
	);
});

test("derives JPEG thumbnail keys for every supported source format", () => {
	assert.equal(thumbnailKey("capture.png"), "capture-thumbnail.jpg");
	assert.equal(thumbnailKey("capture.jpeg"), "capture-thumbnail.jpg");
	assert.equal(thumbnailKey("capture.webp"), "capture-thumbnail.jpg");
});
