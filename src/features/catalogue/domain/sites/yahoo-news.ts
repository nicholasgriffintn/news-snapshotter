export const YAHOO_NEWS_SITES = [
	{
		name: "yahoo-news-uk",
		displayName: "Yahoo News UK",
		url: "https://uk.news.yahoo.com/",
		category: "news" as const,
		priority: 2 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "yahoo-news-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
];
