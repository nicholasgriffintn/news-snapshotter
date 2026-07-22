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

function timelineRequest(method, path, body) {
	const init = { method };
	if (body !== undefined) {
		init.body = JSON.stringify(body);
		init.headers = { "content-type": "application/json" };
	}
	return new Request(`https://archive.example${path}`, init);
}

function seedComparisonFeedback(sqlite, captureId) {
	sqlite
		.prepare(
			`INSERT INTO analysis_runs (
				run_id, idempotency_key, kind, capture_id, input_hash, pipeline_version,
				taxonomy_version, prompt_version, schema_version, model, status, created_at
			) VALUES (?, ?, 'capture-annotation', ?, ?, 1, 1, 1, 1, 'test-model', 'succeeded', ?)`,
		)
		.run("run-a", "run-a-key", captureId, "input-a", "2026-07-17T09:05:00.000Z");
	sqlite
		.prepare(
			`INSERT INTO comparison_stories (
				story_id, cohort_id, slug, normalised_label, first_seen_at, last_seen_at, status,
				current_revision_id
			) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
		)
		.run(
			"story-a",
			"uk-national-hourly",
			"story-a",
			"Story A",
			"2026-07-17T09:00:00.000Z",
			"2026-07-17T09:00:00.000Z",
			"revision-a",
		);
	sqlite
		.prepare(
			`INSERT INTO story_revisions (
				revision_id, story_id, run_id, summary, common_ground_json, differences_json,
				analysis_status, confidence, source_count, evidence_count,
				perspective_snapshot_json, r2_document_key, created_at
			) VALUES (?, ?, ?, ?, '[]', '[]', 'available', 0.8, 1, 1, '[]', ?, ?)`,
		)
		.run(
			"revision-a",
			"story-a",
			"run-a",
			"A comparison summary",
			"comparison/revision-a.json",
			"2026-07-17T09:10:00.000Z",
		);
	sqlite
		.prepare(
			`INSERT INTO story_revision_evidence (
				revision_id, evidence_id, annotation_run_id, capture_id, placement_key, site
			) VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.run("revision-a", "evidence-a", "run-a", captureId, "placement-a", "bbc-home");
	sqlite
		.prepare(
			`INSERT INTO analysis_feedback (
				feedback_id, revision_id, story_id, story_label, evidence_id, reason, note, submitted_at
			) VALUES (?, ?, ?, ?, ?, 'incorrect', ?, ?)`,
		)
		.run(
			"feedback-a",
			"revision-a",
			"story-a",
			"Story A",
			"evidence-a",
			"The comparison needs review",
			"2026-07-17T09:15:00.000Z",
		);
}

test("reindex scans bounded R2 pages and queues only desktop history artefacts", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	sqlite
		.prepare(
			"INSERT INTO saved_timelines (timeline_id, slug, name, site, created_at) VALUES (?, ?, ?, ?, ?)",
		)
		.run(
			"timeline-a",
			"durable-timeline",
			"Durable timeline",
			"bbc-home",
			"2026-07-17T08:00:00.000Z",
		);
	sqlite
		.prepare(
			"INSERT INTO history_monthly_aggregate_runs (site, month, generated_at) VALUES (?, ?, ?)",
		)
		.run("bbc-home", "2026-06", "2026-07-01T00:00:00.000Z");
	await ingestExtraction(
		database,
		"capture-reset.json.gz",
		historyExtraction("capture-reset", "2026-07-17T09:00:00.000Z"),
	);
	seedComparisonFeedback(sqlite, "capture-reset");
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
	assert.equal(
		sqlite.prepare("SELECT name FROM saved_timelines WHERE timeline_id = ?").get("timeline-a").name,
		"Durable timeline",
	);
	assert.equal(
		sqlite.prepare("SELECT COUNT(*) AS count FROM history_monthly_aggregate_runs").get().count,
		0,
	);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM comparison_stories").get().count, 0);
	const preservedFeedback = sqlite
		.prepare(
			"SELECT revision_id, story_id, story_label FROM analysis_feedback WHERE feedback_id = ?",
		)
		.get("feedback-a");
	assert.equal(preservedFeedback.revision_id, "revision-a");
	assert.equal(preservedFeedback.story_id, "story-a");
	assert.equal(preservedFeedback.story_label, "Story A");
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

test("does not expose monthly materialisation as an admin API", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const response = await handleHistoryAdminRequest(
		request("/api/admin/history/aggregates", { month: "2026-07", site: "bbc-home" }),
		{ HISTORY_DB: database },
	);

	assert.equal(response, null);
	sqlite.close();
});

test("manages saved timelines through the admin API", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const extraction = historyExtraction("timeline-capture", "2026-07-17T09:00:00.000Z");
	const second = structuredClone(extraction.elements[0]);
	second.elementKey = "https://www.bbc.co.uk/news/articles/story-two";
	second.canonicalUrl = second.elementKey;
	second.placementKey = `${second.elementKey}#section=news&occurrence=1`;
	second.headline = "Second story";
	extraction.elements.push(second);
	await ingestExtraction(database, "timeline-capture.json.gz", extraction);
	const env = { HISTORY_DB: database };
	const input = {
		elementKeys: extraction.elements.map(({ elementKey }) => elementKey),
		name: "Election coverage",
		site: "bbc-home",
	};

	const createdResponse = await handleHistoryAdminRequest(
		timelineRequest("POST", "/api/admin/history/timelines", input),
		env,
	);
	const created = await createdResponse.json();
	assert.equal(createdResponse.status, 201);

	const listResponse = await handleHistoryAdminRequest(
		timelineRequest("GET", "/api/admin/history/timelines"),
		env,
	);
	const listed = await listResponse.json();
	assert.equal(listed.timelines.length, 1);
	assert.deepEqual(listed.timelines[0].elementKeys, input.elementKeys);

	const updateResponse = await handleHistoryAdminRequest(
		timelineRequest("PUT", `/api/admin/history/timelines/${created.timelineId}`, {
			...input,
			name: "Updated election coverage",
		}),
		env,
	);
	assert.equal(updateResponse.status, 200);
	assert.equal((await updateResponse.json()).timelineId, created.timelineId);

	const deleteResponse = await handleHistoryAdminRequest(
		timelineRequest("DELETE", `/api/admin/history/timelines/${created.timelineId}`),
		env,
	);
	assert.equal(deleteResponse.status, 200);
	assert.deepEqual(await deleteResponse.json(), { deleted: true });

	const missingResponse = await handleHistoryAdminRequest(
		timelineRequest("DELETE", `/api/admin/history/timelines/${created.timelineId}`),
		env,
	);
	assert.equal(missingResponse.status, 404);
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
