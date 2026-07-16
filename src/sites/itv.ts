export const ITV_SITES = [
	{
		name: 'itv-news',
		url: 'https://www.itv.com/news',
		requestBody: { addStyleTag: '#cassie-widget { display: none; }' },
	},
].map((site) => ({ ...site, category: 'news' as const }));
