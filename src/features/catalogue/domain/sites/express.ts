export const EXPRESS_SITES = [
	{
		name: "express-news",
		displayName: "Express News",
		url: "https://www.express.co.uk/news",
		category: "news" as const,
		priority: 2 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "express-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
