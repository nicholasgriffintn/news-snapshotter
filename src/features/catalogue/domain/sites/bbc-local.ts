export const BBC_LOCAL_BASE_URL = "https://www.bbc.co.uk";

export const BBC_LOCAL_SITES = [
	{
		name: "bbc-cambridgeshire",
		displayName: "BBC Cambridgeshire",
		url: `${BBC_LOCAL_BASE_URL}/news/england/cambridgeshire`,
	},
	{
		name: "bbc-essex",
		displayName: "BBC Essex",
		url: `${BBC_LOCAL_BASE_URL}/news/england/essex`,
	},
	{
		name: "bbc-norfolk",
		displayName: "BBC Norfolk",
		url: `${BBC_LOCAL_BASE_URL}/news/england/norfolk`,
	},
	{
		name: "bbc-suffolk",
		displayName: "BBC Suffolk",
		url: `${BBC_LOCAL_BASE_URL}/news/england/suffolk`,
	},
	{
		name: "bbc-beds_bucks_and_herts",
		displayName: "BBC Beds, Bucks & Herts",
		url: `${BBC_LOCAL_BASE_URL}/news/england/beds_bucks_and_herts`,
	},
	{
		name: "bbc-wales",
		displayName: "BBC Wales",
		url: `${BBC_LOCAL_BASE_URL}/news/wales`,
	},
	{
		name: "bbc-manchester",
		displayName: "BBC Manchester",
		url: `${BBC_LOCAL_BASE_URL}/news/england/manchester`,
	},
	{
		name: "bbc-birmingham",
		displayName: "BBC Birmingham & Black Country",
		url: `${BBC_LOCAL_BASE_URL}/news/england/birmingham_and_black_country`,
	},
	{
		name: "bbc-scotland",
		displayName: "BBC Scotland",
		url: `${BBC_LOCAL_BASE_URL}/news/scotland`,
	},
	{
		name: "bbc-tyne",
		displayName: "BBC Tyne",
		url: `${BBC_LOCAL_BASE_URL}/news/england/tyne`,
	},
	{
		name: "bbc-nottingham",
		displayName: "BBC Nottingham",
		url: `${BBC_LOCAL_BASE_URL}/news/england/nottingham`,
	},
	{
		name: "bbc-tees",
		displayName: "BBC Tees",
		url: `${BBC_LOCAL_BASE_URL}/news/england/tees`,
	},
	{
		name: "bbc-wear",
		displayName: "BBC Wear",
		url: `${BBC_LOCAL_BASE_URL}/news/england/wear`,
	},
	{
		name: "bbc-northamptonshire",
		displayName: "BBC Northamptonshire",
		url: `${BBC_LOCAL_BASE_URL}/news/england/northamptonshire`,
	},
].map((site) => ({ ...site, category: "news" as const }));
