export const WASHINGTON_POST_SITES = [
	{
		captureRegion: "us" as const,
		name: "washingtonpost-com",
		displayName: "The Washington Post",
		priority: 1 as const,
		url: "https://www.washingtonpost.com/",
		analysis: {
			device: "desktop" as const,
			extractor: "washingtonpost-front-page" as const,
			minimumElements: 20,
			version: 3,
		},
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
