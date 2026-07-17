import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { handleHistoryAdminRequest } from "./history-admin.ts";
import { historyExtraction } from "../testing/extraction-fixture.mjs";

function request(path, body) {
	return new Request(`https://archive.example${path}`, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: body === undefined ? undefined : { "content-type": "application/json" },
		method: body === undefined ? "GET" : "POST",
	});
}

test("reindex scans bounded R2 pages and queues only history artefacts", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const batches = [];
	const response = await handleHistoryAdminRequest(
		request("/api/admin/history/reindex", { limit: 100, reset: true, site: "bbc-home" }),
		{
			ARCHIVE_DATA: {
				list: async (options) => {
					assert.deepEqual(options, {
						cursor: undefined,
						include: ["customMetadata"],
						limit: 100,
					});
					return {
						cursor: "next-r2-page",
						objects: [
							{
								customMetadata: { site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/a.extraction.v1.json.gz",
							},
							{
								customMetadata: { site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/b.analysis-failure.json",
							},
							{ customMetadata: { site: "bbc-home" }, key: "other.html.gz" },
						],
						truncated: true,
					};
				},
			},
			HISTORY_DB: database,
			HISTORY_INDEX_QUEUE: { sendBatch: async (batch) => batches.push(batch) },
		},
	);
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.deepEqual(body, {
		cursor: "next-r2-page",
		enqueued: 2,
		hasMore: true,
		reset: true,
		scanned: 3,
	});
	assert.deepEqual(
		batches.flat().map(({ body: message }) => message),
		[
			{
				extractionKey: "brand=bbc/site=bbc-home/a.extraction.v1.json.gz",
				kind: "extraction",
			},
			{
				failureKey: "brand=bbc/site=bbc-home/b.analysis-failure.json",
				kind: "failure",
			},
		],
	);
	sqlite.close();
});

test("serves bounded indexing status and extraction failures", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	sqlite
		.prepare(
			`INSERT INTO extraction_failures (
				failure_key, capture_id, site, device, stage, message, failed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			"failure-key",
			"capture-a",
			"bbc-home",
			"desktop",
			"validation",
			"Not enough stories",
			"2026-07-17T09:00:00.000Z",
		);
	const env = { HISTORY_DB: database };

	const status = await handleHistoryAdminRequest(request("/api/admin/history/status"), env);
	assert.equal((await status.json()).totals.failures, 1);

	const failures = await handleHistoryAdminRequest(
		request("/api/admin/history/extraction-failures?limit=1&site=bbc-home"),
		env,
	);
	const body = await failures.json();
	assert.equal(body.failures.length, 1);
	assert.equal(body.failures[0].captureId, "capture-a");
	sqlite.close();
});

test("previews a private extraction without returning stored HTML", async () => {
	const extraction = historyExtraction("capture-preview", "2026-07-17T09:00:00.000Z", {
		extractorVersion: 2,
	});
	const compressed = new Blob([JSON.stringify(extraction)])
		.stream()
		.pipeThrough(new CompressionStream("gzip"));
	const key = "brand=bbc/site=bbc-home/capture.extraction.v1.json.gz";
	const response = await handleHistoryAdminRequest(
		request(`/api/admin/history/extractor-preview?key=${encodeURIComponent(key)}`),
		{
			ARCHIVE_DATA: {
				get: async (requestedKey) => {
					assert.equal(requestedKey, key);
					return { body: compressed, httpMetadata: { contentEncoding: "gzip" } };
				},
			},
		},
	);
	const body = await response.json();

	assert.equal(body.matchedElements, 1);
	assert.equal(body.expectedMinimum, 20);
	assert.equal(body.capture.htmlKey, "capture-preview.html.gz");
	assert.equal(body.html, undefined);
	assert.equal(body.elements[0].elementKey, extraction.elements[0].elementKey);
});
