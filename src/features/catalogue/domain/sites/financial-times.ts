export const FINANCIAL_TIMES_SITES = [
	{
		captureRegion: "uk" as const,
		name: "financialtimes-uk",
		url: "https://www.ft.com/?edition=uk",
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "generic-baseline" as const,
			minimumElements: 20,
			version: 3,
		},
	},
	{
		captureRegion: "international" as const,
		name: "financialtimes-international",
		url: "https://www.ft.com/?edition=international",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
