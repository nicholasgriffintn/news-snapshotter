export const TIMES_SITES = [
	{
		displayName: "The Times",
		name: "times-com",
		url: "https://www.thetimes.com/",
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
			extractor: "times-front-page" as const,
			minimumElements: 20,
			version: 5,
		},
	},
	{
		displayName: "The Times Sport",
		name: "times-sport",
		url: "https://www.thetimes.com/sport",
		category: "sport" as const,
	},
];
