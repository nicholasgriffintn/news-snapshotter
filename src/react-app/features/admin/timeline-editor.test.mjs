import assert from "node:assert/strict";
import test from "node:test";

import { addTimelineElement, defaultTimelineSite, removeTimelineElement } from "./timeline-editor.ts";

test("adds unique timeline content up to the ten-item limit", () => {
	assert.deepEqual(addTimelineElement(["one"], "two"), ["one", "two"]);
	assert.deepEqual(addTimelineElement(["one", "two"], "two"), ["one", "two"]);
	const full = Array.from({ length: 10 }, (_, index) => `item-${index}`);
	assert.deepEqual(addTimelineElement(full, "overflow"), full);
});

test("chooses an indexed initial site or falls back to the first available site", () => {
	assert.equal(defaultTimelineSite(["bbc-news", "guardian-uk"], "guardian-uk"), "guardian-uk");
	assert.equal(defaultTimelineSite(["bbc-news", "guardian-uk"], "missing"), "bbc-news");
	assert.equal(defaultTimelineSite([], "bbc-news"), "");
});

test("removes selected timeline content without reordering the rest", () => {
	assert.deepEqual(removeTimelineElement(["one", "two", "three"], "two"), ["one", "three"]);
});
