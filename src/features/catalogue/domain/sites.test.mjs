import assert from "node:assert/strict";
import test from "node:test";

import { extractorDefinition } from "../../capture/domain/extractor-registry.ts";
import { SITES } from "./sites.ts";

function siteNamed(name) {
	const site = SITES.find((candidate) => {
		return candidate.name === name;
	});

	assert.ok(site, `Expected ${name} in the site catalogue`);

	return site;
}

test("every catalogue page has a valid capture priority", () => {
	assert.ok(SITES.length > 0);
	assert.ok(
		SITES.every((site) => {
			return [1, 2, 3, 4].includes(site.priority);
		}),
	);
});

test("catalogue priorities distinguish key route types", () => {
	assert.equal(siteNamed("bbc-home").priority, 1);
	assert.equal(siteNamed("bbc-news").priority, 1);
	assert.equal(siteNamed("bbc-war-in-ukraine").priority, 3);
	assert.equal(siteNamed("bbc-cambridgeshire").priority, 4);
});

test("BBC front pages use the reviewed analysis extractor", () => {
	assert.equal(siteNamed("bbc-home").analysis?.version, 5);
	assert.equal(siteNamed("bbc-news").analysis?.version, 5);
});

test("reviewed publisher front pages use their specific extractors", () => {
	assert.equal(siteNamed("times-com").analysis?.extractor, "times-front-page");
	assert.equal(siteNamed("nytimes-us").analysis?.extractor, "nytimes-front-page");
	assert.equal(siteNamed("dailymail-home").analysis?.extractor, "dailymail-front-page");
	assert.equal(siteNamed("guardian-uk").analysis?.extractor, "guardian-front-page");
	assert.equal(siteNamed("cnn-com").analysis?.extractor, "cnn-front-page");
	assert.equal(siteNamed("telegraph-uk").analysis?.extractor, "telegraph-front-page");
	assert.equal(siteNamed("washingtonpost-com").analysis?.extractor, "washingtonpost-front-page");
});

test("every configured analysis uses a registered extractor version", () => {
	for (const site of SITES) {
		if (!site.analysis) {
			continue;
		}
		assert.doesNotThrow(
			() => extractorDefinition(site.analysis.extractor, site.analysis.version),
			site.name,
		);
	}
});

test("explicit edition and regional priorities are preserved", () => {
	assert.equal(siteNamed("guardian-uk").priority, 1);
	assert.equal(siteNamed("guardian-sport").priority, 2);
	assert.equal(siteNamed("skysports-northern-ireland").priority, 4);
});

test("catalogue capture regions distinguish UK, US, and international editions", () => {
	assert.equal(siteNamed("bbc-home").captureRegion, "uk");
	assert.equal(siteNamed("bloomberg-us").captureRegion, "us");
	assert.equal(siteNamed("bloomberg-uk").captureRegion, "uk");
	assert.equal(siteNamed("cnn-international").captureRegion, "international");
	assert.equal(siteNamed("financialtimes-international").captureRegion, "international");
	assert.equal(siteNamed("nytimes-international").captureRegion, "international");
	assert.equal(siteNamed("washingtonpost-com").captureRegion, "us");
});
