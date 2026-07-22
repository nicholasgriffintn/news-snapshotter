import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryTestDatabase } from "../../../testing/history-database.mjs";
import { ingestExtraction } from "../infrastructure/history-ingestion-repository.ts";
import { createSavedTimeline } from "../infrastructure/history-research-repository.ts";
import { historyExtraction } from "../testing/extraction-fixture.mjs";
import { handleHistoryResearchRequest } from "./history-research-api.ts";

function request(path) {
	return new Request(`https://archive.example${path}`);
}

test("lists public timelines for a site and scopes timeline details to that site", async () => {
	const { database, sqlite } = await createHistoryTestDatabase();
	const extraction = historyExtraction("timeline-capture", "2026-07-17T09:00:00.000Z");
	const second = structuredClone(extraction.elements[0]);
	second.elementKey = "https://www.bbc.co.uk/news/articles/story-two";
	second.canonicalUrl = second.elementKey;
	second.placementKey = `${second.elementKey}#section=news&occurrence=1`;
	second.headline = "Second story";
	extraction.elements.push(second);
	await ingestExtraction(database, "timeline-capture.json.gz", extraction);
	const created = await createSavedTimeline(database, {
		elementKeys: extraction.elements.map(({ elementKey }) => elementKey),
		name: "Election coverage",
		site: "bbc-home",
	});

	const listResponse = await handleHistoryResearchRequest(
		request("/api/history/bbc-home/timelines"),
		database,
	);
	const list = await listResponse.json();
	assert.equal(listResponse.status, 200);
	assert.equal(list.timelines.length, 1);
	assert.equal(list.timelines[0].contentCount, 2);
	assert.equal("elementKeys" in list.timelines[0], false);

	const detailResponse = await handleHistoryResearchRequest(
		request(`/api/history/bbc-home/timelines/${created.slug}`),
		database,
	);
	assert.equal(detailResponse.status, 200);
	assert.equal((await detailResponse.json()).timelineId, created.timelineId);

	const wrongSiteResponse = await handleHistoryResearchRequest(
		request(`/api/history/guardian-uk/timelines/${created.slug}`),
		database,
	);
	assert.equal(wrongSiteResponse.status, 404);
	sqlite.close();
});
