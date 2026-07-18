export const TIMES_SITES = [
	{
		name: "times-com",
		url: "https://www.thetimes.com/",
		priority: 1 as const,
		category: "news" as const,
		analysis: {
			device: "desktop" as const,
			extractor: "generic-baseline" as const,
			minimumElements: 20,
			version: 3,
		},
	},
	{ name: "times-sport", url: "https://www.thetimes.com/sport", category: "sport" as const },
];
