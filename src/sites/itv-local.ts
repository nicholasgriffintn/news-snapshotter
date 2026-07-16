export const ITV_LOCAL_BASE_URL = 'https://www.itv.com/';

export const ITV_LOCAL_SITES = [
  {
    name: "itv-anglia",
    url: `${ITV_LOCAL_BASE_URL}news/anglia`
  },
  {
    name: "itv-wales",
    url: `${ITV_LOCAL_BASE_URL}news/wales`
  },
  {
    name: "itv-meridian",
    url: `${ITV_LOCAL_BASE_URL}news/meridian`
  },
].map((site) => ({ ...site, category: 'news' as const }));
