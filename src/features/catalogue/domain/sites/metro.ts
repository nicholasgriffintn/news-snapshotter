export const METRO_SITES = [
	{
		displayName: "Metro",
		name: "metro",
		url: "https://metro.co.uk/",
		priority: 1 as const,
		category: "news" as const,
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "metro-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
