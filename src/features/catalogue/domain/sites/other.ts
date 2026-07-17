export const OTHER_SITES = [
	{
		name: "heraldScotland",
		url: "https://www.heraldscotland.com/",
	},
	{
		name: "scotsman",
		url: "https://www.scotsman.com/",
	},
	{
		name: "edinburghNews",
		url: "https://www.edinburghnews.scotsman.com/",
	},
	{
		name: "sunderlandecho",
		url: "https://www.sunderlandecho.com/",
	},
	{
		name: "hartlepoolMail",
		url: "https://www.hartlepoolmail.co.uk/",
	},
	{
		name: "shieldsGazette",
		url: "https://www.shieldsgazette.com/",
	},
	{
		name: "banburyGuardian",
		url: "https://www.banburyguardian.co.uk/",
	},
	{
		name: "portsmouth",
		url: "https://www.portsmouth.co.uk/",
	},
	{
		name: "isleOfWightLive",
		url: "https://www.islandecho.co.uk/",
	},
	{
		name: "northamptonchron",
		url: "https://www.northamptonchron.co.uk/",
	},
	{
		name: "northantstelegraph",
		url: "https://www.northantstelegraph.co.uk/",
	},
	{
		name: "northantslive",
		url: "https://www.northantslive.news/",
	},
].map((site) => ({ ...site, category: "news" as const }));
