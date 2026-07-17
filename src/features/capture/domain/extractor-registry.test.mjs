import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePageExtraction } from "../../history/domain/extraction.ts";
import {
	extractorAuthoringChecklist,
	extractorDefinition,
} from "./extractor-registry.ts";

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

test("extractor versions are explicit and authoring has a production gate", () => {
	assert.equal(extractorDefinition("bbc-front-page", 2).name, "bbc-front-page");
	assert.equal(extractorDefinition("guardian-front-page", 1).name, "guardian-front-page");
	assert.throws(() => extractorDefinition("bbc-front-page", 1), /not registered/);
	assert.ok(extractorAuthoringChecklist().some((item) => item.includes("shadow capture")));
});
