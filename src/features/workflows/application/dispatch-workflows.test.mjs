import assert from "node:assert/strict";
import test from "node:test";

import { dispatchCaptureWorkflows } from "./dispatch-workflows.ts";

function site(index) {
	return {
		brand: `brand-${index}`,
		captureRegion: "uk",
		category: "news",
		name: `site-${index}`,
		priority: 1,
		url: `https://site-${index}.example`,
	};
}

test("returns successful workflow identifiers when a sibling shard fails to dispatch", async () => {
	let call = 0;
	const result = await dispatchCaptureWorkflows(
		{
			NEWS_SNAPSHOTTER: {
				create: async () => {
					call += 1;
					if (call === 2) {
						throw new Error("Workflow service unavailable");
					}
					return { id: "workflow-1", status: async () => ({ status: "queued" }) };
				},
			},
		},
		Array.from({ length: 11 }, (_, index) => site(index)),
		"2026-07-22T10:00:00.000Z",
		false,
	);

	assert.deepEqual(result.workflowIds, ["workflow-1"]);
	assert.equal(result.runnerCount, 2);
	assert.equal(result.failedRunnerCount, 1);
	assert.equal(result.workflows[1].status, "dispatch-failed");
	assert.match(result.workflows[1].error, /Workflow service unavailable/);
});

test("keeps a created workflow identifier when its initial status lookup fails", async () => {
	const result = await dispatchCaptureWorkflows(
		{
			NEWS_SNAPSHOTTER: {
				create: async () => ({
					id: "workflow-created",
					status: async () => {
						throw new Error("Status service unavailable");
					},
				}),
			},
		},
		[site(1)],
		"2026-07-22T10:00:00.000Z",
		false,
	);

	assert.deepEqual(result.workflowIds, ["workflow-created"]);
	assert.equal(result.failedRunnerCount, 0);
	assert.equal(result.workflows[0].status.status, "unavailable");
});
