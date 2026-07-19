import assert from "node:assert/strict";
import test from "node:test";

import {
	getCapture,
	getContentHistory,
	listCaptures,
	listHistorySites,
} from "./history-repository.ts";
import { ingestExtraction } from "./history-ingestion-repository.ts";
import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";

function rows(database, sql) {
	return database
		.prepare(sql)
		.all()
		.map((row) => ({ ...row }));
}

test("late and repeated ingestion converges on the two true adjacent edges", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const captureA = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const captureB = historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
		elements: [
			historyStory({
				headline: "Middle headline",
				position: { ...historyStory().position, pageOrder: 1 },
			}),
		],
	});
	const captureC = historyExtraction("capture-c", "2026-07-17T11:00:00.000Z", {
		elements: [historyStory({ headline: "Latest headline", prominence: "lead" })],
	});

	await ingestExtraction(database, "capture-a.json.gz", captureA);
	await ingestExtraction(database, "capture-c.json.gz", captureC);
	assert.ok(
		rows(
			sqlite,
			"SELECT 1 FROM change_events WHERE previous_capture_id = 'capture-a' AND current_capture_id = 'capture-c'",
		).length > 0,
	);

	await ingestExtraction(database, "capture-b.json.gz", captureB);
	assert.equal(
		rows(
			sqlite,
			"SELECT 1 FROM change_events WHERE previous_capture_id = 'capture-a' AND current_capture_id = 'capture-c'",
		).length,
		0,
	);
	assert.deepEqual(
		rows(
			sqlite,
			`SELECT DISTINCT previous_capture_id AS previousId, current_capture_id AS currentId
			FROM change_events ORDER BY previous_capture_id`,
		),
		[
			{ previousId: "capture-a", currentId: "capture-b" },
			{ previousId: "capture-b", currentId: "capture-c" },
		],
	);

	const eventIds = rows(
		sqlite,
		"SELECT change_id AS changeId FROM change_events ORDER BY change_id",
	);
	await ingestExtraction(database, "capture-b.json.gz", captureB);
	assert.deepEqual(
		rows(sqlite, "SELECT change_id AS changeId FROM change_events ORDER BY change_id"),
		eventIds,
	);
	assert.equal(
		rows(sqlite, "SELECT * FROM page_elements WHERE capture_id = 'capture-b'").length,
		1,
	);
	assert.equal(
		rows(sqlite, "SELECT * FROM content_observation_search WHERE capture_id = 'capture-b'").length,
		1,
	);

	sqlite.close();
});

test("persists every content kind as the same complete page observation", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("capture-media", "2026-07-17T09:00:00.000Z", {
		elements: [
			historyStory({ position: { ...historyStory().position, pageOrder: 1 } }),
			historyStory({
				canonicalUrl: undefined,
				category: "Sport",
				elementKey: "video:short-report",
				headline: "Short report from the scene",
				kind: "video",
				position: { ...historyStory().position, pageOrder: 2 },
				section: "Shorts",
			}),
			historyStory({
				canonicalUrl: "https://www.bbc.co.uk/sounds/play/example",
				elementKey: "https://www.bbc.co.uk/sounds/play/example",
				headline: "Listen to the latest bulletin",
				kind: "audio",
				position: { ...historyStory().position, pageOrder: 3 },
			}),
		],
	});

	await ingestExtraction(database, "capture-media.json.gz", capture);
	const stored = await getCapture(database, "bbc-home", "capture-media");

	assert.deepEqual(
		stored.elements.map(({ elementKey, kind, prominence }) => [elementKey, kind, prominence]),
		[
			["https://www.bbc.co.uk/news/articles/story-one", "story", "standard"],
			["video:short-report", "video", "standard"],
			["https://www.bbc.co.uk/sounds/play/example", "audio", "standard"],
		],
	);
	assert.deepEqual(
		rows(
			sqlite,
			`SELECT kind, headline, summary, image_source_url AS imageSourceUrl,
				category, prominence, section
			FROM page_elements ORDER BY rank`,
		),
		[
			{
				category: "News",
				headline: "Original BBC headline",
				imageSourceUrl: "https://ichef.bbci.co.uk/one.jpg",
				kind: "story",
				prominence: "standard",
				section: "Top stories",
				summary: "Original summary",
			},
			{
				category: "Sport",
				headline: "Short report from the scene",
				imageSourceUrl: "https://ichef.bbci.co.uk/one.jpg",
				kind: "video",
				prominence: "standard",
				section: "Shorts",
				summary: "Original summary",
			},
			{
				category: "Sounds",
				headline: "Listen to the latest bulletin",
				imageSourceUrl: "https://ichef.bbci.co.uk/one.jpg",
				kind: "audio",
				prominence: "standard",
				section: "Top stories",
				summary: "Original summary",
			},
		],
	);

	sqlite.close();
});

