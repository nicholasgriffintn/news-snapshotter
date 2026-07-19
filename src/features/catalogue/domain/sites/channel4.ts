export const CHANNEL4_SITES = [
	{
		name: "channel4-news",
		displayName: "Channel 4 News",
		url: "https://www.channel4.com/news/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "channel4-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
