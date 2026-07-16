export const BLOOMBERG_SITES = [
	{ name: 'bloomberg-us', url: 'https://www.bloomberg.com/' },
	{ name: 'bloomberg-uk', url: 'https://www.bloomberg.com/' },
].map((site) => ({ ...site, category: 'news' as const }));
