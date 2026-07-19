export const INEWS_SITES = [
	{
		name: "inews-uk",
		displayName: "The i Paper",
		url: "https://inews.co.uk/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "inews-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
