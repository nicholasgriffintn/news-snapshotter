export const INDEPENDENT_SITES = [
	{
		displayName: "The Independent",
		name: "independent",
		url: "https://www.independent.co.uk/",
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "independent-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
		priority: 1 as const,
		category: "news" as const,
	},
	{
		displayName: "The Independent Sport",
		name: "independent-sport",
		url: "https://www.independent.co.uk/sport",
		category: "sport" as const,
	},
];
