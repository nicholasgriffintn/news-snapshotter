import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction, historyStory } from "../../history/testing/extraction-fixture.mjs";
import { ingestExtraction } from "../../history/infrastructure/history-ingestion-repository.ts";
import { ANALYSIS_STALE_AFTER_MS, COMPARISON_PIPELINE } from "../domain/pipeline.ts";
import {
	analysisGenerationAllowance,
	canaryGenerationAllowance,
	generationVariantForRun,
} from "../infrastructure/analysis-run-repository.ts";
import { annotateHomepage, runWorkersAi } from "../infrastructure/workers-ai-analysis.ts";
import { analyseCapture } from "./analyse-capture.ts";

test("batches homepage annotations within the inference time boundary", async () => {
	const batchSizes = [];
	const requestSignals = [];
	let activeRequests = 0;
	let maximumActiveRequests = 0;
	const evidence = Array.from({ length: 21 }, (_, index) => ({
		evidenceId: `e${index + 1}`,
		headline: `Headline ${index + 1}`,
		kind: "story",
		rank: index + 1,
	}));
	const result = await annotateHomepage(
		{
			aiGatewayLogId: null,
			run: async (_model, input, options) => {
				const batch = JSON.parse(input.messages[1].content).evidence;
				batchSizes.push(batch.length);
				requestSignals.push(options.signal);
				activeRequests += 1;
				maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
				await new Promise((resolve) => setTimeout(resolve, 0));
				activeRequests -= 1;

				const response = {
					annotations: batch.map((item) => ({
						confidence: 0.9,
						entities: [],
						evidenceId: item.evidenceId,
						framing: {},
						locations: [],
						normalisedLabel: item.headline,
						topics: [],
					})),
				};

				if (batchSizes.length === 1) {
					return {
						choices: [{ message: { content: JSON.stringify(response) } }],
						usage: { completion_tokens: 20, prompt_tokens: 40 },
					};
				}

				return {
					response: JSON.stringify(response),
					usage: { completion_tokens: 20, prompt_tokens: 40 },
				};
			},
		},
		evidence,
	);

	assert.deepEqual(batchSizes, [5, 5, 5, 5, 1]);
	assert.equal(maximumActiveRequests, 5);
	assert.equal(
		requestSignals.every((signal) => signal instanceof AbortSignal),
		true,
	);
	assert.equal(COMPARISON_PIPELINE.inferenceTimeoutMs < ANALYSIS_STALE_AFTER_MS, true);
	assert.equal(result.output.annotations.length, 21);
	assert.equal(result.inputTokens, 200);
	assert.equal(result.outputTokens, 100);
});

test("ends a Workers AI request when the binding ignores cancellation", async () => {
	let requestSignal;

	await assert.rejects(
		() =>
			runWorkersAi((signal) => {
				requestSignal = signal;
				return new Promise(() => undefined);
			}, 1),
		(error) => error.name === "TimeoutError",
	);

	assert.equal(requestSignal.aborted, true);
});

