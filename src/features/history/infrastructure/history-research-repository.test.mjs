import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";
import { ingestExtraction } from "./history-ingestion-repository.ts";
import {
	createSavedTimeline,
	deleteSavedTimeline,
	getSavedTimeline,
	listHistoryImages,
	listSavedTimelines,
	searchHistory,
	updateSavedTimeline,
} from "./history-research-repository.ts";
import {
	historyTrends,
	materialiseHistoryMonth,
} from "./history-trend-repository.ts";

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
			historyStory({
				canonicalUrl: "https://www.bbc.co.uk/videos/election-result",
				elementKey: "https://www.bbc.co.uk/videos/election-result",
				headline: "Election result video analysis",
				kind: "video",
				position: { ...historyStory().position, pageOrder: 99, top: 8_000, width: 180 },
				prominence: "minor",
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
	const mobileCapture = researchCapture(
		"capture-mobile",
		"2026-07-17T10:30:00.000Z",
		"Election result mobile update",
	);
	mobileCapture.capture.device = "mobile";
	await ingestExtraction(database, "capture-mobile.json.gz", mobileCapture);

	const search = await searchHistory(database, {
		limit: 10,
		query: "election result",
		site: "bbc-home",
	});
	assert.equal(search.results.length, 2);
	assert.deepEqual(
		search.results.map(({ elementKey, rank }) => [elementKey, rank]),
		[
			["https://www.bbc.co.uk/news/articles/story-one", 2],
			["https://www.bbc.co.uk/videos/election-result", 99],
		],
	);
	assert.ok(search.results.every(({ captureId }) => captureId !== "capture-mobile"));
	const firstSearchPage = await searchHistory(database, {
		limit: 1,
		query: "election result",
		site: "bbc-home",
	});
	assert.ok(firstSearchPage.nextCursor);
	const secondSearchPage = await searchHistory(database, {
		cursor: firstSearchPage.nextCursor,
		limit: 1,
		query: "election result",
		site: "bbc-home",
	});
	assert.equal(
		secondSearchPage.results[0].elementKey,
		"https://www.bbc.co.uk/videos/election-result",
	);

	const images = await listHistoryImages(database, "bbc-home", "2026-07", { limit: 10 });
	assert.equal(images.images.length, 2);
	assert.equal(new Set(images.images.map(({ imageId }) => imageId)).size, 2);

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
	const materialised = await materialiseHistoryMonth(database, "bbc-home", "2026-07");
	assert.ok(materialised.rows > 0);
	const cachedTrend = await historyTrends(database, "bbc-home", "all", "category");
	assert.equal(cachedTrend.materialised, true);
	assert.equal(cachedTrend.periods[0].period, "2026-07");
	sqlite.close();
});

