export const BLOOMBERG_SITES = [
	{
		captureRegion: "us" as const,
		name: "bloomberg-us",
		url: "https://www.bloomberg.com/",
	},
	{
		captureRegion: "uk" as const,
		name: "bloomberg-uk",
		url: "https://www.bloomberg.com/",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
