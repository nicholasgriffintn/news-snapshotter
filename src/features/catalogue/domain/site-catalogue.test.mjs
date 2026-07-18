import assert from "node:assert/strict";
import test from "node:test";

import {
	selectSites,
	withBrand,
	withIndividualBrands,
	withoutDuplicateNames,
} from "./site-catalogue.ts";

const sources = [
	{ category: "news", name: "home", url: "https://example.com" },
	{ category: "sport", name: "sport", url: "https://example.com/sport" },
];
const sites = withBrand("example", sources);

test("applies a shared brand without mutating site definitions", () => {
	assert.deepEqual(
		sites.map(({ brand }) => brand),
		["example", "example"],
	);
	assert.equal("brand" in sources[0], false);
});

test("assigns route priorities to home, section, and topic pages", () => {
	const prioritisedSites = withBrand("example", [
		{
			category: "news",
			name: "home",
			url: "https://example.com",
		},
		{
			category: "sport",
			name: "sport",
			url: "https://example.com/sport",
		},
		{
			category: "news",
			name: "topic",
			url: "https://example.com/news/topics/election",
		},
	]);

	assert.deepEqual(
		prioritisedSites.map((site) => site.priority),
		[1, 2, 3],
	);
});

test("assigns local pages the lowest scheduling priority", () => {
	const localSites = withBrand("example", sources, "local");

	assert.deepEqual(
		localSites.map((site) => site.priority),
		[4, 4],
	);
});

test("honours an explicit priority for an exceptional route", () => {
	const source = {
		category: "news",
		name: "edition-home",
		priority: 1,
		url: "https://example.com/international",
	};
	const [standardSite] = withBrand("example", [source]);
	const [localSite] = withBrand("example", [source], "local");

	assert.equal(standardSite.priority, 1);
	assert.equal(localSite.priority, 1);
});

test("can derive a separate brand from each site name", () => {
	assert.deepEqual(
		withIndividualBrands(sources).map(({ brand }) => brand),
		["home", "sport"],
	);
});

test("removes site names that already exist", () => {
	assert.deepEqual(withoutDuplicateNames(sources, [sources[0]]), [sources[1]]);
});

test("selects priority one by default, a priority, a brand, or one named site", () => {
	assert.deepEqual(selectSites(sites, {}), [sites[0]]);
	assert.deepEqual(selectSites(sites, { priority: 2 }), [sites[1]]);
	assert.deepEqual(selectSites(sites, { brand: "example" }), sites);
	assert.deepEqual(selectSites(sites, { name: "sport" }), [sites[1]]);
});

test("rejects conflicting and unknown selections", () => {
	assert.throws(() => selectSites(sites, { brand: "example", name: "home" }), /Specify only one/);
	assert.throws(() => selectSites(sites, { brand: "example", priority: 1 }), /Specify only one/);
	assert.throws(() => selectSites(sites, { brand: "missing" }), /Unknown brand: missing/);
	assert.throws(() => selectSites(sites, { name: "missing" }), /Unknown site name: missing/);
});
