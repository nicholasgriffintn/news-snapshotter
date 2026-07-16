export const REACH_SITES = [
  {
    name: "essexLive",
    url: "https://www.essexlive.news/"
  },
  {
    name: "hertfordshireMercury",
    url: "https://www.hertfordshiremercury.co.uk/"
  },
  {
    name: "cambridgeNews",
    url: "https://www.cambridge-news.co.uk/"
  },
  {
    name: "walesOnline",
    url: "https://www.walesonline.co.uk/"
  },
  {
    name: "dailyPost",
    url: "https://www.dailypost.co.uk/"
  },
  {
    name: "manchesterEveningNews",
    url: "https://www.manchestereveningnews.co.uk/"
  },
  {
    name: "liverpoolEcho",
    url: "https://www.liverpoolecho.co.uk/"
  },
  {
    name: "lancsLive",
    url: "https://www.lancs.live/"
  },
  {
    name: "birminghamLive",
    url: "https://www.birminghammail.co.uk/"
  },
  {
    name: "dailyRecord",
    url: "https://www.dailyrecord.co.uk/"
  },
  {
    name: "chronicleLive",
    url: "https://www.chroniclelive.co.uk/"
  },
  {
    name: "gazetteLive",
    url: "https://www.gazettelive.co.uk/"
  },
  {
    name: "cumbriaCrack",
    url: "https://cumbriacrack.com/"
  },
  {
    name: "nottinghamPost",
    url: "https://www.nottinghampost.com/"
  },
  {
    name: "leicestermercury",
    url: "https://www.leicestermercury.co.uk/"
  },
  {
    name: "derbytelegraph",
    url: "https://www.derbytelegraph.co.uk/"
  }
].map((site) => ({ ...site, category: 'news' as const }));
