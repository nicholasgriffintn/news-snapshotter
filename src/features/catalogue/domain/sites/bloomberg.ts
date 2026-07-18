export const BLOOMBERG_SITES = [
	{
		captureRegion: "us" as const,
		name: "bloomberg-us",
		displayName: "Bloomberg US",
		url: "https://www.bloomberg.com/",
	},
	{
		captureRegion: "uk" as const,
		name: "bloomberg-uk",
		displayName: "Bloomberg UK",
		url: "https://www.bloomberg.com/uk",
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "generic-baseline" as const,
			minimumElements: 20,
			version: 3,
		},
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
