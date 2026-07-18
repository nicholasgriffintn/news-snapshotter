export const NEW_YORK_TIMES_SITES = [
	{
		captureRegion: "us" as const,
		name: "nytimes-us",
		displayName: "The New York Times",
		url: "https://www.nytimes.com/",
		category: "news" as const,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "nytimes-front-page" as const,
			minimumElements: 20,
			version: 3,
		},
	},
	{
		captureRegion: "international" as const,
		name: "nytimes-international",
		displayName: "The New York Times International",
		url: "https://www.nytimes.com/international",
		category: "news" as const,
		priority: 1 as const,
	},
	{
		captureRegion: "uk" as const,
		name: "nytimes-athleticuk",
		displayName: "The New York Times Athletic UK",
		url: "https://www.nytimes.com/athletic/uk/",
		category: "sport" as const,
		priority: 2 as const,
	},
];
