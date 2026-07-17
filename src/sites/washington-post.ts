export const WASHINGTON_POST_SITES = [
	{
		captureRegion: "us" as const,
		name: "washingtonpost-com",
		url: "https://www.washingtonpost.com/",
	},
].map((site) => {
	return {
		...site,
		category: "news" as const,
	};
});
