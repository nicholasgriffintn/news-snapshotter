export const WASHINGTON_POST_SITES = [
	{ name: "washingtonpost-com", url: "https://www.washingtonpost.com/" },
].map((site) => ({ ...site, category: "news" as const }));
