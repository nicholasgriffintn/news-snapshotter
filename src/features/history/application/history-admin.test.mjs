import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { handleHistoryAdminRequest } from "./history-admin.ts";
import { historyExtraction } from "../testing/extraction-fixture.mjs";
import { ingestExtraction } from "../infrastructure/history-ingestion-repository.ts";

function request(path, body) {
	return new Request(`https://archive.example${path}`, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: body === undefined ? undefined : { "content-type": "application/json" },
		method: body === undefined ? "GET" : "POST",
	});
}

test("reindex scans bounded R2 pages and queues only desktop history artefacts", async () => {
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
								customMetadata: { device: "desktop", site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/device=desktop/a.extraction.v1.json.gz",
							},
							{
								customMetadata: { site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/device=desktop/b.analysis-failure.json",
							},
							{
								customMetadata: { device: "mobile", site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/device=mobile/c.extraction.v1.json.gz",
							},
							{
								customMetadata: { site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/device=mobile/d.analysis-failure.json",
							},
							{
								customMetadata: { device: "desktop", site: "bbc-home" },
								key: "brand=bbc/site=bbc-home/device=mobile/e.extraction.v1.json.gz",
							},
							{
								customMetadata: { site: "bbc-home" },
								key: "legacy.extraction.v1.json.gz",
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
		scanned: 7,
	});
	assert.deepEqual(
		batches.flat().map(({ body: message }) => message),
		[
			{
				extractionKey: "brand=bbc/site=bbc-home/device=desktop/a.extraction.v1.json.gz",
				kind: "extraction",
			},
			{
				failureKey: "brand=bbc/site=bbc-home/device=desktop/b.analysis-failure.json",
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

test("clears extraction failures for one site", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const insert = sqlite.prepare(
		`INSERT INTO extraction_failures (
			failure_key, capture_id, site, device, stage, message, failed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	);
	insert.run(
		"failure-bbc",
		"capture-bbc",
		"bbc-home",
		"desktop",
		"validation",
		"BBC failed",
		"2026-07-17T09:00:00.000Z",
	);
	insert.run(
		"failure-sky",
		"capture-sky",
		"sky-home",
		"desktop",
		"validation",
		"Sky failed",
		"2026-07-17T10:00:00.000Z",
	);

	const response = await handleHistoryAdminRequest(
		new Request("https://archive.example/api/admin/history/extraction-failures?site=bbc-home", {
			method: "DELETE",
		}),
		{ HISTORY_DB: database },
	);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { cleared: 1 });
	assert.deepEqual(
		sqlite
			.prepare("SELECT site FROM extraction_failures ORDER BY site")
			.all()
			.map(({ site }) => site),
		["sky-home"],
	);
	sqlite.close();
});

test("lists indexed extractions with bounded ordering and site filtering", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const older = historyExtraction("older", "2026-07-17T08:00:00.000Z");
	const newer = historyExtraction("newer", "2026-07-17T10:00:00.000Z");
	newer.capture.site = "bbc-news";
	await ingestExtraction(database, "older.extraction.v1.json.gz", older);
	await ingestExtraction(database, "newer.extraction.v1.json.gz", newer);

	const newestResponse = await handleHistoryAdminRequest(
		request("/api/admin/history/extractions?limit=1&sort=newest"),
		{ HISTORY_DB: database },
	);
	const newest = await newestResponse.json();
	assert.equal(newest.extractions.length, 1);
	assert.equal(newest.extractions[0].captureId, "newer");
	assert.equal(newest.extractions[0].matchedElements, 1);

	const siteResponse = await handleHistoryAdminRequest(
		request("/api/admin/history/extractions?limit=10&sort=oldest&site=bbc-home"),
		{ HISTORY_DB: database },
	);
	const site = await siteResponse.json();
	assert.deepEqual(
		site.extractions.map(({ captureId }) => captureId),
		["older"],
	);
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
