import assert from "node:assert/strict";
import test from "node:test";

import { determineContentProminence } from "./content-prominence.ts";

function content(elementKey, width, viewportDepth, selectorHint = "h2", kind = "story") {
	return {
		elementKey,
		kind,
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

test("assigns one lead while keeping every prominence level reachable", () => {
	const elements = determineContentProminence(
		[
			content("1", 500, 0.2, "h2", "video"),
			content("2", 450, 0.3),
			content("3", 300, 0.4, "h3", "audio"),
			content("4", 150, 1.5, "img", "image"),
		],
		1_200,
	);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["lead", "major", "standard", "minor"],
	);
});

test("uses visual impact rather than content kind or heading level", () => {
	const elements = determineContentProminence(
		[content("1", 500, 0.2), content("2", 300, 0.3, "h1", "heading")],
		1_200,
	);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["lead", "standard"],
	);
});

test("recognises a quarter-width top story as lead without making peers major", () => {
	const [topStory, laterStory] = determineContentProminence(
		[content("1", 300, 0.2), content("2", 300, 1.2)],
		1_200,
	);

	assert.equal(topStory.prominence, "lead");
	assert.equal(laterStory.prominence, "standard");
});

test("does not invent a lead when extraction starts below the fold", () => {
	const [storyBelowFold] = determineContentProminence([content("1", 500, 2)], 1_200);

	assert.equal(storyBelowFold.prominence, "major");
});

test("does not promote a visually negligible h1", () => {
	const tinyHeading = content("1", 1, 0.1, "h1", "heading");
	const visibleVideo = content("2", 300, 0.2, "h2", "video");
	const elements = determineContentProminence([tinyHeading, visibleVideo], 1_200);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["minor", "lead"],
	);
});

test("does not let a below-fold hint override visible page content", () => {
	const visibleVideo = content("1", 300, 0.2, "h2", "video");
	const lowerBillboard = { ...content("2", 900, 2), prominenceHint: "lead" };
	const elements = determineContentProminence([visibleVideo, lowerBillboard], 1_200);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["lead", "major"],
	);
});

test("honours an extractor-reviewed lead across changing billboard layouts", () => {
	const h1 = content("1", 700, 0.15, "h1");
	const billboard = { ...content("2", 900, 0.25), prominenceHint: "lead" };
	const elements = determineContentProminence([h1, billboard], 1_200);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["major", "lead"],
	);
});

test("uses visual reading order when an extractor marks a row as lead candidates", () => {
	const left = { ...content("1", 250, 0.2), prominenceHint: "lead" };
	const right = {
		...content("2", 500, 0.2),
		position: { ...content("2", 500, 0.2).position, left: 600 },
		prominenceHint: "lead",
	};
	const elements = determineContentProminence([left, right], 1_200);

	assert.deepEqual(
		elements.map(({ prominence }) => prominence),
		["lead", "major"],
	);
});
