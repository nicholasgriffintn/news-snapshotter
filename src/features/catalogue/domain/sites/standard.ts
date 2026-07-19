export const STANDARD_SITES = [
	{
		name: "standard-uk",
		displayName: "The Standard",
		url: "https://www.standard.co.uk/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "standard-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
