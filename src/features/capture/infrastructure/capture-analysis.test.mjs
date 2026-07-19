import assert from "node:assert/strict";
import test from "node:test";

import { analysisKeys, canonicaliseUrl, collectAndStoreAnalysis } from "./capture-analysis.ts";
import { normaliseContentElements } from "../domain/content-elements.ts";
import { parsePageExtraction } from "../../history/domain/extraction.ts";

const site = {
	analysis: {
		device: "desktop",
		extractor: "bbc-front-page",
		minimumElements: 2,
		version: 10,
	},
	brand: "bbc",
	category: "news",
	name: "bbc-home",
	url: "https://www.bbc.co.uk/",
};
const triggeredAt = "2026-07-17T09:00:01.130Z";

function extractedStory(overrides = {}) {
	return {
		canonicalUrl: "https://bbc.co.uk/a?utm_source=x",
		elementKey: "a",
		headline: "First headline",
		kind: "story",
		position: {
			height: 40,
			left: 0,
			pageOrder: 1,
			top: 100,
			viewportDepth: 0.1,
			width: 300,
		},
		prominence: "standard",
		selectorHint: "h3",
		textFingerprint: "first headline",
		...overrides,
	};
}

test("builds deterministic private artefact keys", () => {
	const prefix = [
		"brand=bbc",
		"category=news",
		"date=2026-07-17",
		"site=bbc-home",
		"device=desktop",
	].join("/");
	const timestamp = "2026-07-17T09-00-01-130Z";

	assert.deepEqual(analysisKeys(site, "desktop", triggeredAt), {
		extractionKey: `${prefix}/${timestamp}.extraction.v4.json.gz`,
		failureKey: `${prefix}/${timestamp}.analysis-failure.json`,
		htmlKey: `${prefix}/${timestamp}.rendered.html.gz`,
	});
});

test("canonicalises story URLs for stable identity", () => {
	assert.equal(
		canonicaliseUrl("https://www.bbc.co.uk/news/story/?utm_source=test&keep=yes#section"),
		"https://www.bbc.co.uk/news/story?keep=yes",
	);
});

test("retains page actions without treating non-web targets as publisher URLs", async () => {
	const writes = [];
	const page = {
		evaluate: async () =>
			JSON.stringify({
				elements: [
					extractedStory(),
					extractedStory({
						canonicalUrl: "javascript:openPrivacySettings()",
						elementKey: "javascript:openPrivacySettings()",
						headline: "Privacy Settings",
						kind: "navigation",
						position: { ...extractedStory().position, top: 500 },
						selectorHint: "a",
						textFingerprint: "privacy settings",
					}),
				],
				html: "<!doctype html><html><body>Archive</body></html>",
				pageHeight: 2_000,
				pageWidth: 1_740,
			}),
	};

	await collectAndStoreAnalysis({
		bucket: { put: async (...args) => writes.push(args) },
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotKey: "screenshot.png",
		site,
		triggeredAt,
	});

	const stream = new Blob([writes[1][1]]).stream().pipeThrough(new DecompressionStream("gzip"));
	const extraction = parsePageExtraction(await new Response(stream).json());
	const action = extraction.elements.find(({ headline }) => headline === "Privacy Settings");

	assert.equal(action.canonicalUrl, undefined);
	assert.equal(action.elementKey, "navigation:privacy settings");
});

test("keeps every visible semantic kind and rejects hidden elements", () => {
	const base = {
		canonicalUrl: "https://www.bbc.co.uk/news/articles/story",
		elementKey: "story",
		headline: "A real BBC story headline",
		kind: "story",
		position: {
			height: 40,
			left: 0,
			pageOrder: 8,
			top: 100,
			viewportDepth: 0.1,
			width: 300,
		},
		prominence: "standard",
		selectorHint: "h3",
		summary: "A real BBC story headline",
		textFingerprint: "a real bbc story headline",
	};
	const stories = normaliseContentElements([
		base,
		{
			...base,
			elementKey: "navigation",
			headline: "Accessibility Help",
			kind: "navigation",
			position: { ...base.position, top: 120 },
			selectorHint: "a",
		},
		{
			...base,
			elementKey: "hidden-action",
			position: {
				...base.position,
				height: 0,
				width: 0,
			},
		},
	]);

	assert.equal(stories.length, 2);
	assert.equal(stories[0].elementKey, "story");
	assert.equal(stories[0].position.pageOrder, 1);
	assert.equal(stories[0].summary, undefined);
	assert.equal(stories[1].kind, "navigation");
	assert.equal(stories[1].position.pageOrder, 2);
});

