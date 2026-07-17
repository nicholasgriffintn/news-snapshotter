import assert from "node:assert/strict";
import test from "node:test";

import { handleScheduledCapture } from "./scheduled-captures.ts";

test("dispatches priority one sites from the hourly schedule", async (context) => {
	const creations = [];
	const logs = [];
	const scheduledTime = Date.UTC(2026, 6, 17, 9);
	const env = {
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
			return creation.params.triggeredAt === "2026-07-17T09:00:00.000Z";
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
});
