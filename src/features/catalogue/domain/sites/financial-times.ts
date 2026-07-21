export const FINANCIAL_TIMES_SITES = [
	{
		captureRegion: "uk" as const,
		name: "financialtimes-uk",
		displayName: "Financial Times UK",
		url: "https://www.ft.com/?edition=uk",
		priority: 1 as const,
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "financialtimes-front-page" as const,
			minimumElements: 20,
			version: 2,
		},
	},
	{
		captureRegion: "international" as const,
		name: "financialtimes-international",
		displayName: "Financial Times International",
		url: "https://www.ft.com/?edition=international",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
