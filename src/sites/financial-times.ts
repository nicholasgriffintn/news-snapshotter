export const FINANCIAL_TIMES_SITES = [
	{ name: "financialtimes-uk", url: "https://www.ft.com/?edition=uk" },
	{ name: "financialtimes-international", url: "https://www.ft.com/?edition=international" },
].map((site) => ({ ...site, category: "news" as const }));
