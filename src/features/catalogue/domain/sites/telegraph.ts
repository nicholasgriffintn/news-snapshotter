export const TELEGRAPH_SITES = [
	{
		name: "telegraph-uk",
		url: "https://www.telegraph.co.uk/",
		priority: 1 as const,
		category: "news" as const,
		analysis: {
			device: "desktop" as const,
			extractor: "telegraph-front-page" as const,
			minimumElements: 20,
			version: 2,
		},
	},
	{ name: "telegraph-sport", url: "https://www.telegraph.co.uk/sport", category: "sport" as const },
];
