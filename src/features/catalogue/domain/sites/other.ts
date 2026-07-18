export const OTHER_SITES = [
	{
		name: "heraldScotland",
		displayName: "Herald Scotland",
		url: "https://www.heraldscotland.com/",
	},
	{
		name: "scotsman",
		displayName: "The Scotsman",
		url: "https://www.scotsman.com/",
	},
	{
		name: "edinburghNews",
		displayName: "Edinburgh News",
		url: "https://www.edinburghnews.scotsman.com/",
	},
	{
		name: "sunderlandecho",
		displayName: "Sunderland Echo",
		url: "https://www.sunderlandecho.com/",
	},
	{
		name: "hartlepoolMail",
		displayName: "Hartlepool Mail",
		url: "https://www.hartlepoolmail.co.uk/",
	},
	{
		name: "shieldsGazette",
		displayName: "Shields Gazette",
		url: "https://www.shieldsgazette.com/",
	},
	{
		name: "banburyGuardian",
		displayName: "Banbury Guardian",
		url: "https://www.banburyguardian.co.uk/",
	},
	{
		name: "portsmouth",
		displayName: "Portsmouth",
		url: "https://www.portsmouth.co.uk/",
	},
	{
		name: "isleOfWightLive",
		displayName: "Isle of Wight Live",
		url: "https://www.islandecho.co.uk/",
	},
	{
		name: "northamptonchron",
		displayName: "Northampton Chronicle",
		url: "https://www.northamptonchron.co.uk/",
	},
	{
		name: "northantstelegraph",
		displayName: "Northants Telegraph",
		url: "https://www.northantstelegraph.co.uk/",
	},
	{
		name: "northantslive",
		displayName: "Northants Live",
		url: "https://www.northantslive.news/",
	},
].map((site) => ({ ...site, category: "news" as const }));
