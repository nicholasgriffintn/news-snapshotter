import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../testing/history-database.mjs";
import { historyExtraction } from "../../features/history/testing/extraction-fixture.mjs";
import { ingestExtraction } from "../../features/history/infrastructure/history-ingestion-repository.ts";
import { handleWorkerQueue } from "./queue.ts";

test("acknowledges a successfully materialised history month queue message", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-july.json.gz",
		historyExtraction("capture-july", "2026-07-31T22:00:00.000Z"),
	);
	await ingestExtraction(
		database,
		"capture-august.json.gz",
		historyExtraction("capture-august", "2026-08-01T01:00:00.000Z"),
	);
	let acknowledged = 0;
	let retried = 0;
	const message = {
		ack: () => {
			acknowledged += 1;
		},
		attempts: 1,
		body: { kind: "materialise-history-month", month: "2026-07", site: "bbc-home" },
		retry: () => {
			retried += 1;
		},
	};

	await handleWorkerQueue(
		{ messages: [message], queue: "news-snapshotter-history-index" },
		{ HISTORY_DB: database },
	);

	assert.equal(acknowledged, 1);
	assert.equal(retried, 0);
	assert.ok(
		sqlite.prepare("SELECT COUNT(*) AS count FROM history_monthly_aggregates").get().count > 0,
	);
	sqlite.close();
});
