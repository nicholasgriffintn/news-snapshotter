import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { ingestExtraction } from "../../history/infrastructure/history-ingestion-repository.ts";
import { historyExtraction } from "../../history/testing/extraction-fixture.mjs";
import { handleComparisonAdminRequest } from "./comparison-admin.ts";
import { claimCaptureAnalysisRun } from "../infrastructure/analysis-run-repository.ts";

test("requeues bounded capture batches through the normal idempotent analysis consumer", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("bbc-news:desktop:admin", "2026-07-20T09:00:00.000Z");
	capture.capture.site = "bbc-news";
	await ingestExtraction(database, "bbc-news.extraction.v1.json.gz", capture);
	const secondCapture = historyExtraction("guardian-uk:desktop:admin", "2026-07-20T09:00:00.000Z");
	secondCapture.capture.site = "guardian-uk";
	await ingestExtraction(database, "guardian-uk.extraction.v1.json.gz", secondCapture);
	const messages = [];
	const response = await handleComparisonAdminRequest(
		new Request("https://example.com/api/admin/comparison/requeue", {
			body: JSON.stringify({
				captureIds: [capture.capture.captureId, secondCapture.capture.captureId],
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{
			ANALYSIS_QUEUE: { send: async (message) => messages.push(message) },
			HISTORY_DB: database,
		},
	);

	assert.equal(response.status, 202);
	assert.deepEqual(messages, [
		{
			captureId: capture.capture.captureId,
			contentHash: capture.contentHash,
			finaliseAfterAnalysis: true,
			kind: "analyse-capture",
		},
		{
			captureId: secondCapture.capture.captureId,
			contentHash: secondCapture.contentHash,
			finaliseAfterAnalysis: true,
			kind: "analyse-capture",
		},
	]);
	assert.deepEqual(await response.json(), {
		captureIds: [capture.capture.captureId, secondCapture.capture.captureId],
		pipelineVersion: 4,
		status: "queued",
	});

	await claimCaptureAnalysisRun(database, {
		captureId: capture.capture.captureId,
		idempotencyKey: "stale-run",
		inputHash: "stale-input",
	});
	sqlite
		.prepare("UPDATE analysis_runs SET started_at = ? WHERE idempotency_key = ?")
		.run("2020-01-01T00:00:00.000Z", "stale-run");

	const staleResponse = await handleComparisonAdminRequest(
		new Request("https://example.com/api/admin/comparison/runs?status=stale"),
		{ HISTORY_DB: database },
	);
	const stale = await staleResponse.json();

	assert.equal(stale.runs.length, 1);
	assert.equal(stale.runs[0].capture_id, capture.capture.captureId);
	assert.equal(stale.runs[0].site, "bbc-news");
	sqlite.close();
});

test("analysis claims do not duplicate active runs and can explicitly retry failures", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("bbc-news:desktop:claim", "2026-07-20T10:00:00.000Z");
	capture.capture.site = "bbc-news";
	await ingestExtraction(database, "bbc-news.claim.extraction.v1.json.gz", capture);
	const identity = {
		captureId: capture.capture.captureId,
		idempotencyKey: "claim-run",
		inputHash: "claim-input",
	};

	const first = await claimCaptureAnalysisRun(database, identity);
	const active = await claimCaptureAnalysisRun(database, identity);

	assert.equal(first.disposition, "claimed");
	assert.equal(active.disposition, "active");

	sqlite
		.prepare(
			`UPDATE analysis_runs
			SET status = 'failed', error_code = 'analysis-terminal', completed_at = ?
			WHERE idempotency_key = ?`,
		)
		.run(new Date().toISOString(), identity.idempotencyKey);

	const retry = await claimCaptureAnalysisRun(database, identity);
	assert.equal(retry.disposition, "claimed");
	assert.equal(
		sqlite
			.prepare("SELECT attempt_count FROM analysis_runs WHERE idempotency_key = ?")
			.get(identity.idempotencyKey).attempt_count,
		2,
	);

	sqlite.close();
});

test("rejects invalid or partially missing requeue batches before enqueueing", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("bbc-news:desktop:batch", "2026-07-20T11:00:00.000Z");
	capture.capture.site = "bbc-news";
	await ingestExtraction(database, "bbc-news.batch.extraction.v1.json.gz", capture);
	const messages = [];
	const env = {
		ANALYSIS_QUEUE: { send: async (message) => messages.push(message) },
		HISTORY_DB: database,
	};
	const missing = await handleComparisonAdminRequest(
		new Request("https://example.com/api/admin/comparison/requeue", {
			body: JSON.stringify({ captureIds: [capture.capture.captureId, "missing"] }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		env,
	);

	assert.equal(missing.status, 404);
	assert.equal(messages.length, 0);
	await assert.rejects(
		() =>
			handleComparisonAdminRequest(
				new Request("https://example.com/api/admin/comparison/requeue", {
					body: JSON.stringify({
						captureIds: [capture.capture.captureId, capture.capture.captureId],
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				env,
			),
		/capture identifiers are invalid/,
	);

	sqlite.close();
});
