export const SKY_SITES = [
	{
		name: "sky-com",
		url: "https://news.sky.com/",
		requestBody: { addStyleTag: "#notice { display: none; }" },
	},
].map((site) => ({ ...site, category: "news" as const }));
