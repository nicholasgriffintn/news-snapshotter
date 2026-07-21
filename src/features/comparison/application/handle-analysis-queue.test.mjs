import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { ingestExtraction } from "../../history/infrastructure/history-ingestion-repository.ts";
import { historyExtraction } from "../../history/testing/extraction-fixture.mjs";
import { COMPARISON_COHORTS } from "../domain/configuration.ts";
import {
	comparisonWindowProgress,
	ensureComparisonWindow,
	markWindowSite,
} from "../infrastructure/comparison-window-repository.ts";
import { processAnalysisMessage } from "./handle-analysis-queue.ts";

test("waits for expected captures until the deadline, then records an abstaining window", async (context) => {
	context.mock.method(console, "log", () => undefined);
	const { database, sqlite } = await createHistoryTestDatabase();
	const cohort = COMPARISON_COHORTS[0];
	const window = await ensureComparisonWindow(
		database,
		cohort,
		[{ name: "bbc-news" }, { name: "guardian-uk" }],
		"2026-07-20T09:00:00.000Z",
	);
	const queued = [];
	const env = {
		ANALYSIS_QUEUE: { send: async (body, options) => queued.push({ body, options }) },
		HISTORY_DB: database,
	};
	const message = {
		cohortId: cohort.id,
		deadlineAt: "2099-07-20T09:45:00.000Z",
		kind: "finalise-window",
		windowId: window.windowId,
	};

	await processAnalysisMessage(env, message);
	assert.equal(queued.length, 1);
	assert.equal(
		sqlite.prepare("SELECT status FROM comparison_windows WHERE window_id = ?").get(window.windowId)
			.status,
		"pending",
	);

	await processAnalysisMessage(env, { ...message, deadlineAt: "2020-07-20T09:45:00.000Z" });
	assert.equal(
		sqlite.prepare("SELECT status FROM comparison_windows WHERE window_id = ?").get(window.windowId)
			.status,
		"suppressed",
	);
	sqlite.close();
});

test("analysis failure does not erase a successful publisher capture", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const cohort = COMPARISON_COHORTS[0];
	const capture = historyExtraction(
		"bbc-news:desktop:2026-07-20T10:00:00.000Z",
		"2026-07-20T10:00:00.000Z",
	);
	capture.capture.site = "bbc-news";
	await ingestExtraction(database, "bbc-news.window.extraction.v1.json.gz", capture);
	const window = await ensureComparisonWindow(
		database,
		cohort,
		[{ name: "bbc-news" }, { name: "guardian-uk" }],
		"2026-07-20T10:00:00.000Z",
	);

	await markWindowSite(database, window.windowId, "bbc-news", "captured", {
		captureId: capture.capture.captureId,
	});
	await markWindowSite(database, window.windowId, "bbc-news", "failed", {
		captureId: capture.capture.captureId,
		failureReason: "AI timed out",
	});

	assert.deepEqual(await comparisonWindowProgress(database, window.windowId), {
		analysedSites: 0,
		capturedSites: 1,
		expectedSites: 2,
	});

	await markWindowSite(database, window.windowId, "bbc-news", "analysed", {
		captureId: capture.capture.captureId,
	});
	await markWindowSite(database, window.windowId, "bbc-news", "captured", {
		captureId: capture.capture.captureId,
	});
	await markWindowSite(database, window.windowId, "bbc-news", "failed", {
		captureId: capture.capture.captureId,
		failureReason: "Replacement analysis timed out",
	});

	assert.deepEqual(await comparisonWindowProgress(database, window.windowId), {
		analysedSites: 1,
		capturedSites: 1,
		expectedSites: 2,
	});
	assert.equal(
		sqlite
			.prepare(
				"SELECT status FROM comparison_window_sites WHERE window_id = ? AND site = 'bbc-news'",
			)
			.get(window.windowId).status,
		"analysed",
	);

	sqlite.close();
});
