export const GUARDIAN_SITES = [
	{
		name: 'guardian-uk',
		url: 'https://www.theguardian.com/uk',
		category: 'news' as const,
		requestBody: { addStyleTag: '#notice { display: none; }' },
	},
	{
		name: 'guardian-sport',
		url: 'https://www.theguardian.com/uk/sport',
		category: 'sport' as const,
		requestBody: { addStyleTag: '#notice { display: none; }' },
	},
];
