import assert from "node:assert/strict";
import test from "node:test";

import {
	COMPARISON_PIPELINE,
	analysisIdempotencyKey,
	analysisRetryDelaySeconds,
	comparisonWindowPeriod,
	isRetryableAnalysisError,
	prioritiseWindowStories,
	selectGenerationVariant,
	TerminalAnalysisError,
	TransientAnalysisError,
	windowPublicationStatus,
} from "./pipeline.ts";

test("analysis identity includes every interpretation version and model", async () => {
	const key = await analysisIdempotencyKey("capture-content-hash", "capture-annotation");

	assert.match(key, /^[a-f0-9]{64}$/);
	assert.equal(await analysisIdempotencyKey("capture-content-hash", "capture-annotation"), key);
	assert.equal(COMPARISON_PIPELINE.embeddingDimensions, 768);
	assert.notEqual(
		await analysisIdempotencyKey(
			"capture-content-hash",
			"capture-annotation",
			"@cf/example/canary",
		),
		key,
	);
});

test("model canaries use stable bounded routing and reject invalid configuration", () => {
	const canary = { canaryModel: "@cf/example/canary", canaryPercent: "10" };

	assert.deepEqual(selectGenerationVariant("0".repeat(64), canary), {
		model: "@cf/example/canary",
		rollout: "canary",
	});
	assert.deepEqual(selectGenerationVariant("f".repeat(64), canary), {
		model: COMPARISON_PIPELINE.generationModel,
		rollout: "primary",
	});
	assert.throws(
		() =>
			selectGenerationVariant("0".repeat(64), {
				canaryModel: "external-model",
				canaryPercent: "10",
			}),
		/canary configuration is invalid/,
	);
});

test("analysis retries use bounded exponential delays", () => {
	assert.equal(analysisRetryDelaySeconds(1), 60);
	assert.equal(analysisRetryDelaySeconds(3), 240);
	assert.equal(analysisRetryDelaySeconds(20), 3_600);
});

test("analysis retries only transient platform failures", () => {
	assert.equal(isRetryableAnalysisError(new Error("504 Gateway Time-out")), true);
	assert.equal(isRetryableAnalysisError(new Error("429 Too Many Requests")), true);
	assert.equal(isRetryableAnalysisError(new Error("fetch failed")), true);
	assert.equal(isRetryableAnalysisError(new Error("Network connection lost")), true);
	assert.equal(isRetryableAnalysisError(new Error("5028: This model was deprecated")), false);
	assert.equal(
		isRetryableAnalysisError(new Error("5025: This model does not support JSON Schema")),
		false,
	);
	assert.equal(
		isRetryableAnalysisError(new TerminalAnalysisError("Invalid evidence response")),
		false,
	);
	assert.equal(
		isRetryableAnalysisError(new TransientAnalysisError("Generation circuit is open")),
		true,
	);
});

test("window publication abstains when too few captures were analysed", () => {
	assert.equal(
		windowPublicationStatus({
			analysedSites: 5,
			capturedSites: 5,
			expectedSites: 6,
			minimumSites: 4,
		}),
		"partial",
	);
	assert.equal(
		windowPublicationStatus({
			analysedSites: 3,
			capturedSites: 5,
			expectedSites: 6,
			minimumSites: 4,
		}),
		"suppressed",
	);
});

test("comparison windows are deterministic and aligned to the cohort interval", () => {
	assert.deepEqual(
		comparisonWindowPeriod(
			{
				id: "uk-news",
				windowMinutes: 60,
			},
			"2026-07-20T09:42:13.000Z",
		),
		{
			endsAt: "2026-07-20T10:00:00.000Z",
			startsAt: "2026-07-20T09:00:00.000Z",
			windowId: "uk-news:2026-07-20T09:00:00.000Z",
		},
	);
});

test("story generation is capped by deterministic editorial priority", () => {
	const stories = [
		{
			evidence: [
				{ prominence: "lead", rank: 1 },
				{ prominence: "major", rank: 2 },
			],
			storyId: "two-sources",
		},
		{
			evidence: [
				{ prominence: "minor", rank: 20 },
				{ prominence: "minor", rank: 30 },
				{ prominence: "minor", rank: 40 },
			],
			storyId: "three-sources",
		},
		{
			evidence: [
				{ prominence: "standard", rank: 8 },
				{ prominence: "standard", rank: 9 },
			],
			storyId: "lower-prominence",
		},
	];

	assert.deepEqual(
		prioritiseWindowStories(stories, 2).map(({ storyId }) => storyId),
		["three-sources", "two-sources"],
	);
});
