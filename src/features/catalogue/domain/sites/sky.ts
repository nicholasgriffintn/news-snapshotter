export const SKY_SITES = [
	{
		name: "sky-com",
		displayName: "Sky News",
		url: "https://news.sky.com/",
		priority: 1 as const,
		requestBody: { addStyleTag: "#notice { display: none; }" },
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "skynews-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
].map((site) => ({ ...site, category: "news" as const }));
