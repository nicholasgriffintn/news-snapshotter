import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction } from "../testing/extraction-fixture.mjs";
import { ingestExtraction } from "../infrastructure/history-ingestion-repository.ts";
import { previousUtcMonth, processHistoryAggregateMessage } from "./materialise-history-month.ts";

test("derives the previous UTC month across a year boundary", () => {
	assert.equal(previousUtcMonth(Date.UTC(2026, 0, 2, 3, 15)), "2025-12");
	assert.equal(previousUtcMonth(Date.UTC(2026, 7, 2, 3, 15)), "2026-07");
});

test("reprocesses a queued site-month aggregate to include late captures", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-31T22:00:00.000Z"),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		historyExtraction("capture-b", "2026-08-01T01:00:00.000Z"),
	);
	const message = { kind: "materialise-history-month", month: "2026-07", site: "bbc-home" };

	const first = await processHistoryAggregateMessage(database, message);
	await ingestExtraction(
		database,
		"capture-late.json.gz",
		historyExtraction("capture-late", "2026-07-31T23:00:00.000Z"),
	);
	const second = await processHistoryAggregateMessage(database, message);

	assert.ok(first.rows > 0);
	assert.equal(second.rows, first.rows);
	assert.equal(
		sqlite
			.prepare(
				`SELECT SUM(observation_count) AS count
				FROM history_monthly_aggregates
				WHERE site = ? AND month = ? AND mode = 'category'`,
			)
			.get("bbc-home", "2026-07").count,
		2,
	);
	assert.equal(
		sqlite
			.prepare(
				"SELECT COUNT(*) AS count FROM history_monthly_aggregate_runs WHERE site = ? AND month = ?",
			)
			.get("bbc-home", "2026-07").count,
		1,
	);
	sqlite.close();
});
