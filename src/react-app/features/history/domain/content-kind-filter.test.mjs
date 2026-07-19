import assert from "node:assert/strict";
import test from "node:test";

import {
	contentKindCounts,
	contentWithKinds,
	DEFAULT_HISTORY_CONTENT_KINDS,
	toggledContentKinds,
} from "./content-kind-filter.ts";

const elements = [
	{ elementKey: "story", kind: "story" },
	{ elementKey: "video", kind: "video" },
	{ elementKey: "image", kind: "image" },
	{ elementKey: "heading", kind: "heading" },
	{ elementKey: "navigation", kind: "navigation" },
];

test("counts every analysed kind independently", () => {
	assert.deepEqual(contentKindCounts(elements), {
		audio: 0,
		heading: 1,
		image: 1,
		navigation: 1,
		other: 0,
		story: 1,
		video: 1,
	});
});

test("shows editorial content by default and keeps page structure available", () => {
	const visible = contentWithKinds(elements, new Set(DEFAULT_HISTORY_CONTENT_KINDS));

	assert.deepEqual(
		visible.map(({ kind }) => kind),
		["story", "video", "image"],
	);

	const withNavigation = toggledContentKinds(
		new Set(DEFAULT_HISTORY_CONTENT_KINDS),
		"navigation",
	);
	assert.equal(withNavigation.has("navigation"), true);
	assert.equal(toggledContentKinds(withNavigation, "navigation").has("navigation"), false);
});
