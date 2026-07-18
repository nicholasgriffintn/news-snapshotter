import assert from "node:assert/strict";
import test from "node:test";

import { storeCaptureArtefacts } from "./capture-artefacts.ts";

test("keeps a stored screenshot successful when indexing cannot be queued", async (context) => {
	context.mock.method(console, "error", () => undefined);
	const screenshots = [];
	const page = {
		evaluate: async () => {
			return JSON.stringify({
				elements: [
					{
						canonicalUrl: "https://www.bbc.co.uk/news/articles/story-one",
						elementKey: "story-one",
						headline: "A representative BBC headline",
						kind: "story",
						position: {
							height: 100,
							left: 0,
							pageOrder: 1,
							top: 0,
							viewportDepth: 0,
							width: 500,
						},
						prominence: "lead",
						selectorHint: "h1",
						textFingerprint: "a representative bbc headline",
					},
				],
				html: "<!doctype html><html><body>BBC</body></html>",
				pageHeight: 1_000,
				pageWidth: 1_000,
			});
		},
		screenshot: async () => Buffer.from("image"),
	};
	const result = await storeCaptureArtefacts({
		config: {
			screenshot: { fullPage: false, type: "png" },
			viewport: { height: 1_000, width: 1_000 },
		},
		device: "desktop",
		env: {
			ARCHIVE_DATA: { put: async () => undefined },
			HISTORY_INDEX_QUEUE: {
				send: async () => {
					throw new Error("Queue unavailable");
				},
			},
			SCREENSHOTS: { put: async (...args) => screenshots.push(args) },
		},
		page,
		profileName: "bbc",
		site: {
			analysis: {
				device: "desktop",
				extractor: "bbc-front-page",
				minimumElements: 1,
				version: 4,
			},
			brand: "bbc",
			captureRegion: "uk",
			category: "news",
			name: "bbc-home",
			priority: 1,
			url: "https://www.bbc.co.uk/",
		},
		triggeredAt: "2026-07-17T09:00:00.000Z",
	});

	assert.equal(result.status, "success");
	assert.equal(result.analysis.status, "stored");
	assert.equal(result.analysis.indexingStatus, "not-queued");
	assert.equal(screenshots.length, 2);
});
