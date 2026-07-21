import assert from "node:assert/strict";
import test from "node:test";

import {
	EMPTY_COMPARISON_STORY_FILTERS,
	comparisonPeriodRange,
	comparisonStatusWindow,
	comparisonStoryFiltersActive,
	filterComparisonStories,
	latestPublishedWindow,
} from "./comparison-period.ts";

test("builds comparison ranges from the latest capture window or a UTC date", () => {
	assert.deepEqual(comparisonPeriodRange("6h", "2026-07-20T12:00:00.000Z", ""), {
		from: "2026-07-20T06:00:00.000Z",
		to: "2026-07-20T12:00:00.000Z",
	});
	assert.deepEqual(comparisonPeriodRange("date", undefined, "2026-07-19"), {
		from: "2026-07-19T00:00:00.000Z",
		to: "2026-07-20T00:00:00.000Z",
	});
	assert.equal(comparisonPeriodRange("latest", undefined, ""), undefined);
});

const stories = [
	{
		label: "Bank of England holds interest rates",
		publishers: [
			{ displayName: "BBC News", site: "bbc-news" },
			{ displayName: "The Guardian", site: "guardian-uk" },
		],
		topics: ["economy"],
	},
	{
		label: "England reaches tournament final",
		publishers: [{ displayName: "BBC News", site: "bbc-news" }],
		topics: ["sport"],
	},
];

test("filters comparisons by headline, topic, and publisher", () => {
	assert.deepEqual(
		filterComparisonStories(stories, {
			...EMPTY_COMPARISON_STORY_FILTERS,
			query: "guardian",
		}),
		[stories[0]],
	);

	assert.deepEqual(
		filterComparisonStories(stories, {
			...EMPTY_COMPARISON_STORY_FILTERS,
			publisher: "bbc-news",
			topic: "sport",
		}),
		[stories[1]],
	);
});

test("recognises comparison filters that change the default view", () => {
	assert.equal(comparisonStoryFiltersActive(EMPTY_COMPARISON_STORY_FILTERS), false);

	assert.equal(
		comparisonStoryFiltersActive({
			...EMPTY_COMPARISON_STORY_FILTERS,
			period: "6h",
		}),
		true,
	);
});

test("uses the latest window that can actually publish comparisons", () => {
	const windows = [
		{ startsAt: "2026-07-20T10:00:00.000Z", status: "suppressed" },
		{ startsAt: "2026-07-20T09:00:00.000Z", status: "partial" },
		{ startsAt: "2026-07-20T08:00:00.000Z", status: "complete" },
	];

	assert.equal(latestPublishedWindow(windows).startsAt, "2026-07-20T09:00:00.000Z");
});

test("shows one-window capture status only for the latest-window view", () => {
	const latest = {
		analysedSites: 4,
		capturedSites: 4,
		cohortId: "uk-national-hourly",
		endsAt: "2026-07-20T00:00:00.000Z",
		expectedSites: 6,
		startsAt: "2026-07-19T23:00:00.000Z",
		status: "partial",
		windowId: "uk-national-hourly:2026-07-19T23:00:00.000Z",
	};

	assert.equal(comparisonStatusWindow("latest", latest), latest);
	assert.equal(comparisonStatusWindow("6h", latest), undefined);
	assert.equal(comparisonStatusWindow("24h", latest), undefined);
	assert.equal(comparisonStatusWindow("date", latest), undefined);
});
