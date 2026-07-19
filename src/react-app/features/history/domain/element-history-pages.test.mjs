import assert from "node:assert/strict";
import test from "node:test";

import { mergeElementHistoryPages } from "./element-history-pages.ts";

function observation(captureId, capturedAt) {
	return { captureId, capturedAt };
}

test("prepends older observations and removes a repeated page edge", () => {
	const current = {
		canonicalUrl: "https://example.com/story",
		cursor: "older-page",
		elementKey: "story-key",
		kind: "story",
		observations: [
			observation("capture-3", "2026-07-19T03:00:00.000Z"),
			observation("capture-4", "2026-07-19T04:00:00.000Z"),
		],
	};
	const older = {
		...current,
		cursor: "oldest-page",
		observations: [
			observation("capture-1", "2026-07-19T01:00:00.000Z"),
			observation("capture-2", "2026-07-19T02:00:00.000Z"),
			observation("capture-3", "2026-07-19T03:00:00.000Z"),
		],
	};

	const merged = mergeElementHistoryPages(current, older);

	assert.equal(merged.cursor, "oldest-page");
	assert.equal(merged.canonicalUrl, current.canonicalUrl);
	assert.deepEqual(
		merged.observations.map(({ captureId }) => captureId),
		["capture-1", "capture-2", "capture-3", "capture-4"],
	);
});
