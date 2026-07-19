export const AP_NEWS_SITES = [
	{
		captureRegion: "us" as const,
		name: "apnews-com",
		displayName: "AP News",
		url: "https://apnews.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "apnews-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