test("runs a bounded homepage analysis once and persists its evidence lineage", async (context) => {
	context.mock.method(console, "log", () => undefined);
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("bbc-news:desktop:test", "2026-07-20T09:05:00.000Z");
	capture.capture.site = "bbc-news";
	capture.capture.sourceUrl = "https://www.bbc.co.uk/news";
	await ingestExtraction(database, "bbc-news.extraction.v1.json.gz", capture);
	const artefacts = new Map();
	const vectors = [];
	const vectorQueries = [];
	const generationModels = [];
	const env = {
		AI: {
			aiGatewayLogId: "gateway-log-1",
			run: async (model) => {
				if (model.includes("embeddinggemma")) {
					return { data: [Array.from({ length: 768 }, () => 0.1)], shape: [1, 768] };
				}
				generationModels.push(model);
				return {
					response: JSON.stringify({
						annotations: [
							{
								confidence: 0.96,
								entities: ["Bank of England"],
								evidenceId: "e1",
								framing: { emphasis: ["interest rates"] },
								locations: ["United Kingdom"],
								normalisedLabel: "Bank of England interest rates decision",
								topics: ["economy"],
							},
						],
					}),
					usage: { completion_tokens: 40, prompt_tokens: 120 },
				};
			},
		},
		ARCHIVE_DATA: {
			head: async (key) => (artefacts.has(key) ? {} : null),
			put: async (key, value) => artefacts.set(key, value),
		},
		COMPARISON_CANARY_MODEL: "@cf/example/canary",
		COMPARISON_CANARY_PERCENT: "100",
		HISTORY_DB: database,
		STORY_VECTORS: {
			query: async (_embedding, options) => {
				vectorQueries.push(options);
				return { count: 0, matches: [] };
			},
			upsert: async (items) => vectors.push(...items),
		},
	};

	const first = await analyseCapture(env, {
		captureId: capture.capture.captureId,
		contentHash: capture.contentHash,
	});
	sqlite
		.prepare(
			`UPDATE analysis_runs
			SET status = 'running', started_at = ?, completed_at = NULL
			WHERE capture_id = ?`,
		)
		.run(new Date().toISOString(), capture.capture.captureId);
	await assert.rejects(
		() =>
			analyseCapture(env, {
				captureId: capture.capture.captureId,
				contentHash: capture.contentHash,
			}),
		/Capture analysis is already active/,
	);
	sqlite
		.prepare("UPDATE analysis_runs SET status = 'succeeded', completed_at = ? WHERE capture_id = ?")
		.run(new Date().toISOString(), capture.capture.captureId);
	const second = await analyseCapture(env, {
		captureId: capture.capture.captureId,
		contentHash: capture.contentHash,
	});

	assert.equal(first.status, "succeeded");
	assert.deepEqual(first.windows, [
		{
			cohortId: "uk-national-hourly",
			windowId: "uk-national-hourly:2026-07-20T09:00:00.000Z",
		},
	]);
	assert.equal(second.status, "skipped");
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM analysis_runs").get().count, 1);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM content_annotations").get().count, 1);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM comparison_stories").get().count, 1);
	assert.equal(
		sqlite.prepare("SELECT status FROM comparison_window_sites WHERE site = 'bbc-news'").get()
			.status,
		"analysed",
	);
	assert.equal(artefacts.size, 2);
	assert.equal(vectorQueries[0].filter.embeddingVersion, 2);
	assert.equal(vectors.length, 1);
	assert.deepEqual(generationModels, ["@cf/example/canary"]);
	assert.equal(
		sqlite.prepare("SELECT model FROM analysis_runs LIMIT 1").get().model,
		"@cf/example/canary",
	);
	assert.deepEqual(Object.keys(vectors[0].metadata).sort(), [
		"capturedEpoch",
		"cohort",
		"embeddingVersion",
		"language",
		"site",
	]);

	env.COMPARISON_CANARY_MODEL = "";
	env.COMPARISON_CANARY_PERCENT = "0";
	const replacement = await analyseCapture(env, {
		captureId: capture.capture.captureId,
		contentHash: capture.contentHash,
	});

	assert.equal(replacement.status, "succeeded");
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM analysis_runs").get().count, 2);
	assert.equal(
		sqlite
			.prepare(
				`SELECT COUNT(*) AS count FROM story_memberships
				WHERE capture_id = ? AND active = 1`,
			)
			.get(capture.capture.captureId).count,
		1,
	);
	assert.equal(
		sqlite
			.prepare(
				`SELECT COUNT(*) AS count FROM story_memberships sm
				JOIN analysis_runs ar ON ar.run_id = sm.annotation_run_id
				WHERE sm.capture_id = ? AND sm.active = 1 AND ar.model = ?`,
			)
			.get(capture.capture.captureId, COMPARISON_PIPELINE.generationModel).count,
		1,
	);
	sqlite.close();
});

