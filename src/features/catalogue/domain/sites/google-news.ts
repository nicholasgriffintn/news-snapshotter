export const GOOGLE_NEWS_SITES = [
	{
		name: "google-news-uk",
		displayName: "Google News UK",
		url: "https://news.google.com/home?hl=en-GB&gl=GB&ceid=GB:en&ucbcb=1",
		category: "news" as const,
		priority: 2 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "google-news-front-page" as const,
			minimumElements: 20,
			version: 2,
		},
	},
];
