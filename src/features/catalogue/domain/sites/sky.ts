export const SKY_SITES = [
	{
		name: "sky-com",
		url: "https://news.sky.com/",
		priority: 1 as const,
		requestBody: { addStyleTag: "#notice { display: none; }" },
	},
].map((site) => ({ ...site, category: "news" as const }));
