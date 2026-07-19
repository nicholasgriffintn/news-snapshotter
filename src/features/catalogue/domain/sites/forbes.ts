export const FORBES_SITES = [
	{
		captureRegion: "us" as const,
		name: "forbes-com",
		displayName: "Forbes",
		url: "https://www.forbes.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "forbes-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
