import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePageExtraction } from "../../history/domain/extraction.ts";
import { extractorDefinition } from "./extractor-registry.ts";

for (const fixture of ["bbc-home", "guardian-uk"]) {
	test(`${fixture} fixture preserves reviewed stable content identities`, async () => {
		const directory = new URL("../testing/fixtures/", import.meta.url);
		const html = await readFile(new URL(`${fixture}.html`, directory), "utf8");
		const expected = parsePageExtraction(
			JSON.parse(await readFile(new URL(`${fixture}.expected.json`, directory), "utf8")),
		);

		assert.ok(expected.elements.length >= 2);
		for (const element of expected.elements) {
			assert.equal(element.elementKey, element.canonicalUrl);
			assert.ok(html.includes(element.canonicalUrl));
			assert.ok(element.position.width > 0);
			assert.ok(element.position.height > 0);
		}
	});
}

test("extractor versions are explicit", () => {
	const bbc = extractorDefinition("bbc-front-page", 10);
	assert.equal(bbc.name, "bbc-front-page");
	assert.ok(
		bbc.rules.some(({ candidateSelector, cardSelector, prominenceHint }) => {
			return (
				/billboard-canvas-background-image/.test(candidateSelector) &&
				/-Canvas/.test(cardSelector) &&
				/-ContentWrap/.test(candidateSelector) &&
				prominenceHint === "lead"
			);
		}),
	);
	assert.ok(
		bbc.rules.some(({ candidateSelector, kind }) => {
			return kind === "video" && /portrait-video-experience/.test(candidateSelector);
		}),
	);
	assert.ok(bbc.rules.some(({ kind }) => kind === "audio"));
	assert.ok(
		bbc.rules
			.filter(({ excludedUrlPathPrefixes }) => excludedUrlPathPrefixes !== undefined)
			.every(({ candidateSelector }) => /:is\(h1, h2, h3\)|:has\(/.test(candidateSelector)),
	);
	assert.ok(
		bbc.rules
			.filter(({ kind }) => kind === "audio" || kind === "video")
			.some(({ excludedUrlPathPrefixes }) =>
				excludedUrlPathPrefixes?.includes("/iplayer/watchlist"),
			),
	);
	assert.ok(
		bbc.rules
			.filter(({ kind }) => kind === "audio" || kind === "video")
			.some(({ excludedUrlPathPrefixes }) => excludedUrlPathPrefixes?.includes("/sounds/my/")),
	);
	assert.ok(
		bbc.rules
			.filter(({ cardSelector }) => /data-testid='promo'/.test(cardSelector))
			.every(({ sectionSelector }) => /spc-container/.test(sectionSelector)),
	);
	const guardian = extractorDefinition("guardian-front-page", 8);
	assert.match(guardian.rules[0].candidateSelector, /sublinks/);
	assert.match(guardian.rules[0].candidateSelector, /card-@/);
	assert.match(guardian.rules[0].candidateSelector, /media-/);
	assert.doesNotMatch(guardian.rules[0].candidateSelector, /:not\([^)]*media-/);
	assert.equal(guardian.rules[0].headlineSelector[0], ".headline-text");
	const times = extractorDefinition("times-front-page", 5);
	assert.ok(
		times.rules.some(({ candidateSelector, prominenceHint }) => {
			return /lead-media-article/.test(candidateSelector) && prominenceHint === "lead";
		}),
	);
	assert.match(
		times.rules.find(({ candidateSelector }) => /article-headline/.test(candidateSelector))
			.categorySelector,
		/tag-and-flag/,
	);
	const nytimes = extractorDefinition("nytimes-front-page", 5);
	assert.match(nytimes.rules[0].candidateSelector, /:has\(\[data-tpl='sli'\]\)/);
	assert.equal(nytimes.rules[0].prominenceHint, "lead");
	assert.match(nytimes.rules[0].sectionHeadingSelector, /data-tpl='tk'/);
	assert.equal(
		extractorDefinition("dailymail-front-page", 4).rules[0].categoryAttribute,
		"data-channel",
	);
	assert.equal(extractorDefinition("cnn-front-page", 4).rules[0].categoryAttribute, "data-section");
	const telegraph = extractorDefinition("telegraph-front-page", 3);
	assert.match(telegraph.rules[0].cardSelector, /data-test/);
	assert.equal(telegraph.rules[0].prominenceHint, "lead");
	const washingtonPost = extractorDefinition("washingtonpost-front-page", 4);
	const washingtonPostVideoRule = washingtonPost.rules.find(({ kind }) => kind === "video");
	assert.ok(washingtonPostVideoRule);
	assert.match(washingtonPostVideoRule.candidateSelector, /vertical-thumbnail/);
	assert.ok(
		washingtonPost.rules.indexOf(washingtonPostVideoRule) <
			washingtonPost.rules.findIndex(({ kind }) => kind === "story"),
	);
	assert.match(
		washingtonPost.rules.find(({ kind }) => kind === "story").cardSelector,
		/homepage\/story/,
	);
	const financialTimes = extractorDefinition("financialtimes-front-page", 2);
	assert.match(financialTimes.rules[0].candidateSelector, /heading-link/);
	assert.match(financialTimes.rules[0].cardSelector, /story-group__article/);
	const bloomberg = extractorDefinition("bloomberg-front-page", 3);
	const bloombergVideoRule = bloomberg.rules.find(({ kind }) => kind === "video");
	assert.ok(bloombergVideoRule);
	assert.match(bloombergVideoRule.candidateSelector, /\/news\/videos\//);
	assert.ok(
		bloomberg.rules.indexOf(bloombergVideoRule) <
			bloomberg.rules.findIndex(({ kind }) => kind === "story"),
	);
	assert.ok(
		bloomberg.rules.some(({ candidateSelector, prominenceHint }) => {
			return /#lede/.test(candidateSelector) && prominenceHint === "lead";
		}),
	);
	assert.ok(
		bloomberg.rules.some(({ candidateSelector }) =>
			/data-component='headline'/.test(candidateSelector),
		),
	);
	const apNews = extractorDefinition("apnews-front-page", 1);
	const apNewsVideoRule = apNews.rules.find(({ kind }) => kind === "video");
	assert.equal(apNewsVideoRule.urlAttribute, "url");
	assert.match(apNewsVideoRule.cardSelector, /VideoPlaylistItemCard/);
	const channel4StoryRule = extractorDefinition("channel4-front-page", 1).rules.find(
		({ kind }) => kind === "story",
	);
	assert.match(channel4StoryRule.candidateSelector, /:not\(\.featured-video-button\)/);
	assert.doesNotMatch(channel4StoryRule.cardSelector, /a\[href\]/);
	const standard = extractorDefinition("standard-front-page", 1);
	const standardVideoRule = standard.rules.find(({ kind }) => kind === "video");
	const standardStoryRule = standard.rules.find(({ kind }) => kind === "story");
	assert.match(standardVideoRule.candidateSelector, /:has\(\[aria-label='video'\]\)/);
	assert.doesNotMatch(standardVideoRule.candidateSelector, /:has\(> p\)/);
	assert.match(standardStoryRule.cardSelector, /:has\(img\)/);
	const inews = extractorDefinition("inews-front-page", 1);
	assert.equal(
		inews.rules.find(({ kind }) => kind === "story").categorySelector,
		"a[title^='Link to:'] .category-name",
	);
	assert.equal(inews.rules.find(({ kind }) => kind === "video").extractCanonicalUrl, false);
	assert.equal(inews.rules.find(({ kind }) => kind === "video").categorySelector, ".category-name");
	assert.ok(
		extractorDefinition("foxnews-front-page", 1)
			.rules.filter(({ kind }) => kind === "story" || kind === "video")
			.every(({ sectionHeadingSelector }) => /section\.collection/.test(sectionHeadingSelector)),
	);
	assert.ok(
		extractorDefinition("nbcnews-front-page", 1)
			.rules.filter(({ kind }) => kind === "story" || kind === "video")
			.every(({ sectionHeadingSelector }) => sectionHeadingSelector === undefined),
	);
	const googleNewsExtractor = extractorDefinition("google-news-front-page", 2);
	const googleNews = googleNewsExtractor.rules[0];
	assert.match(googleNews.cardSelector, /UwIKyb/);
	assert.match(googleNews.candidateSelector, /gPFEn/);
	assert.equal(googleNews.categorySelector, undefined);
	assert.ok(
		googleNewsExtractor.rules.some(({ candidateSelector }) => /JtKRv/.test(candidateSelector)),
	);
	const hackerNews = extractorDefinition("hackernews-front-page", 2);
	assert.match(hackerNews.rules[0].candidateSelector, /titleline/);
	assert.equal(hackerNews.rules[0].categorySelector, undefined);
	assert.ok(
		hackerNews.rules.some(
			({ candidateSelector, kind }) => kind === "navigation" && /hnmain/.test(candidateSelector),
		),
	);
	const yahooNews = extractorDefinition("yahoo-news-front-page", 1).rules[0];
	assert.match(yahooNews.candidateSelector, /data-ylk/);
	assert.match(yahooNews.cardSelector, /cls-card-story/);
	const newPublisherExtractors = [
		"apnews-front-page",
		"channel4-front-page",
		"express-front-page",
		"forbes-front-page",
		"foxnews-front-page",
		"inews-front-page",
		"nbcnews-front-page",
		"standard-front-page",
		"usatoday-front-page",
		"yahoo-news-front-page",
	];
	for (const name of newPublisherExtractors) {
		assert.ok(
			extractorDefinition(name, 1).rules.some(({ kind }) => kind === "story"),
			name,
		);
	}
	assert.ok(hackerNews.rules.some(({ kind }) => kind === "story"));
	assert.ok(googleNewsExtractor.rules.some(({ kind }) => kind === "story"));
	for (const name of [
		"apnews-front-page",
		"channel4-front-page",
		"foxnews-front-page",
		"inews-front-page",
		"nbcnews-front-page",
	]) {
		assert.ok(
			extractorDefinition(name, 1).rules.some(({ kind }) => kind === "video"),
			name,
		);
	}
	const generic = extractorDefinition("generic-baseline", 4);
	assert.equal(generic.rules[0].sectionSelector, undefined);
	assert.doesNotMatch(generic.rules[0].candidateSelector, /^a\[href\]$/);
	assert.throws(() => extractorDefinition("bbc-front-page", 9), /not registered/);
	assert.throws(() => extractorDefinition("guardian-front-page", 7), /not registered/);
	assert.throws(() => extractorDefinition("nytimes-front-page", 4), /not registered/);
	assert.throws(() => extractorDefinition("times-front-page", 4), /not registered/);
});

test("every extractor includes semantic elements from the rest of the page", () => {
	const extractors = [
		["generic-baseline", 4],
		["apnews-front-page", 1],
		["bbc-front-page", 10],
		["bloomberg-front-page", 3],
		["channel4-front-page", 1],
		["cnn-front-page", 4],
		["dailymail-front-page", 4],
		["express-front-page", 1],
		["financialtimes-front-page", 2],
		["forbes-front-page", 1],
		["foxnews-front-page", 1],
		["google-news-front-page", 2],
		["guardian-front-page", 8],
		["hackernews-front-page", 2],
		["inews-front-page", 1],
		["nbcnews-front-page", 1],
		["nytimes-front-page", 5],
		["standard-front-page", 1],
		["telegraph-front-page", 3],
		["times-front-page", 5],
		["usatoday-front-page", 1],
		["washingtonpost-front-page", 4],
		["yahoo-news-front-page", 1],
	];

	for (const [name, version] of extractors) {
		const pageKinds = new Set(
			extractorDefinition(name, version)
				.rules.filter(({ scope }) => scope === "page")
				.map(({ kind }) => kind),
		);

		assert.deepEqual([...pageKinds].sort(), ["heading", "image", "navigation"], name);
	}
});
