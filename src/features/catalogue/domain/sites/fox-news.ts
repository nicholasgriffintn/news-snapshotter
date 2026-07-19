export const FOX_NEWS_SITES = [
	{
		captureRegion: "us" as const,
		name: "foxnews-com",
		displayName: "Fox News",
		url: "https://www.foxnews.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "foxnews-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
