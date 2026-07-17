import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SQLiteD1 } from "../../../testing/sqlite-d1.mjs";
import { historyExtraction } from "../testing/extraction-fixture.mjs";
import { indexExtractionArtefact } from "./index-extraction.ts";

async function gzip(value) {
	const compressed = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
	return new Response(compressed).arrayBuffer();
}

async function environment(document) {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(
		await readFile(new URL("../../../../migrations/0001_history.sql", import.meta.url), "utf8"),
	);
	const body = await gzip(JSON.stringify(document));
	return {
		env: {
			ARCHIVE_DATA: {
				get: async () => ({ body: new Blob([body]).stream(), size: body.byteLength }),
			},
			HISTORY_DB: new SQLiteD1(sqlite),
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
