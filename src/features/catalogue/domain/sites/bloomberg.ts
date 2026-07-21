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
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "bloomberg-front-page" as const,
			minimumElements: 20,
			version: 4,
		},
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
