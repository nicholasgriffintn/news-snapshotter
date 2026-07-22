import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { ingestExtraction } from "../infrastructure/history-ingestion-repository.ts";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";
import { handleHistoryRequest } from "./history-api.ts";

function request(path) {
	return new Request(`https://archive.example${path}`);
}

test("serves bounded capture history without private archive keys", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
			warnings: [{ code: "crop-failed", message: "Could not crop the lead image" }],
		}),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		historyExtraction("capture-b", "2026-07-17T10:00:00.000Z"),
	);
	const sitesResponse = await handleHistoryRequest(request("/api/history/sites"), database);
	const sitesBody = await sitesResponse.json();
	assert.equal(sitesBody.sites[0].site, "bbc-home");
	assert.equal(sitesBody.sites[0].captureCount, 2);
	const availableSitesResponse = await handleHistoryRequest(
		request("/api/history/sites/available"),
		database,
	);
	assert.deepEqual(await availableSitesResponse.json(), { sites: ["bbc-home"] });

	const firstPage = await handleHistoryRequest(
		request("/api/history/bbc-home/captures?limit=1"),
		database,
	);
	const firstBody = await firstPage.json();
	assert.equal(firstBody.captures.length, 1);
	assert.equal(firstBody.captures[0].captureId, "capture-b");
	assert.ok(firstBody.cursor);

	const secondPage = await handleHistoryRequest(
		request(`/api/history/bbc-home/captures?limit=1&cursor=${firstBody.cursor}`),
		database,
	);
	assert.deepEqual(
		(await secondPage.json()).captures.map(({ captureId }) => captureId),
		["capture-a"],
	);

	const detail = await handleHistoryRequest(
		request("/api/history/bbc-home/captures/capture-a"),
		database,
	);
	const detailBody = await detail.json();
	assert.equal(detail.status, 200);
	assert.equal(detailBody.capture.sourceUrl, "https://www.bbc.co.uk/");
	assert.equal("htmlKey" in detailBody.capture, false);
	assert.equal("profile" in detailBody.capture, false);
	assert.equal("sanitisationVersion" in detailBody.capture, false);
	assert.equal("warnings" in detailBody, false);
	assert.equal(detailBody.warningCount, 1);

	sqlite.close();
});

test("serves existing capture details before the warnings migration is applied", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-17T09:00:00.000Z"),
	);
	sqlite.exec("ALTER TABLE analysed_captures DROP COLUMN warnings_json");

	const detail = await handleHistoryRequest(
		request("/api/history/bbc-home/captures/capture-a"),
		database,
	);

	assert.equal(detail.status, 200);
	assert.equal((await detail.json()).warningCount, 0);
	sqlite.close();
});

test("serves a reindexed capture immediately instead of an edge-cached stale response", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const stored = new Map();
	const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
	Object.defineProperty(globalThis, "caches", {
		configurable: true,
		value: {
			default: {
				match: async (cacheRequest) => stored.get(cacheRequest.url)?.clone(),
				put: async (cacheRequest, response) => stored.set(cacheRequest.url, response.clone()),
			},
		},
	});
	try {
		const detailRequest = request("/api/history/bbc-home/captures/capture-a");
		await ingestExtraction(
			database,
			"capture-a.json.gz",
			historyExtraction("capture-a", "2026-07-17T09:00:00.000Z"),
		);
		await handleHistoryRequest(detailRequest, database);
		await ingestExtraction(
			database,
			"capture-a.json.gz",
			historyExtraction("capture-a", "2026-07-17T09:00:00.000Z", {
				elements: [historyStory({ headline: "Corrected after reindex" })],
			}),
		);

		const refreshed = await handleHistoryRequest(detailRequest, database);
		assert.equal((await refreshed.json()).elements[0].headline, "Corrected after reindex");
	} finally {
		if (previous) {
			Object.defineProperty(globalThis, "caches", previous);
		} else {
			Reflect.deleteProperty(globalThis, "caches");
		}
		sqlite.close();
	}
});

