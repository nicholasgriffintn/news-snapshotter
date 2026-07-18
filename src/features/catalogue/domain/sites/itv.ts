export const ITV_SITES = [
	{
		name: "itv-news",
		displayName: "ITV News",
		url: "https://www.itv.com/news",
		priority: 1 as const,
		requestBody: { addStyleTag: "#cassie-widget { display: none; }" },
	},
].map((site) => ({ ...site, category: "news" as const }));
