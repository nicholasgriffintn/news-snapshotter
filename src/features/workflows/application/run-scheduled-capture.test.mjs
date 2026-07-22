import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction } from "../../history/testing/extraction-fixture.mjs";
import { ingestExtraction } from "../../history/infrastructure/history-ingestion-repository.ts";
import { handleScheduledCapture } from "./run-scheduled-capture.ts";

test("dispatches priority one sites from the hourly schedule", async (context) => {
	const creations = [];
	const analysisMessages = [];
	const historyMessages = [];
	const logs = [];
	const scheduledTime = Date.UTC(2026, 6, 17, 9);
	const { database, sqlite } = await createHistoryTestDatabase();
	sqlite
		.prepare(
			`INSERT INTO processing_outbox (
				outbox_id, destination, message_json, created_at
			) VALUES (?, 'history-index', ?, ?)`,
		)
		.run(
			"history-index:missed",
			JSON.stringify({ failureKey: "missed.analysis-failure.json", kind: "failure" }),
			"2026-07-17T08:00:00.000Z",
		);
	const env = {
		ANALYSIS_QUEUE: {
			send: async (body, options) => analysisMessages.push({ body, options }),
		},
		HISTORY_DB: database,
		HISTORY_INDEX_QUEUE: {
			send: async (body) => historyMessages.push(body),
		},
		NEWS_SNAPSHOTTER: {
			create: async (options) => {
				creations.push(options);

				return {
					id: `workflow-${creations.length}`,
					status: async () => ({
						status: "queued",
					}),
				};
			},
		},
	};
	context.mock.method(console, "log", (message) => {
		logs.push(JSON.parse(message));
	});

	await handleScheduledCapture(
		{
			cron: "0 * * * *",
			scheduledTime,
		},
		env,
	);

	const dispatchedSites = creations.flatMap((creation) => {
		return creation.params.sites;
	});

	assert.ok(dispatchedSites.length > 0);
	assert.ok(
		dispatchedSites.every((site) => {
			return site.priority === 1;
		}),
	);
	assert.ok(
		creations.every((creation) => {
			return (
				creation.params.triggeredAt === "2026-07-17T09:00:00.000Z" &&
				creation.params.enqueueComparison === true
			);
		}),
	);
	assert.deepEqual(logs, [
		{
			batchId: "capture-2026-07-17T09-00-00-000Z",
			event: "scheduled-capture-dispatched",
			priority: 1,
			runnerCount: creations.length,
			siteCount: dispatchedSites.length,
			triggeredAt: "2026-07-17T09:00:00.000Z",
		},
	]);
	assert.deepEqual(analysisMessages, [
		{
			body: {
				cohortId: "uk-national-hourly",
				deadlineAt: "2026-07-17T09:45:00.000Z",
				kind: "finalise-window",
				windowId: "uk-national-hourly:2026-07-17T09:00:00.000Z",
			},
			options: { delaySeconds: 900 },
		},
	]);
	assert.deepEqual(historyMessages, [
		{ failureKey: "missed.analysis-failure.json", kind: "failure" },
	]);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM processing_outbox").get().count, 0);
	assert.equal(
		sqlite.prepare("SELECT expected_site_count FROM comparison_windows").get().expected_site_count,
		12,
	);
	sqlite.close();
});

test("queues the previous month for every indexed site from the monthly schedule", async (context) => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-bbc.json.gz",
		historyExtraction("capture-bbc", "2026-07-31T22:00:00.000Z"),
	);
	const guardian = historyExtraction("capture-guardian", "2026-07-31T22:00:00.000Z");
	guardian.capture.site = "guardian-uk";
	guardian.capture.sourceUrl = "https://www.theguardian.com/uk";
	await ingestExtraction(database, "capture-guardian.json.gz", guardian);
	const oldSite = historyExtraction("capture-old", "2026-06-30T22:00:00.000Z");
	oldSite.capture.site = "old-site";
	oldSite.capture.sourceUrl = "https://old.example";
	await ingestExtraction(database, "capture-old.json.gz", oldSite);
	const batches = [];
	const logs = [];
	context.mock.method(console, "log", (message) => logs.push(JSON.parse(message)));

	await handleScheduledCapture(
		{
			cron: "15 3 2,7,14 * *",
			scheduledTime: Date.UTC(2026, 7, 2, 3, 15),
		},
		{
			HISTORY_DB: database,
			HISTORY_INDEX_QUEUE: { sendBatch: async (batch) => batches.push(batch) },
		},
	);

	assert.deepEqual(
		batches.flat().map(({ body }) => body),
		[
			{ kind: "materialise-history-month", month: "2026-07", site: "bbc-home" },
			{ kind: "materialise-history-month", month: "2026-07", site: "guardian-uk" },
		],
	);
	assert.deepEqual(logs, [
		{
			event: "history-month-materialisation-enqueued",
			month: "2026-07",
			siteCount: 2,
			triggeredAt: "2026-08-02T03:15:00.000Z",
		},
	]);
	sqlite.close();
});

for (const [cron, priority] of [
	["15 2 * * *", 2],
	["30 2 * * 1", 3],
	["45 2 1 * *", 4],
]) {
	test(`returns a clear error for the reserved priority ${priority} schedule`, async () => {
		await assert.rejects(
			() => handleScheduledCapture({ cron, scheduledTime: Date.UTC(2026, 6, 17, 2, 15) }, {}),
			new RegExp(`Scheduled priority ${priority} captures are not enabled yet`),
		);
	});
}

test("rejects an unknown scheduled trigger instead of dispatching priority one", async () => {
	await assert.rejects(
		() =>
			handleScheduledCapture({ cron: "1 1 1 1 1", scheduledTime: Date.UTC(2026, 6, 17, 9) }, {}),
		/Unknown scheduled trigger: 1 1 1 1 1/,
	);
});
