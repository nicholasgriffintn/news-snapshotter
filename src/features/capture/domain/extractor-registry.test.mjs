import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePageExtraction } from "../../history/domain/extraction.ts";
import { extractorDefinition } from "./extractor-registry.ts";

for (const fixture of ["bbc-home", "guardian-uk"]) {
	test(`${fixture} fixture preserves reviewed stable story identities`, async () => {
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
	const bbc = extractorDefinition("bbc-front-page", 6);
	assert.equal(bbc.name, "bbc-front-page");
	assert.ok(
		bbc.rules.some(({ candidateSelector, prominenceHint }) => {
			return (
				/billboard-canvas-background-image/.test(candidateSelector) && prominenceHint === "lead"
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
			.filter(({ cardSelector }) => /data-testid='promo'/.test(cardSelector))
			.every(({ sectionSelector }) => /spc-container/.test(sectionSelector)),
	);
	const guardian = extractorDefinition("guardian-front-page", 6);
	assert.match(guardian.rules[0].candidateSelector, /sublinks/);
	assert.match(guardian.rules[0].candidateSelector, /card-@/);
	assert.match(guardian.rules[0].candidateSelector, /media-/);
	assert.doesNotMatch(guardian.rules[0].candidateSelector, /:not\([^)]*media-/);
	assert.equal(guardian.rules[0].headlineSelector[0], ".headline-text");
	const times = extractorDefinition("times-front-page", 4);
	assert.ok(
		times.rules.some(({ candidateSelector, prominenceHint }) => {
			return /lead-media-article/.test(candidateSelector) && prominenceHint === "lead";
		}),
	);
	assert.match(times.rules.at(-1).categorySelector, /tag-and-flag/);
	const nytimes = extractorDefinition("nytimes-front-page", 4);
	assert.match(nytimes.rules[0].candidateSelector, /:has\(\[data-tpl='sli'\]\)/);
	assert.equal(nytimes.rules[0].prominenceHint, "lead");
	assert.match(nytimes.rules[0].sectionHeadingSelector, /data-tpl='tk'/);
	assert.equal(
		extractorDefinition("dailymail-front-page", 3).rules[0].categoryAttribute,
		"data-channel",
	);
	assert.equal(extractorDefinition("cnn-front-page", 3).rules[0].categoryAttribute, "data-section");
	const telegraph = extractorDefinition("telegraph-front-page", 2);
	assert.match(telegraph.rules[0].cardSelector, /data-test/);
	assert.equal(telegraph.rules[0].prominenceHint, "lead");
	assert.match(
		extractorDefinition("washingtonpost-front-page", 2).rules[0].cardSelector,
		/homepage\/story/,
	);
	const financialTimes = extractorDefinition("financialtimes-front-page", 1);
	assert.match(financialTimes.rules[0].candidateSelector, /heading-link/);
	assert.match(financialTimes.rules[0].cardSelector, /story-group__article/);
	const bloomberg = extractorDefinition("bloomberg-front-page", 1);
	assert.ok(
		bloomberg.rules.some(({ candidateSelector, prominenceHint }) => {
			return /#lede/.test(candidateSelector) && prominenceHint === "lead";
		}),
	);
	assert.match(bloomberg.rules.at(-1).candidateSelector, /data-component='headline'/);
	const generic = extractorDefinition("generic-baseline", 3);
	assert.equal(generic.rules[0].sectionSelector, undefined);
	assert.doesNotMatch(generic.rules[0].candidateSelector, /^a\[href\]$/);
	assert.throws(() => extractorDefinition("bbc-front-page", 5), /not registered/);
	assert.throws(() => extractorDefinition("guardian-front-page", 5), /not registered/);
	assert.throws(() => extractorDefinition("nytimes-front-page", 3), /not registered/);
	assert.throws(() => extractorDefinition("times-front-page", 3), /not registered/);
});
