import assert from "node:assert/strict";
import test from "node:test";

import { loadContentComparisonItems } from "./content-comparison.ts";
import { contentComparisonPath } from "./history-routes.ts";
import { toggleContentSelection } from "./history-selection.ts";

test("builds an ordered content comparison path", () => {
	assert.equal(
		contentComparisonPath("bbc-home", ["lead-story", "second/story"]),
		"/history/bbc-home/compare?element=lead-story&element=second%2Fstory",
	);
});

test("limits comparison selection to ten unique content keys", () => {
	const selected = new Set(Array.from({ length: 10 }, (_, index) => `story-${index + 1}`));

	assert.deepEqual(toggleContentSelection(selected, "story-11"), selected);
	assert.equal(toggleContentSelection(selected, "story-1").has("story-1"), false);
});

test("keeps valid comparison items when one selection is unavailable", async () => {
	const result = await loadContentComparisonItems(
		"bbc-home",
		["story-one", "missing", "story-two"],
		async (_site, key) => {
			if (key === "missing") {
				throw new Error("Not found");
			}
			return { elementKey: key };
		},
	);

	assert.deepEqual(
		result.items.map(({ elementKey }) => elementKey),
		["story-one", "story-two"],
	);
	assert.deepEqual(result.unavailableKeys, ["missing"]);
});
