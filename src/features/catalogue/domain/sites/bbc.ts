export const BBC_BASE_URL = "https://www.bbc.co.uk";

const BBC_NEWS_SITES = [
	{
		displayName: "BBC",
		name: "bbc-home",
		url: `${BBC_BASE_URL}/`,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "bbc-front-page" as const,
			minimumElements: 20,
			version: 10,
		},
	},
	{
		displayName: "BBC News",
		name: "bbc-news",
		url: `${BBC_BASE_URL}/news`,
		priority: 1 as const,
		requestBody: {
			addStyleTag: ".ssrcss-darju4-ConsentBanner { display: none; }",
		},
		analysis: {
			device: "desktop" as const,
			extractor: "bbc-front-page" as const,
			minimumElements: 20,
			version: 10,
		},
	},
	{
		name: "bbc-bbcindepth",
		displayName: "BBC InDepth",
		url: `${BBC_BASE_URL}/news/bbcindepth`,
	},
	{
		name: "bbc-israel-gaza-war",
		displayName: "BBC Israel-Gaza War",
		url: `${BBC_BASE_URL}/news/topics/c2vdnvdg6xxt`,
	},
	{
		name: "bbc-war-in-ukraine",
		displayName: "BBC War in Ukraine",
		url: `${BBC_BASE_URL}/news/topics/c1vw6q14rzqt`,
	},
	{
		name: "bbc-climate",
		displayName: "BBC Climate",
		url: `${BBC_BASE_URL}/news/topics/cmj34zmwm1zt`,
	},
	{
		name: "bbc-uk",
		displayName: "BBC UK",
		url: `${BBC_BASE_URL}/news/uk`,
	},
	{
		name: "bbc-england",
		displayName: "BBC England",
		url: `${BBC_BASE_URL}/news/england`,
	},
	{
		name: "bbc-northern-ireland",
		displayName: "BBC Northern Ireland",
		url: `${BBC_BASE_URL}/news/northern_ireland`,
	},
	{
		name: "bbc-scotland",
		displayName: "BBC Scotland",
		url: `${BBC_BASE_URL}/news/scotland`,
	},
	{
		name: "bbc-wales",
		displayName: "BBC Wales",
		url: `${BBC_BASE_URL}/news/wales`,
	},
	{
		name: "bbc-world",
		displayName: "BBC World",
		url: `${BBC_BASE_URL}/news/world`,
	},
	{
		name: "bbc-business",
		displayName: "BBC Business",
		url: `${BBC_BASE_URL}/news/business`,
	},
	{
		name: "bbc-politics",
		displayName: "BBC Politics",
		url: `${BBC_BASE_URL}/news/politics`,
	},
	{
		name: "bbc-culture",
		displayName: "BBC Culture",
		url: `${BBC_BASE_URL}/news/entertainment_and_arts`,
	},
].map((site) => ({ ...site, category: "news" as const }));

const BBC_SPORT_SITES = [
	{
		displayName: "BBC Sport",
		name: "bbc-sport",
		url: `${BBC_BASE_URL}/sport`,
		priority: 1 as const,
		analysis: {
			device: "desktop" as const,
			extractor: "bbc-front-page" as const,
			minimumElements: 20,
			version: 10,
		},
	},
	{
		name: "bbc-football",
		displayName: "BBC Football",
		url: `${BBC_BASE_URL}/sport/football`,
	},
	{
		name: "bbc-premier-league",
		displayName: "BBC Premier League",
		url: `${BBC_BASE_URL}/sport/football/premier-league`,
	},
	{
		name: "bbc-cricket",
		displayName: "BBC Cricket",
		url: `${BBC_BASE_URL}/sport/cricket`,
	},
	{
		name: "bbc-formula1",
		displayName: "BBC Formula 1",
		url: `${BBC_BASE_URL}/sport/formula1`,
	},
	{
		name: "bbc-rugby-union",
		displayName: "BBC Rugby Union",
		url: `${BBC_BASE_URL}/sport/rugby-union`,
	},
	{
		name: "bbc-rugby-league",
		displayName: "BBC Rugby League",
		url: `${BBC_BASE_URL}/sport/rugby-league`,
	},
	{
		name: "bbc-tennis",
		displayName: "BBC Tennis",
		url: `${BBC_BASE_URL}/sport/tennis`,
	},
	{
		name: "bbc-golf",
		displayName: "BBC Golf",
		url: `${BBC_BASE_URL}/sport/golf`,
	},
	{
		name: "bbc-boxing",
		displayName: "BBC Boxing",
		url: `${BBC_BASE_URL}/sport/boxing`,
	},
	{
		name: "bbc-athletics",
		displayName: "BBC Athletics",
		url: `${BBC_BASE_URL}/sport/athletics`,
	},
	{
		name: "bbc-horse-racing",
		displayName: "BBC Horse Racing",
		url: `${BBC_BASE_URL}/sport/horse-racing`,
	},
	{
		name: "bbc-darts",
		displayName: "BBC Darts",
		url: `${BBC_BASE_URL}/sport/darts`,
	},
	{
		name: "bbc-snooker",
		displayName: "BBC Snooker",
		url: `${BBC_BASE_URL}/sport/snooker`,
	},
	{
		name: "bbc-cycling",
		displayName: "BBC Cycling",
		url: `${BBC_BASE_URL}/sport/cycling`,
	},
].map((site) => ({ ...site, category: "sport" as const }));

export const BBC_SITES = [...BBC_NEWS_SITES, ...BBC_SPORT_SITES];
