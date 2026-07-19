export const USA_TODAY_SITES = [
	{
		captureRegion: "uk" as const,
		name: "usatoday-eu",
		displayName: "USA Today",
		url: "https://eu.usatoday.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "usatoday-front-page" as const,
			minimumElements: 10,
			version: 1,
		},
	},
];