test("clusters matching publishers before a new vector is queryable", async (context) => {
	context.mock.method(console, "log", () => undefined);
	const { database, sqlite } = await createHistoryTestDatabase();
	const capturedAt = "2026-07-20T09:05:00.000Z";
	const bbc = historyExtraction("bbc-news:desktop:cluster", capturedAt, {
		elements: [
			historyStory({
				headline: "Spain wins World Cup against Argentina",
			}),
		],
	});
	bbc.capture.site = "bbc-news";
	bbc.capture.sourceUrl = "https://www.bbc.co.uk/news";
	const guardian = historyExtraction("guardian-uk:desktop:cluster", capturedAt, {
		elements: [
			historyStory({
				canonicalUrl: "https://www.theguardian.com/football/world-cup-final",
				elementKey: "https://www.theguardian.com/football/world-cup-final",
				headline: "Spain winning the World Cup final against Argentina",
			}),
		],
	});
	guardian.capture.site = "guardian-uk";
	guardian.capture.sourceUrl = "https://www.theguardian.com/uk";

	await ingestExtraction(database, "bbc-news.cluster.extraction.v1.json.gz", bbc);
	await ingestExtraction(database, "guardian-uk.cluster.extraction.v1.json.gz", guardian);

	let vectorQueries = 0;
	const env = {
		AI: {
			aiGatewayLogId: null,
			run: async (model, input) => {
				if (model.includes("embeddinggemma")) {
					return {
						data: input.text.map(() => Array.from({ length: 768 }, () => 0.1)),
					};
				}
				const evidence = JSON.parse(input.messages[1].content).evidence[0];
				return {
					response: JSON.stringify({
						annotations: [
							{
								confidence: 0.96,
								entities: ["Spain", "Argentina", "World Cup"],
								evidenceId: evidence.evidenceId,
								framing: {},
								locations: [],
								normalisedLabel: evidence.headline,
								topics: ["sport"],
							},
						],
					}),
				};
			},
		},
		ARCHIVE_DATA: {
			head: async () => null,
			put: async () => undefined,
		},
		HISTORY_DB: database,
		STORY_VECTORS: {
			query: async () => {
				vectorQueries += 1;
				return { count: 0, matches: [] };
			},
			upsert: async () => undefined,
		},
	};

	assert.equal(
		(
			await analyseCapture(env, {
				captureId: bbc.capture.captureId,
				contentHash: bbc.contentHash,
			})
		).status,
		"succeeded",
	);
	assert.equal(
		(
			await analyseCapture(env, {
				captureId: guardian.capture.captureId,
				contentHash: guardian.contentHash,
			})
		).status,
		"succeeded",
	);

	assert.equal(vectorQueries, 1);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM comparison_stories").get().count, 1);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM story_memberships").get().count, 2);
	assert.deepEqual(
		sqlite
			.prepare(
				`SELECT membership_reason FROM story_memberships
				ORDER BY created_at, site`,
			)
			.all()
			.map(({ membership_reason }) => membership_reason),
		["new-story", "recent-label-and-entity-overlap"],
	);

	sqlite.close();
});