test("serves content observations and filtered adjacent changes", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-17T09:00:00.000Z"),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
			elements: [historyStory({ headline: "Updated BBC headline" })],
		}),
	);

	const storyResponse = await handleHistoryRequest(
		request(
			`/api/history/bbc-home/content/${encodeURIComponent("https://www.bbc.co.uk/news/articles/story-one")}`,
		),
		database,
	);
	const storyBody = await storyResponse.json();
	assert.equal(storyBody.elementKey, "https://www.bbc.co.uk/news/articles/story-one");
	assert.equal(storyBody.kind, "story");
	assert.equal(storyBody.observations.length, 2);

	const firstObservation = await handleHistoryRequest(
		request(
			`/api/history/bbc-home/content/${encodeURIComponent("https://www.bbc.co.uk/news/articles/story-one")}?limit=1`,
		),
		database,
	);
	const firstObservationBody = await firstObservation.json();
	assert.equal(firstObservationBody.observations.length, 1);
	assert.ok(firstObservationBody.cursor);

	const changesResponse = await handleHistoryRequest(
		request("/api/history/bbc-home/changes?type=headline-changed"),
		database,
	);
	const changesBody = await changesResponse.json();
	assert.equal(changesBody.changes.length, 1);
	assert.equal(changesBody.changes[0].type, "headline-changed");
	assert.equal(changesBody.changes[0].before, "Original BBC headline");
	assert.equal(changesBody.changes[0].after, "Updated BBC headline");

	sqlite
		.prepare(
			`INSERT INTO extraction_failures (
				failure_key, capture_id, site, device, stage, message, failed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			"public-failure",
			"capture-failed",
			"bbc-home",
			"desktop",
			"validation",
			"Private diagnostic detail",
			"2026-07-17T11:00:00.000Z",
		);
	sqlite
		.prepare(
			`INSERT INTO extraction_failures (
				failure_key, capture_id, site, device, stage, message, failed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			"mobile-failure",
			"bbc-home:mobile:2026-07-17T10:00:00.000Z",
			"bbc-home",
			"mobile",
			"validation",
			"Mobile analysis should not appear in desktop history",
			"2026-07-17T10:00:00.000Z",
		);
	const failuresResponse = await handleHistoryRequest(
		request("/api/history/bbc-home/failures"),
		database,
	);
	const failuresBody = await failuresResponse.json();
	assert.deepEqual(failuresBody.failures, [
		{
			captureId: "capture-failed",
			device: "desktop",
			failedAt: "2026-07-17T11:00:00.000Z",
			stage: "validation",
		},
	]);
	assert.equal(JSON.stringify(failuresBody).includes("Private diagnostic detail"), false);

	await assert.rejects(
		handleHistoryRequest(request("/api/history/bbc-home/changes?type=unknown"), database),
		/type is not a supported change type/,
	);

	sqlite.close();
});

test("serves every content kind from the same endpoint", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const media = historyStory({
		canonicalUrl: "https://www.bbc.co.uk/sounds/play/example",
		elementKey: "https://www.bbc.co.uk/sounds/play/example",
		headline: "Listen to the programme",
		kind: "audio",
	});
	await ingestExtraction(
		database,
		"capture-media.json.gz",
		historyExtraction("capture-media", "2026-07-17T09:00:00.000Z", { elements: [media] }),
	);

	const response = await handleHistoryRequest(
		request(`/api/history/bbc-home/content/${encodeURIComponent(media.elementKey)}`),
		database,
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.kind, "audio");
	assert.equal(body.elementKey, media.elementKey);
	assert.equal(body.observations.length, 1);
	assert.equal(body.observations[0].headline, "Listen to the programme");
	await assert.rejects(
		handleHistoryRequest(request(`/api/history/bbc-home/content/${"x".repeat(4_097)}`), database),
		/resource identifier is invalid/,
	);

	sqlite.close();
});

test("filters adjacent changes by kind changes", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-17T09:00:00.000Z"),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		historyExtraction("capture-b", "2026-07-17T10:00:00.000Z", {
			elements: [historyStory({ kind: "video" })],
		}),
	);

	const response = await handleHistoryRequest(
		request("/api/history/bbc-home/changes?type=kind-changed"),
		database,
	);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.changes.length, 1);
	assert.equal(body.changes[0].type, "kind-changed");
	assert.equal(body.changes[0].before, "story");
	assert.equal(body.changes[0].after, "video");

	sqlite.close();
});
