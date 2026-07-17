export const STV_SITES = [
	{
		name: "stv",
		url: "https://news.stv.tv/",
	},
].map((site) => ({ ...site, category: "news" as const }));
