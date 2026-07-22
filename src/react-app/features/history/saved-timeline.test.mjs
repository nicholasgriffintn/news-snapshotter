import assert from "node:assert/strict";
import test from "node:test";

import {
	groupSavedTimelineObservations,
	savedTimelinePath,
	savedTimelinesPath,
} from "./saved-timeline.ts";

test("builds encoded public timeline paths", () => {
	assert.equal(savedTimelinesPath("bbc home"), "/history/bbc%20home/timelines");
	assert.equal(
		savedTimelinePath("bbc home", "Election / markets"),
		"/history/bbc%20home/timelines/Election%20%2F%20markets",
	);
});

test("groups observations in the editor-selected content order", () => {
	const groups = groupSavedTimelineObservations([
		{ captureId: "later", capturedAt: "2026-07-17T10:00:00.000Z", elementKey: "second", kind: "story", position: 1 },
		{ captureId: "first-a", capturedAt: "2026-07-17T09:00:00.000Z", elementKey: "first", kind: "story", position: 0 },
		{ captureId: "first-b", capturedAt: "2026-07-17T10:00:00.000Z", elementKey: "first", kind: "story", position: 0 },
	]);

	assert.deepEqual(
		groups.map(({ elementKey, observations }) => [
			elementKey,
			observations.map(({ captureId }) => captureId),
		]),
		[
			["first", ["first-a", "first-b"]],
			["second", ["later"]],
		],
	);
});
