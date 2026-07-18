export const NEWSQUEST_SITES = [
	{
		name: "bucksfreepress",
		displayName: "Bucks Free Press",
		url: "https://www.bucksfreepress.co.uk/",
	},
	{
		name: "hertsad",
		displayName: "Herts Advertiser",
		url: "https://www.hertsad.co.uk/",
	},
	{
		name: "watfordobserver",
		displayName: "Watford Observer",
		url: "https://www.watfordobserver.co.uk/",
	},
	{
		name: "theEcho",
		displayName: "The Echo",
		url: "https://www.echo-news.co.uk/",
	},
	{
		name: "eadt",
		displayName: "East Anglian Daily Times",
		url: "https://www.eadt.co.uk/",
	},
	{
		name: "edp24",
		displayName: "Eastern Daily Press",
		url: "https://www.edp24.co.uk/",
	},
	{
		name: "eveningnews24",
		displayName: "Evening News 24",
		url: "https://www.eveningnews24.co.uk/",
	},
	{
		name: "ipswichstar",
		displayName: "Ipswich Star",
		url: "https://www.ipswichstar.co.uk/",
	},
	{
		name: "expressAndStar",
		displayName: "Express and Star",
		url: "https://www.expressandstar.com/",
	},
	{
		name: "dudleyNews",
		displayName: "Dudley News",
		url: "https://www.dudleynews.co.uk/",
	},
	{
		name: "pressAndJournal",
		displayName: "Press and Journal",
		url: "https://www.pressandjournal.co.uk/",
	},
	{
		name: "glasgowTimes",
		displayName: "Glasgow Times",
		url: "https://www.glasgowtimes.co.uk/",
	},
	{
		name: "theNorthernEcho",
		displayName: "The Northern Echo",
		url: "https://www.thenorthernecho.co.uk/",
	},
	{
		name: "nwemail",
		displayName: "North West Evening Mail",
		url: "https://www.nwemail.co.uk/",
	},
	{
		name: "newsAndStar",
		displayName: "News and Star",
		url: "https://www.newsandstar.co.uk/",
	},
	{
		name: "oxfordMail",
		displayName: "Oxford Mail",
		url: "https://www.oxfordmail.co.uk/",
	},
	{
		name: "dailyEcho",
		displayName: "Daily Echo",
		url: "https://www.dailyecho.co.uk/",
	},
	{
		name: "basingstokeGazette",
		displayName: "Basingstoke Gazette",
		url: "https://www.basingstokegazette.co.uk/",
	},
	{
		name: "bournemouthEcho",
		displayName: "Bournemouth Echo",
		url: "https://www.bournemouthecho.co.uk/",
	},
	{
		name: "dorsetEcho",
		displayName: "Dorset Echo",
		url: "https://www.dorsetecho.co.uk/",
	},
].map((site) => ({ ...site, category: "news" as const }));
