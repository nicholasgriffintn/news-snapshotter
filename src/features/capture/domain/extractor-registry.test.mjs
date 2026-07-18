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
	const bbc = extractorDefinition("bbc-front-page", 5);
	assert.equal(bbc.name, "bbc-front-page");
	assert.match(bbc.cardSelector, /data-testid='promo'/);
	assert.equal(bbc.categorySelector, "[type='attribution']");
	const guardian = extractorDefinition("guardian-front-page", 5);
	assert.match(guardian.storyLinkSelector, /sublinks/);
	assert.match(guardian.storyLinkSelector, /card-@/);
	assert.match(guardian.storyLinkSelector, /media-/);
	assert.match(extractorDefinition("times-front-page", 3).categorySelector, /tag-and-flag/);
	assert.match(extractorDefinition("nytimes-front-page", 3).cardSelector, /data-tpl/);
	assert.equal(extractorDefinition("dailymail-front-page", 3).categoryAttribute, "data-channel");
	assert.equal(extractorDefinition("cnn-front-page", 3).categoryAttribute, "data-section");
	assert.match(extractorDefinition("telegraph-front-page", 2).cardSelector, /data-test/);
	assert.match(extractorDefinition("washingtonpost-front-page", 2).cardSelector, /homepage\/story/);
	const generic = extractorDefinition("generic-baseline", 3);
	assert.equal(generic.sectionSelector, undefined);
	assert.doesNotMatch(generic.storyLinkSelector, /^a\[href\]$/);
	assert.throws(() => extractorDefinition("bbc-front-page", 4), /not registered/);
});
