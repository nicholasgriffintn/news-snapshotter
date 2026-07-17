import assert from "node:assert/strict";
import test from "node:test";

import { captureWindowKey, displayName, groupLabel, timeLabel } from "./format.ts";

test("turns storage identifiers into display names", () => {
	assert.equal(displayName("belfast-telegraph"), "Belfast Telegraph");
	assert.equal(displayName("bbc"), "Bbc");
});

test("formats capture times using the local 24-hour clock", () => {
	const capturedAt = new Date(2026, 6, 16, 9, 5).toISOString();
	assert.match(timeLabel(capturedAt), /09:05/);
});

test("labels historical capture groups with a full date and time", () => {
	const capturedAt = new Date(2020, 0, 2, 9, 5).toISOString();
	assert.match(groupLabel(capturedAt), /Thursday, 2 January 2020/);
	assert.match(groupLabel(capturedAt), /09:05–09:10/);
});

test("groups captures from the same five-minute window", () => {
	assert.equal(
		captureWindowKey("2026-07-16T09:00:00.000Z"),
		captureWindowKey("2026-07-16T09:04:59.999Z"),
	);
});

test("starts a new group at each five-minute boundary", () => {
	assert.notEqual(
		captureWindowKey("2026-07-16T09:04:59.999Z"),
		captureWindowKey("2026-07-16T09:05:00.000Z"),
	);
	assert.equal(captureWindowKey("2026-07-16T09:07:42.123Z"), "2026-07-16T09:05:00.000Z");
});
