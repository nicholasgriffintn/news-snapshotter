import assert from "node:assert/strict";
import test from "node:test";

import { SITES } from "../../catalogue/domain/sites.ts";
import {
	COMPARISON_COHORTS,
	assertComparisonConfiguration,
	comparisonSites,
} from "./configuration.ts";

test("the UK national cohort contains twelve structured desktop news sites", () => {
	assert.doesNotThrow(() => assertComparisonConfiguration(SITES, COMPARISON_COHORTS));
	assert.deepEqual(
		comparisonSites(SITES, "uk-national-hourly").map(({ name }) => name),
		[
			"bbc-news",
			"times-com",
			"sky-com",
			"dailymail-home",
			"guardian-uk",
			"metro",
			"financialtimes-uk",
			"telegraph-uk",
			"bloomberg-uk",
			"independent",
			"inews-uk",
			"standard-uk",
		],
	);
});

test("comparison validation rejects unknown cohorts and sites without desktop extraction", () => {
	const cohort = COMPARISON_COHORTS[0];
	const base = {
		brand: "example",
		captureRegion: "uk",
		category: "news",
		name: "example",
		priority: 1,
		url: "https://example.com",
	};

	assert.throws(
		() =>
			assertComparisonConfiguration(
				[
					{
						...base,
						analysis: {
							device: "desktop",
							extractor: "generic-baseline",
							minimumElements: 20,
							version: 3,
						},
						comparison: {
							cohorts: ["missing"],
							enabled: true,
							jurisdiction: "GB",
							language: "en",
							maxHomepageItems: 40,
						},
					},
				],
				[cohort],
			),
		/unknown comparison cohort/,
	);

	assert.throws(
		() =>
			assertComparisonConfiguration(
				[
					{
						...base,
						comparison: {
							cohorts: [cohort.id],
							enabled: true,
							jurisdiction: cohort.jurisdiction,
							language: cohort.language,
							maxHomepageItems: 40,
						},
					},
				],
				[{ ...cohort, minimumAnalysedSites: 2 }],
			),
		/requires structured desktop extraction/,
	);
});
