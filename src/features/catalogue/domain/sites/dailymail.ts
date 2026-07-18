export const DAILYMAIL_SITES = [
	{
		name: "dailymail-home",
		url: "https://www.dailymail.co.uk/home/index.html",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "generic-baseline" as const,
			minimumElements: 20,
			version: 3,
		},
	},
	{
		name: "dailymail-sport",
		url: "https://www.dailymail.co.uk/sport/index.html",
		category: "sport" as const,
		priority: 1 as const
	},
];
