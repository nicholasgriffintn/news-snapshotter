import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";
import { ingestExtraction } from "./history-repository.ts";
import {
	createSavedTimeline,
	getSavedTimeline,
	historyTrends,
	listHistoryImages,
	searchHistory,
} from "./history-research-repository.ts";

function researchCapture(captureId, capturedAt, headline) {
	return historyExtraction(captureId, capturedAt, {
		elements: [
			historyStory({ category: "Politics", headline, prominence: "lead" }),
			historyStory({
				canonicalUrl: "https://www.bbc.co.uk/news/articles/story-two",
				category: "World",
				elementKey: "https://www.bbc.co.uk/news/articles/story-two",
				headline: "Global markets react",
				image: {
					alt: "A market trader",
					sourceUrl: "https://ichef.bbci.co.uk/two.jpg",
				},
				position: { ...historyStory().position, pageOrder: 2, top: 1_200 },
			}),
		],
	});
}

test("searches FTS fields and builds image and time-weighted trend timelines", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		researchCapture("capture-b", "2026-07-17T10:00:00.000Z", "Election result reaction"),
	);

	const search = await searchHistory(database, {
		limit: 10,
		query: "election result",
		site: "bbc-home",
	});
	assert.equal(search.results.length, 2);

	const images = await listHistoryImages(database, "bbc-home", "2026-07", { limit: 10 });
	assert.equal(images.images.length, 4);

	const category = await historyTrends(
		database,
		"bbc-home",
		"all",
		"category",
		new Date("2026-07-17T11:00:00.000Z"),
	);
	assert.equal(category.timeWeighted, true);
	assert.ok(category.periods[0].values.some(({ label }) => label === "Politics"));

	const words = await historyTrends(
		database,
		"bbc-home",
		"all",
		"main-headline-words",
		new Date("2026-07-17T11:00:00.000Z"),
	);
	assert.ok(words.periods[0].values.some(({ label }) => label === "election"));
	sqlite.close();
});

test("creates and reads a shareable multi-story timeline", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	const storyIds = [
		"bbc-home:https://www.bbc.co.uk/news/articles/story-one",
		"bbc-home:https://www.bbc.co.uk/news/articles/story-two",
	];
	const created = await createSavedTimeline(database, {
		name: "Election and markets",
		site: "bbc-home",
		storyIds,
	});
	const timeline = await getSavedTimeline(database, created.slug);

	assert.match(created.slug, /^election-and-markets-/);
	assert.equal(timeline.name, "Election and markets");
	assert.equal(new Set(timeline.observations.map(({ storyId }) => storyId)).size, 2);
	sqlite.close();
});
