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

test("publisher homepages can define reader-facing names", () => {
	assert.equal(siteNamed("bbc-home").displayName, "BBC");
	assert.equal(siteNamed("skysports-com").displayName, "Sky Sports");
	assert.equal(siteNamed("times-com").displayName, "The Times");
	assert.equal(siteNamed("times-sport").displayName, "The Times Sport");
	assert.equal(siteNamed("telegraph-sport").displayName, "The Telegraph Sport");
	assert.equal(siteNamed("independent").displayName, "The Independent");
	assert.ok(
		SITES.every((site) => site.displayName === undefined || site.displayName.trim().length > 0),
	);
});

test("BBC front pages use the reviewed analysis extractor", () => {
	assert.equal(siteNamed("bbc-home").analysis?.version, 10);
	assert.equal(siteNamed("bbc-news").analysis?.version, 10);
});

test("reviewed publisher front pages use their specific extractors", () => {
	assert.equal(siteNamed("apnews-com").analysis?.extractor, "apnews-front-page");
	assert.equal(siteNamed("channel4-news").analysis?.extractor, "channel4-front-page");
	assert.equal(siteNamed("express-news").analysis?.extractor, "express-front-page");
	assert.equal(siteNamed("forbes-com").analysis?.extractor, "forbes-front-page");
	assert.equal(siteNamed("foxnews-com").analysis?.extractor, "foxnews-front-page");
	assert.equal(siteNamed("google-news-uk").analysis?.extractor, "google-news-front-page");
	assert.equal(siteNamed("hackernews").analysis?.extractor, "hackernews-front-page");
	assert.equal(siteNamed("independent").analysis?.extractor, "independent-front-page");
	assert.equal(siteNamed("inews-uk").analysis?.extractor, "inews-front-page");
	assert.equal(siteNamed("metro").analysis?.extractor, "metro-front-page");
	assert.equal(siteNamed("nbcnews-com").analysis?.extractor, "nbcnews-front-page");
	assert.equal(siteNamed("reuters-com").analysis, undefined);
	assert.equal(siteNamed("standard-uk").analysis?.extractor, "standard-front-page");
	assert.equal(siteNamed("sky-com").analysis?.extractor, "skynews-front-page");
	assert.equal(siteNamed("usatoday-eu").analysis?.extractor, "usatoday-front-page");
	assert.equal(siteNamed("yahoo-news-uk").analysis?.extractor, "yahoo-news-front-page");
	assert.equal(siteNamed("times-com").analysis?.extractor, "times-front-page");
	assert.equal(siteNamed("nytimes-us").analysis?.extractor, "nytimes-front-page");
	assert.equal(siteNamed("dailymail-home").analysis?.extractor, "dailymail-front-page");
	assert.equal(siteNamed("guardian-uk").analysis?.extractor, "guardian-front-page");
	assert.equal(siteNamed("cnn-com").analysis?.extractor, "cnn-front-page");
	assert.equal(siteNamed("telegraph-uk").analysis?.extractor, "telegraph-front-page");
	assert.equal(siteNamed("washingtonpost-com").analysis?.extractor, "washingtonpost-front-page");
	assert.equal(siteNamed("financialtimes-uk").analysis?.extractor, "financialtimes-front-page");
	assert.equal(siteNamed("bloomberg-uk").analysis?.extractor, "bloomberg-front-page");
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
	assert.equal(siteNamed("apnews-com").priority, 1);
	assert.equal(siteNamed("express-news").priority, 2);
	assert.equal(siteNamed("foxnews-com").priority, 1);
	assert.equal(siteNamed("google-news-uk").priority, 2);
	assert.equal(siteNamed("guardian-uk").priority, 1);
	assert.equal(siteNamed("hackernews").priority, 2);
	assert.equal(siteNamed("reuters-com").priority, 1);
	assert.equal(siteNamed("guardian-sport").priority, 2);
	assert.equal(siteNamed("skysports-northern-ireland").priority, 4);
	assert.equal(siteNamed("yahoo-news-uk").priority, 2);
});

test("catalogue capture regions distinguish UK, US, and international editions", () => {
	assert.equal(siteNamed("apnews-com").captureRegion, "us");
	assert.equal(siteNamed("channel4-news").captureRegion, "uk");
	assert.equal(siteNamed("forbes-com").captureRegion, "us");
	assert.equal(siteNamed("google-news-uk").captureRegion, "uk");
	assert.equal(siteNamed("hackernews").captureRegion, "international");
	assert.equal(siteNamed("nbcnews-com").captureRegion, "us");
	assert.equal(siteNamed("reuters-com").captureRegion, "international");
	assert.equal(siteNamed("usatoday-eu").captureRegion, "uk");
	assert.equal(siteNamed("bbc-home").captureRegion, "uk");
	assert.equal(siteNamed("bloomberg-us").captureRegion, "us");
	assert.equal(siteNamed("bloomberg-uk").captureRegion, "uk");
	assert.equal(siteNamed("cnn-com").captureRegion, "international");
	assert.equal(siteNamed("financialtimes-international").captureRegion, "international");
	assert.equal(siteNamed("nytimes-international").captureRegion, "international");
	assert.equal(siteNamed("washingtonpost-com").captureRegion, "us");
});
