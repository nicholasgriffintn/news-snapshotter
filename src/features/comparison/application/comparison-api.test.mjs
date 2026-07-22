import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { historyExtraction } from "../../history/testing/extraction-fixture.mjs";
import { ingestExtraction } from "../../history/infrastructure/history-ingestion-repository.ts";
import { analyseCapture } from "./analyse-capture.ts";
import { handleComparisonAdminRequest } from "./comparison-admin.ts";
import { handleComparisonRequest } from "./comparison-api.ts";
import { publishWindowStories } from "./publish-window-stories.ts";

function annotationResponse(headline = "") {
	const distinctStory = headline.includes("Royal family");
	return {
		response: JSON.stringify({
			annotations: [
				{
					confidence: 0.97,
					entities: distinctStory ? ["Royal family"] : ["Bank of England"],
					evidenceId: "e1",
					framing: {
						emphasis: distinctStory ? ["summer event"] : ["interest rates"],
					},
					locations: ["United Kingdom"],
					normalisedLabel: distinctStory
						? "Royal family attends summer event"
						: "Bank of England interest rates decision",
					topics: distinctStory ? ["monarchy"] : ["economy"],
				},
			],
		}),
		usage: { completion_tokens: 30, prompt_tokens: 100 },
	};
}

function storyComparisonResponse() {
	return {
		response: JSON.stringify({
			commonGround: [
				{
					evidenceIds: ["source-1", "source-2"],
					statement: "Both headlines concern the Bank of England interest-rate decision.",
				},
			],
			confidence: 0.93,
			differences: [
				{
					evidenceIds: ["source-1", "source-2"],
					statement: "The headlines give different emphasis to the decision.",
				},
			],
			summary: "The Bank of England made an interest-rate decision.",
		}),
		usage: { completion_tokens: 50, prompt_tokens: 120 },
	};
}

