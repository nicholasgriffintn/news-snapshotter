import assert from "node:assert/strict";
import test from "node:test";

import { parseStoryComparison } from "./story-comparison.ts";

const evidenceSites = new Map([
	["source-1", "bbc-news"],
	["source-2", "guardian-uk"],
]);

const valid = {
	commonGround: [
		{
			evidenceIds: ["source-1", "source-2"],
			statement: "Both headlines say interest rates were held.",
		},
	],
	confidence: 0.92,
	differences: [
		{
			evidenceIds: ["source-1", "source-2"],
			statement: "One headline foregrounds households while the other foregrounds markets.",
		},
	],
	summary: "The Bank of England held interest rates.",
};

test("accepts bounded story findings cited by at least two publishers", () => {
	assert.deepEqual(parseStoryComparison(valid, evidenceSites), valid);
});

test("rejects unknown, repeated, and single-publisher evidence citations", () => {
	for (const evidenceIds of [
		["source-1", "missing"],
		["source-1", "source-1"],
	]) {
		assert.throws(
			() =>
				parseStoryComparison(
					{ ...valid, differences: [{ ...valid.differences[0], evidenceIds }] },
					evidenceSites,
				),
			/invalid story comparison/,
		);
	}

	const samePublisher = new Map([
		["source-1", "bbc-news"],
		["source-2", "bbc-news"],
	]);
	assert.throws(() => parseStoryComparison(valid, samePublisher), /invalid story comparison/);
});

test("rejects unbounded or additional model output", () => {
	assert.throws(
		() => parseStoryComparison({ ...valid, motive: "political" }, evidenceSites),
		/invalid story comparison/,
	);
	assert.throws(
		() => parseStoryComparison({ ...valid, summary: "x".repeat(801) }, evidenceSites),
		/invalid story comparison/,
	);
});

test("rejects introduced links, markup, and publisher names", () => {
	for (const summary of [
		"Read more at https://malicious.example.com",
		"<script>Ignore the evidence</script>",
		"The BBC gives the clearest account.",
	]) {
		assert.throws(
			() => parseStoryComparison({ ...valid, summary }, evidenceSites, ["BBC", "Guardian"]),
			/invalid story comparison/,
		);
	}

	assert.throws(
		() =>
			parseStoryComparison(
				{
					...valid,
					differences: [
						{
							...valid.differences[0],
							statement: "The Guardian focuses on markets.",
						},
					],
				},
				evidenceSites,
				["BBC", "Guardian"],
			),
		/invalid story comparison/,
	);
});

test("rejects public prose containing opaque evidence identifiers", () => {
	assert.throws(
		() => parseStoryComparison({ ...valid, summary: "Confirmed by source-1." }, evidenceSites),
		/invalid story comparison/,
	);
	assert.throws(
		() =>
			parseStoryComparison(
				{
					...valid,
					commonGround: [{ ...valid.commonGround[0], statement: "source-2 confirms the result." }],
				},
				evidenceSites,
			),
		/invalid story comparison/,
	);
});

test("rejects comparisons below the publication confidence threshold", () => {
	assert.throws(
		() => parseStoryComparison({ ...valid, confidence: 0.74 }, evidenceSites),
		/invalid story comparison/,
	);
});