test("reads a bounded media history across captures", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const media = historyStory({
		canonicalUrl: "https://www.bbc.co.uk/sport/football/videos/example",
		category: "Football",
		elementKey: "https://www.bbc.co.uk/sport/football/videos/example",
		headline: "Opening match highlights",
		kind: "video",
		prominence: "major",
	});
	await ingestExtraction(
		database,
		"capture-media-a.json.gz",
		historyExtraction("capture-media-a", "2026-07-17T09:00:00.000Z", { elements: [media] }),
	);
	await ingestExtraction(
		database,
		"capture-media-b.json.gz",
		historyExtraction("capture-media-b", "2026-07-17T10:00:00.000Z", {
			elements: [
				{
					...media,
					headline: "Extended match highlights",
					prominence: "lead",
				},
			],
		}),
	);
	await ingestExtraction(
		database,
		"capture-media-c.json.gz",
		historyExtraction("capture-media-c", "2026-07-17T11:00:00.000Z", {
			elements: [{ ...media, headline: "Final match highlights", prominence: "standard" }],
		}),
	);

	const history = await getContentHistory(database, "bbc-home", media.elementKey, {
		limit: 2,
	});

	assert.equal(history.kind, "video");
	assert.equal(history.canonicalUrl, media.canonicalUrl);
	assert.deepEqual(
		history.observations.map(({ headline, prominence }) => [headline, prominence]),
		[
			["Extended match highlights", "lead"],
			["Final match highlights", "standard"],
		],
	);
	assert.ok(history.nextCursor);
	const older = await getContentHistory(database, "bbc-home", media.elementKey, {
		cursor: history.nextCursor,
		limit: 2,
	});
	assert.deepEqual(
		older.observations.map(({ headline }) => headline),
		["Opening match highlights"],
	);
	assert.equal(
		await getContentHistory(database, "bbc-news", media.elementKey, { limit: 10 }),
		null,
	);

	sqlite.close();
});

test("keeps legacy mobile captures out of desktop history and prominence comparisons", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const desktop = historyExtraction("capture-desktop", "2026-07-17T09:00:00.000Z");
	const mobile = {
		...historyExtraction("capture-mobile", "2026-07-17T10:00:00.000Z"),
		capture: {
			...historyExtraction("capture-mobile", "2026-07-17T10:00:00.000Z").capture,
			device: "mobile",
		},
	};

	await ingestExtraction(database, "capture-desktop.json.gz", desktop);
	await ingestExtraction(database, "capture-mobile.json.gz", mobile);

	const page = await listCaptures(database, "bbc-home", { limit: 10 });
	assert.deepEqual(
		page.captures.map(({ captureId, device }) => [captureId, device]),
		[["capture-desktop", "desktop"]],
	);
	assert.equal(await getCapture(database, "bbc-home", "capture-mobile"), null);
	assert.deepEqual(
		(await listHistorySites(database)).map(({ device, site }) => [site, device]),
		[["bbc-home", "desktop"]],
	);

	sqlite.close();
});