test("keeps a visible responsive card when a hidden duplicate appears first", () => {
	const hidden = extractedStory({
		canonicalUrl: "https://www.bbc.co.uk/news/articles/responsive-story",
		position: {
			height: 0,
			left: 0,
			pageOrder: 1,
			top: 0,
			viewportDepth: 0,
			width: 0,
		},
	});
	const visible = extractedStory({
		canonicalUrl: hidden.canonicalUrl,
		elementKey: "visible-card",
		position: { ...hidden.position, height: 240, width: 600 },
	});

	const stories = normaliseContentElements([hidden, visible]);

	assert.equal(stories.length, 1);
	assert.equal(stories[0].elementKey, "visible-card");
	assert.equal(stories[0].position.pageOrder, 1);
});

test("keeps media as distinct analysed content and restores visual page order", () => {
	const story = extractedStory({
		canonicalUrl: "https://www.bbc.co.uk/news/articles/story",
		elementKey: "https://www.bbc.co.uk/news/articles/story",
		position: { ...extractedStory().position, top: 600 },
	});
	const video = extractedStory({
		canonicalUrl: undefined,
		elementKey: "video:short-report",
		headline: "Short report from the scene",
		kind: "video",
		position: { ...extractedStory().position, top: 300 },
		textFingerprint: "short report from the scene",
	});
	const duplicateVideo = { ...video, selectorHint: "button" };

	const content = normaliseContentElements([story, video, duplicateVideo]);

	assert.deepEqual(
		content.map(({ elementKey, kind, position }) => [elementKey, kind, position.pageOrder]),
		[
			["video:short-report", "video", 1],
			["https://www.bbc.co.uk/news/articles/story", "story", 2],
		],
	);
});

test("keeps repeated content placements in separate page sections", () => {
	const newsPlacement = extractedStory({
		canonicalUrl: "https://www.bbc.co.uk/sport/golf/live/example",
		elementKey: "https://www.bbc.co.uk/sport/golf/live/example",
		section: "News headlines",
		position: { ...extractedStory().position, top: 200 },
	});
	const sportPlacement = extractedStory({
		...newsPlacement,
		section: "Sport headlines",
		position: { ...newsPlacement.position, top: 900 },
	});

	const content = normaliseContentElements([newsPlacement, sportPlacement]);

	assert.equal(content.length, 2);
	assert.deepEqual(
		content.map(({ elementKey, placementKey, section }) => ({ elementKey, placementKey, section })),
		[
			{
				elementKey: newsPlacement.elementKey,
				placementKey: `${newsPlacement.elementKey}#section=news-headlines&occurrence=1`,
				section: "News headlines",
			},
			{
				elementKey: sportPlacement.elementKey,
				placementKey: `${sportPlacement.elementKey}#section=sport-headlines&occurrence=1`,
				section: "Sport headlines",
			},
		],
	);
});

test("stores compressed HTML and extraction artefacts", async () => {
	const writes = [];
	const page = {
		evaluate: async () => {
			return JSON.stringify({
				elements: [
					extractedStory(),
					extractedStory({
						canonicalUrl: "https://bbc.co.uk/b",
						elementKey: "b",
						headline: "Second headline",
						textFingerprint: "second headline",
					}),
				],
				html: "<!doctype html><html><body>Archive</body></html>",
				pageHeight: 2_000,
				pageWidth: 1_740,
			});
		},
	};
	const outcome = await collectAndStoreAnalysis({
		bucket: { put: async (...args) => writes.push(args) },
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotKey: "screenshot.png",
		site,
		triggeredAt,
	});

	assert.equal(outcome.status, "stored");
	assert.equal(writes.length, 2);
	assert.equal(writes[0][2].httpMetadata.contentEncoding, "gzip");
	assert.match(writes[0][2].customMetadata.contentHash, /^[a-f0-9]{64}$/);
	assert.match(writes[0][2].customMetadata.structureHash, /^[a-f0-9]{64}$/);
});

