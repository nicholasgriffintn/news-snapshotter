import assert from "node:assert/strict";
import test from "node:test";

import { filterHistorySites, isHistorySiteOrder } from "./history-site-filter.ts";

const sites = [
	{
		captureCount: 2,
		category: "news",
		contentCount: 40,
		device: "desktop",
		displayName: "BBC",
		firstCaptureAt: "2026-07-17T09:00:00.000Z",
		lastCaptureAt: "2026-07-18T09:00:00.000Z",
		site: "bbc-home",
		sourceUrl: "https://www.bbc.co.uk/",
	},
	{
		captureCount: 6,
		category: "sport",
		contentCount: 80,
		device: "desktop",
		displayName: "Sky Sports",
		firstCaptureAt: "2026-07-17T10:00:00.000Z",
		lastCaptureAt: "2026-07-19T10:00:00.000Z",
		site: "skysports-com",
		sourceUrl: "https://www.skysports.com/",
	},
];

test("filters histories using reader-facing and storage names", () => {
	assert.deepEqual(
		filterHistorySites(sites, { category: "", order: "latest", query: "BBC" }).map(
			({ site }) => site,
		),
		["bbc-home"],
	);
	assert.deepEqual(
		filterHistorySites(sites, { category: "sport", order: "latest", query: "" }).map(
			({ site }) => site,
		),
		["skysports-com"],
	);
});

test("orders histories without mutating the source list", () => {
	assert.deepEqual(
		filterHistorySites(sites, { category: "", order: "captures", query: "" }).map(
			({ site }) => site,
		),
		["skysports-com", "bbc-home"],
	);
	assert.deepEqual(
		filterHistorySites(sites, { category: "", order: "name", query: "" }).map(({ site }) => site),
		["bbc-home", "skysports-com"],
	);
	assert.equal(sites[0].site, "bbc-home");
});

test("recognises supported history ordering", () => {
	assert.equal(isHistorySiteOrder("latest"), true);
	assert.equal(isHistorySiteOrder("oldest"), false);
});
