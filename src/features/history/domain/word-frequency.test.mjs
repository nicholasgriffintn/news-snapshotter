import assert from "node:assert/strict";
import test from "node:test";

import { headlineWords, weightedWordFrequency } from "./word-frequency.ts";

test("normalises headline words and removes common noise", () => {
	assert.deepEqual(headlineWords("The PM's plan for more NEWS, after talks"), [
		"pm's",
		"plan",
		"talks",
	]);
});

test("removes common grammatical filler from coverage patterns", () => {
	assert.deepEqual(
		headlineWords(
			"And how are you? It’s our new quiz, but I'm ready. His friend, who did ask why, should only play one.",
		),
		["quiz", "ready", "friend", "ask", "play"],
	);
});

test("weights words by how long a capture remained current", () => {
	const words = weightedWordFrequency([
		{ headline: "Election result live", weightSeconds: 3_600 },
		{ headline: "Election result reaction", weightSeconds: 1_800 },
	]);

	assert.deepEqual(words.slice(0, 2), [
		{ count: 2, label: "election", weightSeconds: 5_400 },
		{ count: 2, label: "result", weightSeconds: 5_400 },
	]);
});
