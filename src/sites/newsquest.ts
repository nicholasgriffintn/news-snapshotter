export const NEWSQUEST_SITES = [
	{
		name: "bucksfreepress",
		url: "https://www.bucksfreepress.co.uk/",
	},
	{
		name: "hertsad",
		url: "https://www.hertsad.co.uk/",
	},
	{
		name: "watfordobserver",
		url: "https://www.watfordobserver.co.uk/",
	},
	{
		name: "theEcho",
		url: "https://www.echo-news.co.uk/",
	},
	{
		name: "eadt",
		url: "https://www.eadt.co.uk/",
	},
	{
		name: "edp24",
		url: "https://www.edp24.co.uk/",
	},
	{
		name: "eveningnews24",
		url: "https://www.eveningnews24.co.uk/",
	},
	{
		name: "ipswichstar",
		url: "https://www.ipswichstar.co.uk/",
	},
	{
		name: "expressAndStar",
		url: "https://www.expressandstar.com/",
	},
	{
		name: "dudleyNews",
		url: "https://www.dudleynews.co.uk/",
	},
	{
		name: "pressAndJournal",
		url: "https://www.pressandjournal.co.uk/",
	},
	{
		name: "glasgowTimes",
		url: "https://www.glasgowtimes.co.uk/",
	},
	{
		name: "theNorthernEcho",
		url: "https://www.thenorthernecho.co.uk/",
	},
	{
		name: "nwemail",
		url: "https://www.nwemail.co.uk/",
	},
	{
		name: "newsAndStar",
		url: "https://www.newsandstar.co.uk/",
	},
	{
		name: "oxfordMail",
		url: "https://www.oxfordmail.co.uk/",
	},
	{
		name: "dailyEcho",
		url: "https://www.dailyecho.co.uk/",
	},
	{
		name: "basingstokeGazette",
		url: "https://www.basingstokegazette.co.uk/",
	},
	{
		name: "bournemouthEcho",
		url: "https://www.bournemouthecho.co.uk/",
	},
	{
		name: "dorsetEcho",
		url: "https://www.dorsetecho.co.uk/",
	},
].map((site) => ({ ...site, category: "news" as const }));
