export const GUARDIAN_SITES = [
	{
		name: "guardian-uk",
		url: "https://www.theguardian.com/uk",
		category: "news" as const,
		priority: 1 as const,
		requestBody: {
			addStyleTag: "#notice { display: none; }",
		},
		analysis: {
			device: "desktop" as const,
			extractor: "guardian-front-page" as const,
			minimumElements: 20,
			version: 1,
		},
	},
	{
		name: "guardian-sport",
		url: "https://www.theguardian.com/uk/sport",
		category: "sport" as const,
		priority: 2 as const,
		requestBody: {
			addStyleTag: "#notice { display: none; }",
		},
	},
];