test("assigns prominence independently of analysed content kind", async () => {
	const writes = [];
	const page = {
		evaluate: async () =>
			JSON.stringify({
				elements: [
					extractedStory({
						position: { ...extractedStory().position, width: 700 },
						prominenceHint: "lead",
					}),
					extractedStory({
						canonicalUrl: "https://www.bbc.co.uk/sport/football/videos/example",
						elementKey: "video",
						headline: "Watch the match highlights",
						kind: "video",
						position: { ...extractedStory().position, top: 500, width: 500 },
						textFingerprint: "watch the match highlights",
					}),
				],
				html: "<html></html>",
				pageHeight: 2_000,
				pageWidth: 1_200,
				warnings: [],
			}),
	};

	await collectAndStoreAnalysis({
		bucket: { put: async (...args) => writes.push(args) },
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotKey: "screenshot.png",
		site,
		triggeredAt,
	});

	const extractionStream = new Blob([writes[1][1]])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const extraction = await new Response(extractionStream).json();
	const video = extraction.elements.find(({ kind }) => kind === "video");

	assert.equal(video.category, "Sport");
	assert.equal(video.prominence, "major");
});

test("optionally stores bounded screenshot-region crops in the screenshot bucket", async () => {
	const archiveWrites = [];
	const cropWrites = [];
	const page = {
		evaluate: async () =>
			JSON.stringify({
				elements: [
					extractedStory({ image: { sourceUrl: "https://example.com/one.jpg" } }),
					extractedStory({
						canonicalUrl: "https://bbc.co.uk/b",
						elementKey: "b",
						headline: "Second headline",
						image: { sourceUrl: "https://example.com/two.jpg" },
					}),
				],
				html: "<html></html>",
				pageHeight: 2_000,
				pageWidth: 1_740,
				warnings: [],
			}),
		screenshot: async () => new Uint8Array([1, 2, 3]),
	};
	await collectAndStoreAnalysis({
		bucket: { put: async (...args) => archiveWrites.push(args) },
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotBucket: { put: async (...args) => cropWrites.push(args) },
		screenshotKey: "screenshot.png",
		site: {
			...site,
			analysis: { ...site.analysis, imageCrops: { maxPerCapture: 1 } },
		},
		triggeredAt,
	});

	assert.equal(cropWrites.length, 1);
	assert.match(cropWrites[0][0], /\.image-01\.jpeg$/);
	const extractionStream = new Blob([archiveWrites[1][1]])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const extraction = await new Response(extractionStream).json();
	assert.equal(extraction.elements[0].image.cropKey, cropWrites[0][0]);
	assert.equal(extraction.elements[1].image.cropKey, undefined);
});

test("stores an explicit failure when extraction is unexpectedly empty", async () => {
	const writes = [];
	const page = {
		evaluate: async () => {
			return JSON.stringify({
				elements: [],
				html: "<html></html>",
				pageHeight: 10,
				pageWidth: 10,
			});
		},
	};
	const outcome = await collectAndStoreAnalysis({
		bucket: { put: async (...args) => writes.push(args) },
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotKey: "screenshot.png",
		site,
		triggeredAt,
	});

	assert.equal(outcome.status, "failed");
	assert.match(outcome.failureKey, /analysis-failure\.json$/);
	assert.match(writes[0][1], /Expected at least 2 analysed elements/);
});

test("reports analysis failure without throwing when private storage is unavailable", async () => {
	const page = {
		evaluate: async () => {
			throw new Error("collection unavailable");
		},
	};
	const outcome = await collectAndStoreAnalysis({
		bucket: {
			put: async () => {
				throw new Error("R2 unavailable");
			},
		},
		capturedAt: "2026-07-17T09:00:10.000Z",
		device: "desktop",
		page,
		profile: "bbc",
		screenshotKey: "screenshot.png",
		site,
		triggeredAt,
	});

	assert.deepEqual(outcome, { status: "failed" });
});
