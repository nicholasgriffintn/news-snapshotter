export const CNN_SITES = [
	{
		captureRegion: "international" as const,
		name: "cnn-com",
		url: "https://edition.cnn.com/",
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "generic-baseline" as const,
			minimumElements: 20,
			version: 3,
		},
	},
	{
		captureRegion: "us" as const,
		name: "cnn-us",
		url: "https://us.cnn.com/?hpt=header_edition-picker",
	},
	{
		captureRegion: "international" as const,
		name: "cnn-international",
		url: "https://edition.cnn.com/?hpt=header_edition-picker",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
