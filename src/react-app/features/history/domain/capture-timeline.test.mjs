import assert from "node:assert/strict";
import test from "node:test";

import { captureTimelinePosition } from "./capture-timeline.ts";

const captures = [
	{ captureId: "newest", capturedAt: "2026-07-19T18:30:00.000Z" },
	{ captureId: "selected", capturedAt: "2026-07-19T18:00:00.000Z" },
	{ captureId: "oldest", capturedAt: "2026-07-19T17:30:00.000Z" },
];

test("moves left towards newer captures and right towards older captures", () => {
	const position = captureTimelinePosition(captures, "selected");

	assert.equal(position.newer?.captureId, "newest");
	assert.equal(position.older?.captureId, "oldest");
	assert.equal(position.selectedIndex, 1);
});

test("disables time-direction navigation at the loaded timeline edges", () => {
	assert.equal(captureTimelinePosition(captures, "newest").newer, undefined);
	assert.equal(captureTimelinePosition(captures, "oldest").older, undefined);
});

test("does not present the newest capture as an explicitly selected unloaded capture", () => {
	const position = captureTimelinePosition(captures, "earlier-not-loaded");

	assert.equal(position.selectedIndex, -1);
	assert.equal(position.selected, undefined);
	assert.equal(position.newer, undefined);
	assert.equal(position.older, undefined);
});
