import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { ingestExtraction } from "./history-repository.ts";
import { SQLiteD1 } from "../../../testing/sqlite-d1.mjs";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";

function rows(database, sql) {
	return database
		.prepare(sql)
		.all()
		.map((row) => ({ ...row }));
}

test("late and repeated ingestion converges on the two true adjacent edges", async () => {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(
		await readFile(new URL("../../../../migrations/0001_history.sql", import.meta.url), "utf8"),
	);
	const database = new SQLiteD1(sqlite);
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
		rows(sqlite, "SELECT * FROM story_observations WHERE capture_id = 'capture-b'").length,
		1,
	);
	assert.equal(
		rows(sqlite, "SELECT * FROM story_observation_search WHERE capture_id = 'capture-b'").length,
		1,
	);

	sqlite.close();
});
