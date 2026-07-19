import assert from "node:assert/strict";
import test from "node:test";

import { determineStoryProminence } from "./story-prominence.ts";

function story(elementKey, width, viewportDepth, selectorHint = "h2") {
	return {
		elementKey,
		kind: "story",
		position: {
			height: 200,
			left: 0,
			pageOrder: Number(elementKey),
			top: viewportDepth * 1_000,
			viewportDepth,
			width,
		},
		selectorHint,
		textFingerprint: elementKey,
	};
}

test("assigns one lead while keeping major, standard, and minor stories reachable", () => {
	const stories = determineStoryProminence(
		[story("1", 500, 0.2), story("2", 450, 0.3), story("3", 300, 0.4), story("4", 150, 1.5)],
		1_200,
	);

	assert.deepEqual(
		stories.map(({ prominence }) => prominence),
		["lead", "major", "standard", "minor"],
	);
});

test("prefers an above-fold story heading marked h1 for the lead", () => {
	const stories = determineStoryProminence(
		[story("1", 500, 0.2), story("2", 300, 0.3, "h1")],
		1_200,
	);

	assert.deepEqual(
		stories.map(({ prominence }) => prominence),
		["major", "lead"],
	);
});

test("recognises a quarter-width top story as lead without making peers major", () => {
	const [topStory, laterStory] = determineStoryProminence(
		[story("1", 300, 0.2), story("2", 300, 1.2)],
		1_200,
	);

	assert.equal(topStory.prominence, "lead");
	assert.equal(laterStory.prominence, "standard");
});

test("does not invent a lead when extraction starts below the fold", () => {
	const [storyBelowFold] = determineStoryProminence([story("1", 500, 2)], 1_200);

	assert.equal(storyBelowFold.prominence, "major");
});

test("honours an extractor-reviewed lead across changing billboard layouts", () => {
	const h1 = story("1", 700, 0.15, "h1");
	const billboard = { ...story("2", 900, 0.25), prominenceHint: "lead" };
	const stories = determineStoryProminence([h1, billboard], 1_200);

	assert.deepEqual(
		stories.map(({ prominence }) => prominence),
		["major", "lead"],
	);
});

test("uses visual reading order when an extractor marks a row as lead candidates", () => {
	const left = { ...story("1", 250, 0.2), prominenceHint: "lead" };
	const right = {
		...story("2", 500, 0.2),
		position: { ...story("2", 500, 0.2).position, left: 600 },
		prominenceHint: "lead",
	};
	const stories = determineStoryProminence([left, right], 1_200);

	assert.deepEqual(
		stories.map(({ prominence }) => prominence),
		["lead", "major"],
	);
});