test("routes a regressing canary back to the primary model", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const insertRun = sqlite.prepare(
		`INSERT INTO analysis_runs (
			run_id, idempotency_key, kind, input_hash, pipeline_version, taxonomy_version,
			prompt_version, schema_version, model, status, created_at, completed_at
		) VALUES (?, ?, 'capture-annotation', ?, 1, 1, 1, 1, ?, ?, ?, ?)`,
	);
	const now = new Date();
	const timestamp = now.toISOString();
	const canaryModel = "@cf/example/regressing-canary";

	for (let index = 0; index < COMPARISON_PIPELINE.minimumCanaryRuns; index += 1) {
		insertRun.run(
			`primary-${index}`,
			`primary-${index}`,
			`primary-${index}`,
			COMPARISON_PIPELINE.generationModel,
			"succeeded",
			timestamp,
			timestamp,
		);
		insertRun.run(
			`canary-${index}`,
			`canary-${index}`,
			`canary-${index}`,
			canaryModel,
			"failed",
			timestamp,
			timestamp,
		);
	}

	const allowance = await canaryGenerationAllowance(
		database,
		canaryModel,
		COMPARISON_PIPELINE.generationModel,
		now,
	);
	assert.equal(allowance.allowed, false);
	assert.equal(allowance.canaryDegradedRate, 1);
	assert.equal(allowance.primaryDegradedRate, 0);
	sqlite
		.prepare("DELETE FROM analysis_runs WHERE model = ?")
		.run(COMPARISON_PIPELINE.generationModel);
	const allowanceWithoutBaseline = await canaryGenerationAllowance(
		database,
		canaryModel,
		COMPARISON_PIPELINE.generationModel,
		now,
	);
	assert.equal(allowanceWithoutBaseline.allowed, false);
	assert.equal(allowanceWithoutBaseline.primaryRuns, 0);
	assert.deepEqual(
		await generationVariantForRun(database, "0".repeat(64), {
			canaryModel,
			canaryPercent: "100",
		}),
		{
			canarySuppressed: true,
			model: COMPARISON_PIPELINE.generationModel,
			rollout: "primary",
		},
	);

	sqlite.close();
});

test("pauses generation after recent failures or the token budget is exhausted", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const capture = historyExtraction("bbc-news:desktop:circuit", new Date().toISOString());
	capture.capture.site = "bbc-news";
	capture.capture.sourceUrl = "https://www.bbc.co.uk/news";
	await ingestExtraction(database, "bbc-news.circuit.extraction.v1.json.gz", capture);
	const createdAt = new Date().toISOString();
	const insertRun = sqlite.prepare(
		`INSERT INTO analysis_runs (
			run_id, idempotency_key, kind, input_hash, pipeline_version, taxonomy_version,
			prompt_version, schema_version, model, status, input_tokens, output_tokens,
			created_at
		) VALUES (?, ?, 'capture-annotation', ?, 1, 1, 1, 1, 'test-model', ?, ?, ?, ?)`,
	);

	for (let index = 0; index < COMPARISON_PIPELINE.maxGenerationFailuresPerWindow; index += 1) {
		insertRun.run(
			`failed-${index}`,
			`failed-${index}`,
			`failed-${index}`,
			"failed",
			null,
			null,
			createdAt,
		);
	}

	let aiCalls = 0;
	await assert.rejects(
		() =>
			analyseCapture(
				{
					AI: { run: async () => (aiCalls += 1) },
					ARCHIVE_DATA: {},
					HISTORY_DB: database,
					STORY_VECTORS: {},
				},
				{
					captureId: capture.capture.captureId,
					contentHash: capture.contentHash,
				},
			),
		/paused by failure-threshold/,
	);
	assert.equal(aiCalls, 0);
	const circuitRun = sqlite
		.prepare("SELECT status, error_code FROM analysis_runs WHERE capture_id = ?")
		.get(capture.capture.captureId);
	assert.equal(circuitRun.status, "failed");
	assert.equal(circuitRun.error_code, "analysis-circuit-open");

	sqlite.prepare("DELETE FROM analysis_runs").run();
	insertRun.run(
		"token-budget",
		"token-budget",
		"token-budget",
		"succeeded",
		COMPARISON_PIPELINE.maxTokensPerGenerationWindow,
		0,
		createdAt,
	);
	sqlite
		.prepare("UPDATE analysis_runs SET created_at = ?, completed_at = ? WHERE run_id = ?")
		.run("2020-01-01T00:00:00.000Z", createdAt, "token-budget");
	assert.deepEqual(await analysisGenerationAllowance(database), {
		allowed: false,
		failureCount: 0,
		reason: "token-threshold",
		tokenCount: COMPARISON_PIPELINE.maxTokensPerGenerationWindow,
	});

	sqlite.close();
});
