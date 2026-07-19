export const HACKER_NEWS_SITES = [
	{
		captureRegion: "international" as const,
		name: "hackernews",
		displayName: "Hacker News",
		url: "https://news.ycombinator.com/",
		category: "news" as const,
		priority: 2 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "hackernews-front-page" as const,
			minimumElements: 25,
			version: 3,
		},
	},
];
