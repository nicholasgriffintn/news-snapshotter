import assert from "node:assert/strict";
import test from "node:test";

import { SITES } from "./constants.ts";

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
	assert.equal(siteNamed("bbc-news").priority, 2);
	assert.equal(siteNamed("bbc-war-in-ukraine").priority, 3);
	assert.equal(siteNamed("bbc-cambridgeshire").priority, 4);
});

test("explicit edition and regional priorities are preserved", () => {
	assert.equal(siteNamed("guardian-uk").priority, 1);
	assert.equal(siteNamed("guardian-sport").priority, 2);
	assert.equal(siteNamed("skysports-northern-ireland").priority, 4);
});
