export const FINANCIAL_TIMES_SITES = [
	{
		captureRegion: "uk" as const,
		name: "financialtimes-uk",
		url: "https://www.ft.com/?edition=uk",
		priority: 1 as const
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
