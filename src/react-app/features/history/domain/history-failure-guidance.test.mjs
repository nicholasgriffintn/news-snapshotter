import assert from "node:assert/strict";
import test from "node:test";

import {
	groupHistoryFailures,
	historyFailureGuidance,
	historyFailureLogHref,
} from "./history-failure-guidance.ts";

test("explains known failure stages with a concrete recovery path", () => {
	assert.deepEqual(historyFailureGuidance("validation"), {
		label: "Capture analysis failed",
		meaning:
			"The screenshot was saved, but structured analysis did not complete or pass its checks.",
		resolution: "Review the private error, correct the capture or extractor issue, then recapture.",
	});
	assert.deepEqual(historyFailureGuidance("indexing"), {
		label: "Archive indexing failed",
		meaning: "An archived analysis could not be added to structured history.",
		resolution: "Review the private error, correct the indexing issue, then backfill this site.",
	});
});

test("groups failure records by stage and retains their newest-first order", () => {
	const failures = [
		{
			captureId: "capture-3",
			device: "desktop",
			failedAt: "2026-07-19T12:00:00Z",
			stage: "indexing",
		},
		{
			captureId: "capture-2",
			device: "desktop",
			failedAt: "2026-07-19T11:00:00Z",
			stage: "validation",
		},
		{
			captureId: "capture-1",
			device: "desktop",
			failedAt: "2026-07-19T10:00:00Z",
			stage: "indexing",
		},
	];

	assert.deepEqual(
		groupHistoryFailures(failures).map((group) => ({
			captureIds: group.failures.map((failure) => failure.captureId),
			stage: group.stage,
		})),
		[
			{ captureIds: ["capture-3", "capture-1"], stage: "indexing" },
			{ captureIds: ["capture-2"], stage: "validation" },
		],
	);
});

test("links history failures to the filtered failure log", () => {
	assert.equal(historyFailureLogHref("bbc-home"), "/admin?tool=failures&site=bbc-home");
});
