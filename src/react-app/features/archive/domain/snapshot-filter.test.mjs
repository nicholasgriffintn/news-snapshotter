import assert from "node:assert/strict";
import test from "node:test";

import { filterSnapshots } from "./snapshot-filter.ts";

const now = new Date(2026, 6, 16, 12);

const snapshots = [
	{
		brand: "bbc",
		capturedAt: new Date(2026, 6, 16, 11).toISOString(),
		category: "news",
		name: "bbc-home",
	},
	{
		brand: "sky",
		capturedAt: new Date(2026, 6, 16, 10).toISOString(),
		category: "sport",
		displayName: "Sky Sports",
		name: "sky-sports",
	},
];

const defaultFilters = {
	brand: "",
	category: "",
	day: "",
	period: "last-3-hours",
	query: "",
};

test("the default gallery includes snapshots in the current archive window", () => {
	assert.deepEqual(filterSnapshots(snapshots, defaultFilters, now), snapshots);
});

test("brand filtering only returns snapshots from the selected publisher", () => {
	const result = filterSnapshots(snapshots, { ...defaultFilters, brand: "bbc" }, now);

	assert.deepEqual(result, [snapshots[0]]);
});

test("category filtering separates news and sport snapshots", () => {
	const news = filterSnapshots(snapshots, { ...defaultFilters, category: "news" }, now);
	const sport = filterSnapshots(snapshots, { ...defaultFilters, category: "sport" }, now);

	assert.deepEqual(news, [snapshots[0]]);
	assert.deepEqual(sport, [snapshots[1]]);
});

test("search is case-insensitive and ignores surrounding whitespace", () => {
	const byName = filterSnapshots(snapshots, { ...defaultFilters, query: "  SKY-SPORTS " }, now);
	const byBrand = filterSnapshots(snapshots, { ...defaultFilters, query: " BBC " }, now);
	const byDisplayName = filterSnapshots(snapshots, { ...defaultFilters, query: "sky sports" }, now);

	assert.deepEqual(byName, [snapshots[1]]);
	assert.deepEqual(byBrand, [snapshots[0]]);
	assert.deepEqual(byDisplayName, [snapshots[1]]);
});

test("brand, category, search, and date filters compose", () => {
	const result = filterSnapshots(
		snapshots,
		{
			...defaultFilters,
			brand: "sky",
			category: "sport",
			day: "2026-07-16",
			period: "day",
			query: "sports",
		},
		now,
	);

	assert.deepEqual(result, [snapshots[1]]);
});

test("a mismatch in any active filter returns no snapshots", () => {
	assert.deepEqual(
		filterSnapshots(snapshots, { ...defaultFilters, brand: "bbc", category: "sport" }, now),
		[],
	);
	assert.deepEqual(filterSnapshots(snapshots, { ...defaultFilters, query: "guardian" }, now), []);
});

test("captures outside the selected time window remain excluded", () => {
	const oldSnapshot = {
		brand: "bbc",
		capturedAt: new Date(2026, 6, 16, 8).toISOString(),
		category: "news",
		name: "bbc-home",
	};

	assert.deepEqual(filterSnapshots([...snapshots, oldSnapshot], defaultFilters, now), snapshots);
});

test("filtering does not mutate the source snapshot list", () => {
	const source = [...snapshots];

	filterSnapshots(source, { ...defaultFilters, brand: "bbc" }, now);

	assert.deepEqual(source, snapshots);
});
