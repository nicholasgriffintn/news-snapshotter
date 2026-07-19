export const CNN_SITES = [
	{
		captureRegion: "international" as const,
		name: "cnn-com",
		displayName: "CNN International",
		url: "https://edition.cnn.com/",
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "cnn-front-page" as const,
			minimumElements: 20,
			version: 4,
		},
	},
	{
		captureRegion: "us" as const,
		name: "cnn-us",
		displayName: "CNN US",
		url: "https://us.cnn.com/?hpt=header_edition-picker",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
