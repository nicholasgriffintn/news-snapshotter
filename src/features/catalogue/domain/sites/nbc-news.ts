export const NBC_NEWS_SITES = [
	{
		captureRegion: "us" as const,
		name: "nbcnews-com",
		displayName: "NBC News",
		url: "https://www.nbcnews.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "nbcnews-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
