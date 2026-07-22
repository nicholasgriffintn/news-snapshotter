export function historyStory(overrides = {}) {
	return {
		canonicalUrl: "https://www.bbc.co.uk/news/articles/story-one",
		elementKey: "https://www.bbc.co.uk/news/articles/story-one",
		headline: "Original BBC headline",
		image: { alt: "Original image", sourceUrl: "https://ichef.bbci.co.uk/one.jpg" },
		kind: "story",
		position: {
			height: 200,
			left: 0,
			pageOrder: 2,
			top: 800,
			viewportDepth: 0.8,
			width: 600,
		},
		prominence: "standard",
		section: "Top stories",
		summary: "Original summary",
		textFingerprint: "original bbc headline",
		...overrides,
	};
}

export function historyExtraction(captureId, capturedAt, overrides = {}) {
	return {
		capture: {
			captureId,
			capturedAt,
			device: "desktop",
			extractor: { name: "bbc-front-page", version: overrides.extractorVersion ?? 1 },
			htmlKey: `${captureId}.html.gz`,
			pageHeight: overrides.pageHeight ?? 10_000,
			pageWidth: 1_000,
			profile: "bbc",
			sanitisationVersion: 1,
			schemaVersion: overrides.schemaVersion ?? 1,
			screenshotKey: `${captureId}.png`,
			site: "bbc-home",
			sourceUrl: "https://www.bbc.co.uk/",
			triggeredAt: capturedAt,
		},
		contentHash: `content-${captureId}`,
		elements: overrides.elements ?? [historyStory()],
		structureHash: `structure-${captureId}`,
		warnings: overrides.warnings ?? [],
	};
}
