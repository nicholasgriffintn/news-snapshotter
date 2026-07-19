import assert from "node:assert/strict";
import test from "node:test";

import { parseScreenshotDates, screenshotPrefixes } from "./screenshot-query.ts";

test("defaults screenshot queries to the current and preceding UTC storage days", () => {
	assert.deepEqual(parseScreenshotDates([], new Date("2026-07-19T00:05:00.000Z")), [
		"2026-07-18",
		"2026-07-19",
	]);
});

test("accepts unique valid storage dates and rejects invalid or excessive input", () => {
	assert.deepEqual(
		parseScreenshotDates(["2026-07-18", "2026-07-19", "2026-07-18"]),
		["2026-07-18", "2026-07-19"],
	);
	assert.throws(() => parseScreenshotDates(["2026-02-30"]), /valid dates/);
	assert.throws(
		() =>
			parseScreenshotDates([
				"2026-07-15",
				"2026-07-16",
				"2026-07-17",
				"2026-07-18",
				"2026-07-19",
			]),
		/at most 4/,
	);
});

test("builds one unique R2 prefix per brand, category, and storage date", () => {
	const sites = [
		{ brand: "BBC", category: "news" },
		{ brand: "BBC", category: "news" },
		{ brand: "Sky Sports", category: "sport" },
	];

	assert.deepEqual(screenshotPrefixes(sites, ["2026-07-18", "2026-07-19"]), [
		"brand=bbc/category=news/date=2026-07-18/",
		"brand=bbc/category=news/date=2026-07-19/",
		"brand=sky-sports/category=sport/date=2026-07-18/",
		"brand=sky-sports/category=sport/date=2026-07-19/",
	]);
});
