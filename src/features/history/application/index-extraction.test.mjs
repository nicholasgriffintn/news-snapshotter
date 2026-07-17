import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction } from "../testing/extraction-fixture.mjs";
import { indexExtractionArtefact } from "./index-extraction.ts";

async function gzip(value) {
	const compressed = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
	return new Response(compressed).arrayBuffer();
}

async function environment(document, compress = true) {
	const { database, sqlite } = await createHistoryTestDatabase();
	const serialised = JSON.stringify(document);
	const body = compress ? await gzip(serialised) : new TextEncoder().encode(serialised);
	return {
		env: {
			ARCHIVE_DATA: {
				get: async () => ({ body: new Blob([body]).stream(), size: body.byteLength }),
			},
			HISTORY_DB: database,
		},
		sqlite,
	};
}

test("indexes a compressed extraction artefact from private R2", async () => {
	const document = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const { env, sqlite } = await environment(document);

	const result = await indexExtractionArtefact(env, {
		captureId: "capture-a",
		extractionKey: "capture-a.extraction.v1.json.gz",
		kind: "extraction",
		site: "bbc-home",
	});

	assert.deepEqual(result, { changeCount: 0 });
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM analysed_captures").get().count, 1);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM story_observations").get().count, 1);
	sqlite.close();
});

test("records identity mismatches as explicit indexing failures", async () => {
	const document = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");
	const { env, sqlite } = await environment(document);

	await assert.rejects(
		indexExtractionArtefact(env, {
			captureId: "capture-other",
			extractionKey: "capture-a.extraction.v1.json.gz",
			kind: "extraction",
			site: "bbc-home",
		}),
		/does not match extraction capture identity/,
	);
	const failure = sqlite
		.prepare("SELECT capture_id AS captureId, stage, message FROM extraction_failures")
		.get();
	assert.equal(failure.captureId, "capture-other");
	assert.equal(failure.stage, "indexing");
	assert.match(failure.message, /does not match/);
	sqlite.close();
});

test("indexes analysis failures idempotently", async () => {
	const failure = {
		captureId: "capture-failed",
		capturedAt: "2026-07-17T09:00:05.000Z",
		device: "desktop",
		message: "Expected at least 20 elements, found 3",
		site: "bbc-home",
		triggeredAt: "2026-07-17T09:00:00.000Z",
	};
	const { env, sqlite } = await environment(failure, false);
	const message = {
		failureKey: "site=bbc-home/capture.analysis-failure.json",
		kind: "failure",
	};

	await indexExtractionArtefact(env, message);
	await indexExtractionArtefact(env, message);

	const rows = sqlite
		.prepare("SELECT capture_id AS captureId, stage FROM extraction_failures")
		.all();
	assert.deepEqual(
		rows.map((row) => ({ ...row })),
		[{ captureId: "capture-failed", stage: "validation" }],
	);
	sqlite.close();
});
