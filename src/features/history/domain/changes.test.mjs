import assert from "node:assert/strict";
import test from "node:test";

import { diffAdjacentCaptures } from "./changes.ts";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";

test("records content, promotion, rank, position, and size changes", async () => {
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			historyStory({
				headline: "Updated BBC headline",
				position: {
					height: 300,
					left: 100,
					pageOrder: 1,
					top: 100,
					viewportDepth: 0.1,
					width: 800,
				},
				prominence: "lead",
			}),
		],
	});

	const changes = await diffAdjacentCaptures(previous, current);
	const types = changes.map(({ type }) => type);

	assert.deepEqual(types, [
		"headline-changed",
		"position-changed",
		"promoted",
		"rank-changed",
		"size-changed",
	]);
	assert.ok(changes.every(({ changeId }) => /^[a-f0-9]{64}$/.test(changeId)));
});

test("ignores sub-pixel layout noise", async () => {
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			historyStory({
				position: {
					height: 200.5,
					left: 0.5,
					pageOrder: 2,
					top: 800.5,
					viewportDepth: 0.8005,
					width: 600.5,
				},
			}),
		],
	});

	assert.deepEqual(await diffAdjacentCaptures(previous, current), []);
});

test("marks extractor upgrades without interpreting element-level changes", async () => {
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		extractorVersion: 2,
		elements: [historyStory({ headline: "Changed under a new extractor" })],
	});

	const changes = await diffAdjacentCaptures(previous, current);

	assert.deepEqual(
		changes.map(({ type }) => type),
		["extractor-version-boundary"],
	);
});

test("marks missing scheduled captures and content appearance or disappearance", async () => {
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
		elements: [historyStory()],
	});
	const current = historyExtraction("capture-c", "2026-07-17T12:00:00.000Z", {
		elements: [
			historyStory({
				canonicalUrl: "https://www.bbc.co.uk/news/articles/story-two",
				elementKey: "https://www.bbc.co.uk/news/articles/story-two",
			}),
		],
	});

	const changes = await diffAdjacentCaptures(previous, current);

	assert.deepEqual(
		changes.map(({ type }) => type),
		["appeared", "capture-gap", "disappeared"],
	);
});

test("tracks every content kind through its page element identity", async () => {
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
		elements: [
			historyStory(),
			historyStory({
				canonicalUrl: undefined,
				elementKey: "video:earlier-clip",
				kind: "video",
			}),
		],
	});
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			historyStory(),
			historyStory({
				canonicalUrl: "https://www.bbc.co.uk/sounds/play/latest",
				elementKey: "https://www.bbc.co.uk/sounds/play/latest",
				kind: "audio",
			}),
		],
	});

	const changes = await diffAdjacentCaptures(previous, current);

	assert.deepEqual(
		changes.map(({ elementKey, type }) => ({ elementKey, type })),
		[
			{
				elementKey: "https://www.bbc.co.uk/sounds/play/latest",
				type: "appeared",
			},
			{ elementKey: "video:earlier-clip", type: "disappeared" },
		],
	);
	assert.notEqual(changes[0].changeId, changes[1].changeId);
});

test("tracks kind, category, and prominence independently for matched content", async () => {
	const media = historyStory({
		canonicalUrl: "https://www.bbc.co.uk/sport/football/videos/example",
		elementKey: "https://www.bbc.co.uk/sport/football/videos/example",
		kind: "video",
	});
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
		elements: [media],
	});
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			{
				...media,
				category: "Football",
				kind: "audio",
				prominence: "lead",
			},
		],
	});

	const changes = await diffAdjacentCaptures(previous, current);

	assert.deepEqual(
		changes.map(({ type }) => ({ type })),
		[{ type: "category-changed" }, { type: "kind-changed" }, { type: "promoted" }],
	);
});

test("tracks repeated placements independently while retaining content identity", async () => {
	const elementKey = "https://www.bbc.co.uk/sport/golf/live/example";
	const newsPlacement = historyStory({
		elementKey,
		placementKey: `${elementKey}#section=news-headlines&occurrence=1`,
		section: "News headlines",
		position: { ...historyStory().position, pageOrder: 2, top: 200 },
	});
	const sportPlacement = historyStory({
		...newsPlacement,
		placementKey: `${elementKey}#section=sport-headlines&occurrence=1`,
		section: "Sport headlines",
		position: { ...newsPlacement.position, pageOrder: 8, top: 900 },
	});
	const previous = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
		elements: [newsPlacement, sportPlacement],
	});
	const current = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			newsPlacement,
			{
				...sportPlacement,
				position: { ...sportPlacement.position, pageOrder: 9 },
			},
		],
	});

	const changes = await diffAdjacentCaptures(previous, current);

	assert.deepEqual(
		changes.map(({ elementKey: contentKey, placementKey, type }) => ({
			contentKey,
			placementKey,
			type,
		})),
		[
			{
				contentKey: elementKey,
				placementKey: sportPlacement.placementKey,
				type: "rank-changed",
			},
		],
	);
});
