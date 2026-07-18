export const STV_SITES = [
	{
		name: "stv",
		displayName: "STV News",
		url: "https://news.stv.tv/",
	},
].map((site) => ({ ...site, category: "news" as const }));