test("rejects invalid comparison query and feedback input through the HTTP interface", async () => {
	const env = {};
	const requests = [
		new Request("https://example.com/api/comparison/stories?limit=101"),
		new Request("https://example.com/api/comparison/gaps?limit=0"),
		new Request("https://example.com/api/comparison/stories?from=2026-07-01T00:00:00.000Z"),
		new Request(
			"https://example.com/api/comparison/publishers/bbc-news" +
				"?from=2026-01-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z",
		),
		new Request("https://example.com/api/comparison/feedback", {
			body: JSON.stringify({
				reason: "incorrect",
				revisionId: "revision-1",
				trusted: true,
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
	];

	for (const request of requests) {
		const response = await handleComparisonRequest(request, env);

		assert.equal(response.status, 400);
		assert.equal((await response.json()).status, "error");
	}
});

test("serves only published, evidence-linked comparison revisions", async (context) => {
	context.mock.method(console, "log", () => undefined);
	const { database, sqlite } = await createHistoryTestDatabase();
	const artefacts = new Map();
	const emails = [];
	const vectors = [];
	const env = {
		AI: {
			aiGatewayLogId: "log-1",
			run: async (model, _input, options) => {
				assert.equal(options?.gateway, undefined);

				if (model.includes("embeddinggemma")) {
					return {
						data: [Array.from({ length: 768 }, () => 0.1)],
						shape: [1, 768],
					};
				}

				if (options?.tags?.includes("story-comparison")) {
					return storyComparisonResponse();
				}
				const evidence = JSON.parse(_input.messages[1].content).evidence[0];
				return annotationResponse(evidence.headline);
			},
		},
		ARCHIVE_DATA: {
			head: async (key) => (artefacts.has(key) ? {} : null),
			put: async (key, value) => artefacts.set(key, value),
		},
		COMPARISON_CANARY_MODEL: "@cf/example/canary",
		COMPARISON_CANARY_PERCENT: "100",
		COMPARISON_FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: true }) },
		CONTACT_EMAIL: { send: async (message) => emails.push(message) },
		HISTORY_DB: database,
		STORY_VECTORS: {
			query: async () => ({
				count: vectors.length,
				matches: vectors.map((vector) => ({ ...vector, score: 0.96 })),
			}),
			upsert: async (items) => vectors.push(...items),
		},
	};
	for (const [site, sourceUrl] of [
		["bbc-news", "https://www.bbc.co.uk/news"],
		["guardian-uk", "https://www.theguardian.com/uk"],
		["times-com", "https://www.thetimes.com"],
	]) {
		const capture = historyExtraction(`${site}:desktop:test`, "2026-07-20T09:05:00.000Z");
		capture.capture.site = site;
		capture.capture.sourceUrl = sourceUrl;
		capture.elements[0].canonicalUrl = `${sourceUrl}/story`;
		capture.elements[0].prominence = "lead";
		await ingestExtraction(database, `${site}.extraction.v1.json.gz`, capture);
		await analyseCapture(env, {
			captureId: capture.capture.captureId,
			contentHash: capture.contentHash,
		});
	}
	const laterBbcCapture = historyExtraction("bbc-news:desktop:later", "2026-07-20T10:05:00.000Z");
	laterBbcCapture.capture.site = "bbc-news";
	laterBbcCapture.capture.sourceUrl = "https://www.bbc.co.uk/news";
	laterBbcCapture.elements[0].headline = "Bank keeps interest rates unchanged";
	laterBbcCapture.elements[0].canonicalUrl = "https://www.bbc.co.uk/news/story";
	laterBbcCapture.elements[0].prominence = "lead";
	await ingestExtraction(database, "bbc-news-later.extraction.v1.json.gz", laterBbcCapture);
	await analyseCapture(env, {
		captureId: laterBbcCapture.capture.captureId,
		contentHash: laterBbcCapture.contentHash,
	});
	const windowId = "uk-national-hourly:2026-07-20T09:00:00.000Z";
	const missingCapture = historyExtraction(
		"dailymail-home:desktop:test",
		"2026-07-20T09:05:00.000Z",
	);
	missingCapture.capture.site = "dailymail-home";
	missingCapture.capture.sourceUrl = "https://www.dailymail.co.uk/home/index.html";
	missingCapture.elements[0].headline = "Royal family attends summer event";
	missingCapture.elements[0].canonicalUrl = "https://www.dailymail.co.uk/royal-family-event";
	missingCapture.elements[0].prominence = "lead";
	await ingestExtraction(database, "dailymail-home.extraction.v1.json.gz", missingCapture);
	await analyseCapture(env, {
		captureId: missingCapture.capture.captureId,
		contentHash: missingCapture.contentHash,
	});
	sqlite
		.prepare(
			`UPDATE comparison_windows
			SET status = 'partial', captured_site_count = 4, analysed_site_count = 4,
				finalised_at = ?
			WHERE window_id = ?`,
		)
		.run("2026-07-20T10:15:00.000Z", windowId);
	assert.equal(
		await publishWindowStories(env, {
			cohortId: "uk-national-hourly",
			windowId,
		}),
		1,
	);

	const listResponse = await handleComparisonRequest(
		new Request("https://example.com/api/comparison/stories"),
		env,
	);
	assert.equal(listResponse.status, 200);
	const list = await listResponse.json();
	assert.equal(list.stories.length, 1);
	assert.equal(list.stories[0].sourceCount, 3);
	assert.equal(list.stories[0].analysisStatus, "available");
	assert.equal(list.stories[0].label, "Bank of England interest rates decision");
	assert.equal(list.stories[0].summary, "The Bank of England made an interest-rate decision.");
	const storyId = list.stories[0].storyId;
	const periodResponse = await handleComparisonRequest(
		new Request(
			"https://example.com/api/comparison/stories?from=2026-07-20T00:00:00.000Z&to=2026-07-21T00:00:00.000Z",
		),
		env,
	);
	assert.equal((await periodResponse.json()).stories[0].storyId, storyId);

	const detailResponse = await handleComparisonRequest(
		new Request(`https://example.com/api/comparison/stories/${storyId}`),
		env,
	);
	const detail = await detailResponse.json();
	assert.equal(detail.evidence.length, 3);
	assert.equal(detail.revision.analysisStatus, "available");
	assert.equal(detail.revision.sourceCount, 3);
	assert.equal(detail.story.summary, "The Bank of England made an interest-rate decision.");
	assert.equal(detail.commonGround.length, 1);
	assert.equal(detail.differences.length, 1);
	assert.ok(detail.evidence.every((item) => item.archiveUrl.startsWith("/history/")));
	assert.equal("r2DocumentKey" in detail.revision, false);
	const replacementRevisionId = "replacement-revision";
	sqlite
		.prepare(
			`INSERT INTO story_revisions (
					revision_id, story_id, run_id, window_id, summary, common_ground_json,
					differences_json, analysis_status, confidence, source_count,
					left_source_count, centre_source_count, right_source_count,
					unrated_source_count, evidence_count, perspective_snapshot_json,
					r2_document_key, created_at
				)
				SELECT
					?, story_id, run_id, window_id, summary, common_ground_json,
					differences_json, analysis_status, confidence, source_count,
					left_source_count, centre_source_count, right_source_count,
					unrated_source_count, evidence_count, perspective_snapshot_json,
					r2_document_key, ?
			FROM story_revisions WHERE revision_id = ?`,
		)
		.run(replacementRevisionId, "2026-07-20T11:00:00.000Z", detail.revision.revisionId);
	sqlite
		.prepare(
			`INSERT INTO story_revision_evidence (
				revision_id, evidence_id, annotation_run_id, capture_id, placement_key, site
			)
			SELECT ?, evidence_id, annotation_run_id, capture_id, placement_key, site
			FROM story_revision_evidence WHERE revision_id = ?`,
		)
		.run(replacementRevisionId, detail.revision.revisionId);
	sqlite
		.prepare(
			`INSERT INTO story_topics (revision_id, story_id, topic)
			SELECT ?, story_id, topic FROM story_topics WHERE revision_id = ?`,
		)
		.run(replacementRevisionId, detail.revision.revisionId);
	sqlite
		.prepare("UPDATE comparison_stories SET current_revision_id = ? WHERE story_id = ?")
		.run(replacementRevisionId, storyId);
	const historicalResponse = await handleComparisonRequest(
		new Request(
			`https://example.com/api/comparison/stories/${storyId}` +
				`?revision=${detail.revision.revisionId}`,
		),
		env,
	);
	assert.equal(historicalResponse.status, 200);
	assert.equal((await historicalResponse.json()).revision.revisionId, detail.revision.revisionId);
	const unknownRevisionResponse = await handleComparisonRequest(
		new Request(`https://example.com/api/comparison/stories/${storyId}?revision=unknown-revision`),
		env,
	);
	assert.equal(unknownRevisionResponse.status, 404);

	const publisherResponse = await handleComparisonRequest(
		new Request(
			"https://example.com/api/comparison/publishers/bbc-news" +
				"?from=2026-07-20T00:00:00.000Z&to=2026-07-21T00:00:00.000Z",
		),
		env,
	);
	const publisher = await publisherResponse.json();
	assert.equal(publisherResponse.status, 200);
	assert.equal(publisher.publisher.observationCount, 1);
	assert.equal(publisher.publisher.cohortObservationCount, 4);
	assert.equal(publisher.publisher.topics[0].publisherObservationCount, 1);
	assert.equal(publisher.publisher.timings[0].direction, "same-window");
	assert.equal(publisher.publisher.leadTimeline.length, 1);
	assert.equal(publisher.publisher.leadTimeline[0].captureId, "bbc-news:desktop:test");
	assert.equal(publisher.publisher.headlineTimeline.length, 1);

	const gapsResponse = await handleComparisonRequest(
		new Request(`https://example.com/api/comparison/gaps?window=${encodeURIComponent(windowId)}`),
		env,
	);
	const gaps = await gapsResponse.json();
	assert.equal(gapsResponse.status, 200);
	assert.equal(gaps.gaps.length, 1);
	assert.equal(gaps.gaps[0].storyId, storyId);
	assert.deepEqual(gaps.gaps[0].missingPublishers, [
		{ displayName: "Daily Mail", site: "dailymail-home" },
	]);
	assert.equal(gaps.gaps[0].analysedSites, 4);
	assert.equal(gaps.gaps[0].clusterConfidence, 0.97);

	const feedbackResponse = await handleComparisonRequest(
		new Request("https://example.com/api/comparison/feedback", {
			body: JSON.stringify({
				evidenceId: detail.evidence[0].evidenceId,
				reason: "missing-context",
				revisionId: detail.revision.revisionId,
			}),
			headers: {
				"content-type": "application/json",
				referer: `https://news-snapshotter.pashi.app/compare/stories/${storyId}?revision=${detail.revision.revisionId}`,
			},
			method: "POST",
		}),
		env,
	);
	assert.equal(feedbackResponse.status, 202);
	const feedback = await feedbackResponse.json();
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM analysis_feedback").get().count, 1);
	assert.equal(emails.length, 1);
	assert.equal(emails[0].to, "pashi@nicholasgriffin.dev");
	assert.match(emails[0].subject, /Missing context/);
	assert.match(emails[0].text, new RegExp(feedback.feedbackId));
	assert.match(emails[0].text, new RegExp(detail.revision.revisionId));
	assert.match(emails[0].text, /news-snapshotter\.pashi\.app\/compare\/stories/);
	const feedbackListResponse = await handleComparisonAdminRequest(
		new Request("https://example.com/api/admin/comparison/feedback?status=pending"),
		env,
	);
	const feedbackList = await feedbackListResponse.json();
	assert.equal(feedbackList.feedback[0].story_id, storyId);
	assert.equal(feedbackList.feedback[0].normalised_label, detail.story.label);
	const resolutionResponse = await handleComparisonAdminRequest(
		new Request(
			`https://example.com/api/admin/comparison/feedback/${feedback.feedbackId}/resolve`,
			{
				body: JSON.stringify({
					resolution: "Updated after checking the archived homepage evidence.",
					status: "resolved",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			},
		),
		env,
	);
	assert.equal(resolutionResponse.status, 200);
	assert.equal(
		sqlite
			.prepare("SELECT review_status FROM analysis_feedback WHERE feedback_id = ?")
			.get(feedback.feedbackId).review_status,
		"resolved",
	);

	const withdrawalResponse = await handleComparisonAdminRequest(
		new Request(
			`https://example.com/api/admin/comparison/revisions/${replacementRevisionId}/withdraw`,
			{
				body: JSON.stringify({ reason: "The generated comparison was unsupported." }),
				headers: { "content-type": "application/json" },
				method: "POST",
			},
		),
		env,
	);

	assert.equal(withdrawalResponse.status, 200);
	assert.equal(
		sqlite
			.prepare("SELECT current_revision_id FROM comparison_stories WHERE story_id = ?")
			.get(storyId).current_revision_id,
		detail.revision.revisionId,
	);
	sqlite.close();
});