test("filters filler words from materialised coverage patterns", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const insertAggregate = (label, count, weightSeconds) =>
		database
			.prepare(
				`INSERT INTO history_monthly_aggregates (
					site, month, mode, label, observation_count, weighted_seconds, generated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				"bbc-home",
				"2026-07",
				"all-headline-words",
				label,
				count,
				weightSeconds,
				"2026-08-01",
			);
	await database.batch([
		insertAggregate("and", 12, 43_200),
		insertAggregate("election", 4, 14_400),
	]);

	const trends = await historyTrends(database, "bbc-home", "all", "all-headline-words");

	assert.deepEqual(trends.periods[0].values, [
		{ count: 4, label: "election", weightSeconds: 14_400 },
	]);
	sqlite.close();
});

test("creates and reads a shareable multi-content timeline", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	const elementKeys = [
		"https://www.bbc.co.uk/news/articles/story-one",
		"https://www.bbc.co.uk/news/articles/story-two",
	];
	const created = await createSavedTimeline(database, {
		name: "Election and markets",
		site: "bbc-home",
		elementKeys,
	});
	const timeline = await getSavedTimeline(database, created.slug);

	assert.match(created.slug, /^election-and-markets-/);
	assert.equal(timeline.name, "Election and markets");
	assert.equal(new Set(timeline.observations.map(({ elementKey }) => elementKey)).size, 2);
	sqlite.close();
});

test("lists saved timeline summaries for one site", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	await createSavedTimeline(database, {
		elementKeys: [
			"https://www.bbc.co.uk/news/articles/story-one",
			"https://www.bbc.co.uk/news/articles/story-two",
		],
		name: "Election and markets",
		site: "bbc-home",
	});

	const timelines = await listSavedTimelines(database, "bbc-home");

	assert.equal(timelines.length, 1);
	assert.equal(timelines[0].name, "Election and markets");
	assert.equal(timelines[0].contentCount, 2);
	assert.deepEqual(timelines[0].elementKeys, [
		"https://www.bbc.co.uk/news/articles/story-one",
		"https://www.bbc.co.uk/news/articles/story-two",
	]);
	assert.deepEqual(await listSavedTimelines(database, "guardian-uk"), []);
	sqlite.close();
});

test("updates a saved timeline without changing its public identity", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	const created = await createSavedTimeline(database, {
		elementKeys: [
			"https://www.bbc.co.uk/news/articles/story-one",
			"https://www.bbc.co.uk/news/articles/story-two",
		],
		name: "Election and markets",
		site: "bbc-home",
	});

	const updated = await updateSavedTimeline(database, created.timelineId, {
		elementKeys: [
			"https://www.bbc.co.uk/news/articles/story-two",
			"https://www.bbc.co.uk/videos/election-result",
		],
		name: "Markets and video",
		site: "bbc-home",
	});

	assert.equal(updated, true);
	const timeline = await getSavedTimeline(database, created.slug);
	assert.equal(timeline.timelineId, created.timelineId);
	assert.equal(timeline.slug, created.slug);
	assert.equal(timeline.name, "Markets and video");
	assert.deepEqual((await listSavedTimelines(database))[0].elementKeys, [
		"https://www.bbc.co.uk/news/articles/story-two",
		"https://www.bbc.co.uk/videos/election-result",
	]);
	assert.equal(
		await updateSavedTimeline(database, "missing", {
			elementKeys: [
				"https://www.bbc.co.uk/news/articles/story-one",
				"https://www.bbc.co.uk/news/articles/story-two",
			],
			name: "Missing",
			site: "bbc-home",
		}),
		false,
	);
	sqlite.close();
});

test("deletes a saved timeline and its selected content", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		researchCapture("capture-a", "2026-07-17T09:00:00.000Z", "Election result live"),
	);
	const created = await createSavedTimeline(database, {
		elementKeys: [
			"https://www.bbc.co.uk/news/articles/story-one",
			"https://www.bbc.co.uk/news/articles/story-two",
		],
		name: "Election and markets",
		site: "bbc-home",
	});

	assert.equal(await deleteSavedTimeline(database, created.timelineId), true);
	assert.equal(await getSavedTimeline(database, created.slug), null);
	assert.equal(
		sqlite
			.prepare("SELECT COUNT(*) AS count FROM saved_timeline_elements WHERE timeline_id = ?")
			.get(created.timelineId).count,
		0,
	);
	assert.equal(await deleteSavedTimeline(database, created.timelineId), false);
	sqlite.close();
});

test("saved timelines use one primary point for repeated page placements", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const repeatedKey = "https://www.bbc.co.uk/news/articles/story-one";
	const secondKey = "https://www.bbc.co.uk/news/articles/story-two";
	await ingestExtraction(
		database,
		"capture-repeated.json.gz",
		historyExtraction("capture-repeated", "2026-07-17T09:00:00.000Z", {
			elements: [
				historyStory({
					placementKey: `${repeatedKey}#section=news-headlines&occurrence=1`,
					prominence: "lead",
					section: "News headlines",
					position: { ...historyStory().position, pageOrder: 1, top: 200 },
				}),
				historyStory({
					placementKey: `${repeatedKey}#section=more-news&occurrence=1`,
					prominence: "minor",
					section: "More news",
					position: { ...historyStory().position, pageOrder: 20, top: 4_000 },
				}),
				historyStory({
					canonicalUrl: secondKey,
					elementKey: secondKey,
					placementKey: `${secondKey}#section=news-headlines&occurrence=1`,
				}),
			],
		}),
	);
	const created = await createSavedTimeline(database, {
		elementKeys: [repeatedKey, secondKey],
		name: "Repeated placements",
		site: "bbc-home",
	});

	const timeline = await getSavedTimeline(database, created.slug);

	assert.equal(timeline.observations.length, 2);
	const repeated = timeline.observations.find(({ elementKey }) => elementKey === repeatedKey);
	assert.equal(repeated.prominence, "lead");
	assert.equal(repeated.rank, 1);

	sqlite.close();
});
