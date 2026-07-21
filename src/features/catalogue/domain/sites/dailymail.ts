export const DAILYMAIL_SITES = [
	{
		name: "dailymail-home",
		displayName: "Daily Mail",
		url: "https://www.dailymail.com/home/index.html",
		category: "news" as const,
		priority: 1 as const,
		comparison: {
			cohorts: ["uk-national-hourly"],
			enabled: true,
			jurisdiction: "GB",
			language: "en",
			maxHomepageItems: 40,
		},
		analysis: {
			device: "desktop" as const,
			extractor: "dailymail-front-page" as const,
			minimumElements: 20,
			version: 4,
		},
	},
	{
		name: "dailymail-sport",
		displayName: "Daily Mail Sport",
		url: "https://www.dailymail.com/sport/index.html",
		category: "sport" as const,
		priority: 1 as const,
	},
];
