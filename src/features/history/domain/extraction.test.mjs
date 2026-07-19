import assert from "node:assert/strict";
import test from "node:test";

import { historyExtraction, historyStory } from "../testing/extraction-fixture.mjs";
import { parsePageExtraction } from "./extraction.ts";

test("accepts a bounded versioned extraction document", () => {
	const document = historyExtraction("capture-a", "2026-07-17T09:00:00.000Z");

	assert.equal(parsePageExtraction(document), document);
});

test("accepts separately typed video and audio content", () => {
	const capturedAt = "2026-07-17T09:00:00.000Z";
	const document = historyExtraction("capture-media", capturedAt, {
		elements: [
			historyStory({ elementKey: "video:one", canonicalUrl: undefined, kind: "video" }),
			historyStory({ elementKey: "audio:one", canonicalUrl: undefined, kind: "audio" }),
		],
	});

	assert.equal(parsePageExtraction(document), document);
});

test("rejects unsafe URLs, unsupported kinds, and oversized element sets", () => {
	const capturedAt = "2026-07-17T09:00:00.000Z";
	const documents = [
		historyExtraction("capture-a", capturedAt, {
			elements: [historyStory({ canonicalUrl: "javascript:alert(1)" })],
		}),
		historyExtraction("capture-b", capturedAt, {
			elements: [historyStory({ kind: "script" })],
		}),
		historyExtraction("capture-c", capturedAt, {
			elements: Array.from({ length: 201 }, (_, index) => {
				return historyStory({ elementKey: `story-${index}` });
			}),
		}),
	];

	for (const document of documents) {
		assert.throws(() => parsePageExtraction(document), /does not match the supported schema/);
	}
});
