import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SQLiteD1 } from "../../../testing/sqlite-d1.mjs";
import { ingestExtraction } from "../infrastructure/history-repository.ts";
import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";
import { handleHistoryRequest } from "./history-api.ts";

async function historyDatabase() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(
		await readFile(new URL("../../../../migrations/0001_history.sql", import.meta.url), "utf8"),
	);
	return { database: new SQLiteD1(sqlite), sqlite };
}

function request(path) {
	return new Request(`https://archive.example${path}`);
}

test("serves bounded capture history without private archive keys", async () => {
	const { database, sqlite } = await historyDatabase();
	await ingestExtraction(
		database,
		"capture-a.json.gz",
		historyExtraction("capture-a", "2026-07-17T09:00:00.000Z"),
	);
	await ingestExtraction(
		database,
		"capture-b.json.gz",
		historyExtraction("capture-b", "2026-07-17T10:00:00.000Z"),
	);

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
	assert.equal(detailBody.warningCount, 0);

	sqlite.close();
});

test("serves story observations and filtered adjacent changes", async () => {
	const { database, sqlite } = await historyDatabase();
	const storyId = "bbc-home:https://www.bbc.co.uk/news/articles/story-one";
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
		request(`/api/history/bbc-home/stories/${encodeURIComponent(storyId)}`),
		database,
	);
	const storyBody = await storyResponse.json();
	assert.equal(storyBody.storyId, storyId);
	assert.equal(storyBody.observations.length, 2);

	const firstObservation = await handleHistoryRequest(
		request(`/api/history/bbc-home/stories/${encodeURIComponent(storyId)}?limit=1`),
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

	await assert.rejects(
		handleHistoryRequest(request("/api/history/bbc-home/changes?type=unknown"), database),
		/type is not a supported change type/,
	);

	sqlite.close();
});
