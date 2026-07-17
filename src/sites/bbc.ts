export const BBC_BASE_URL = 'https://www.bbc.co.uk';

const BBC_NEWS_SITES = [
	{
		name: 'bbc-home',
		url: `${BBC_BASE_URL}/`,
		analysis: {
			device: 'desktop' as const,
			extractor: 'bbc-front-page' as const,
			minimumElements: 20,
			version: 1,
		},
	},
	{
		name: 'bbc-news',
		url: `${BBC_BASE_URL}/news`,
		requestBody: {
			addStyleTag: '.ssrcss-darju4-ConsentBanner { display: none; }',
		},
	},
	{ name: 'bbc-bbcindepth', url: `${BBC_BASE_URL}/news/bbcindepth` },
	{ name: 'bbc-israel-gaza-war', url: `${BBC_BASE_URL}/news/topics/c2vdnvdg6xxt` },
	{ name: 'bbc-war-in-ukraine', url: `${BBC_BASE_URL}/news/topics/c1vw6q14rzqt` },
	{ name: 'bbc-climate', url: `${BBC_BASE_URL}/news/topics/cmj34zmwm1zt` },
	{ name: 'bbc-uk', url: `${BBC_BASE_URL}/news/uk` },
	{ name: 'bbc-england', url: `${BBC_BASE_URL}/news/england` },
	{ name: 'bbc-northern-ireland', url: `${BBC_BASE_URL}/news/northern_ireland` },
	{ name: 'bbc-scotland', url: `${BBC_BASE_URL}/news/scotland` },
	{ name: 'bbc-wales', url: `${BBC_BASE_URL}/news/wales` },
	{ name: 'bbc-world', url: `${BBC_BASE_URL}/news/world` },
	{ name: 'bbc-business', url: `${BBC_BASE_URL}/news/business` },
	{ name: 'bbc-politics', url: `${BBC_BASE_URL}/news/politics` },
	{ name: 'bbc-culture', url: `${BBC_BASE_URL}/news/entertainment_and_arts` },
].map((site) => ({ ...site, category: 'news' as const }));

const BBC_SPORT_SITES = [
	{ name: 'bbc-sport', url: `${BBC_BASE_URL}/sport` },
	{ name: 'bbc-football', url: `${BBC_BASE_URL}/sport/football` },
	{ name: 'bbc-premier-league', url: `${BBC_BASE_URL}/sport/football/premier-league` },
	{ name: 'bbc-cricket', url: `${BBC_BASE_URL}/sport/cricket` },
	{ name: 'bbc-formula1', url: `${BBC_BASE_URL}/sport/formula1` },
	{ name: 'bbc-rugby-union', url: `${BBC_BASE_URL}/sport/rugby-union` },
	{ name: 'bbc-rugby-league', url: `${BBC_BASE_URL}/sport/rugby-league` },
	{ name: 'bbc-tennis', url: `${BBC_BASE_URL}/sport/tennis` },
	{ name: 'bbc-golf', url: `${BBC_BASE_URL}/sport/golf` },
	{ name: 'bbc-boxing', url: `${BBC_BASE_URL}/sport/boxing` },
	{ name: 'bbc-athletics', url: `${BBC_BASE_URL}/sport/athletics` },
	{ name: 'bbc-horse-racing', url: `${BBC_BASE_URL}/sport/horse-racing` },
	{ name: 'bbc-darts', url: `${BBC_BASE_URL}/sport/darts` },
	{ name: 'bbc-snooker', url: `${BBC_BASE_URL}/sport/snooker` },
	{ name: 'bbc-cycling', url: `${BBC_BASE_URL}/sport/cycling` },
].map((site) => ({ ...site, category: 'sport' as const }));

export const BBC_SITES = [...BBC_NEWS_SITES, ...BBC_SPORT_SITES];
