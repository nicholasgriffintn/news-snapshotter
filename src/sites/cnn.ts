export const CNN_SITES = [
	{ name: 'cnn-com', url: 'https://edition.cnn.com/' },
	{ name: 'cnn-us', url: 'https://us.cnn.com/?hpt=header_edition-picker' },
	{ name: 'cnn-international', url: 'https://edition.cnn.com/?hpt=header_edition-picker' },
].map((site) => ({ ...site, category: 'news' as const }));
