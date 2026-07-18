export const REACH_SITES = [
	{
		name: "essexLive",
		displayName: "Essex Live",
		url: "https://www.essexlive.news/",
	},
	{
		name: "hertfordshireMercury",
		displayName: "Hertfordshire Mercury",
		url: "https://www.hertfordshiremercury.co.uk/",
	},
	{
		name: "cambridgeNews",
		displayName: "Cambridge News",
		url: "https://www.cambridge-news.co.uk/",
	},
	{
		name: "walesOnline",
		displayName: "Wales Online",
		url: "https://www.walesonline.co.uk/",
	},
	{
		name: "dailyPost",
		displayName: "Daily Post",
		url: "https://www.dailypost.co.uk/",
	},
	{
		name: "manchesterEveningNews",
		displayName: "Manchester Evening News",
		url: "https://www.manchestereveningnews.co.uk/",
	},
	{
		name: "liverpoolEcho",
		displayName: "Liverpool Echo",
		url: "https://www.liverpoolecho.co.uk/",
	},
	{
		name: "lancsLive",
		displayName: "Lancs Live",
		url: "https://www.lancs.live/",
	},
	{
		name: "birminghamLive",
		displayName: "Birmingham Live",
		url: "https://www.birminghammail.co.uk/",
	},
	{
		name: "dailyRecord",
		displayName: "Daily Record",
		url: "https://www.dailyrecord.co.uk/",
	},
	{
		name: "chronicleLive",
		displayName: "Chronicle Live",
		url: "https://www.chroniclelive.co.uk/",
	},
	{
		name: "gazetteLive",
		displayName: "Gazette Live",
		url: "https://www.gazettelive.co.uk/",
	},
	{
		name: "cumbriaCrack",
		displayName: "Cumbria Crack",
		url: "https://cumbriacrack.com/",
	},
	{
		name: "nottinghamPost",
		displayName: "Nottingham Post",
		url: "https://www.nottinghampost.com/",
	},
	{
		name: "leicestermercury",
		displayName: "Leicester Mercury",
		url: "https://www.leicestermercury.co.uk/",
	},
	{
		name: "derbytelegraph",
		displayName: "Derby Telegraph",
		url: "https://www.derbytelegraph.co.uk/",
	},
].map((site) => ({ ...site, category: "news" as const }));
