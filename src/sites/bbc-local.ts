export const BBC_LOCAL_BASE_URL = 'https://www.bbc.co.uk';

export const BBC_LOCAL_SITES = [
    {
        name: "bbc-cambridgeshire",
        url: `${BBC_LOCAL_BASE_URL}/news/england/cambridgeshire`
    },
    {
        name: "bbc-essex",
        url: `${BBC_LOCAL_BASE_URL}/news/england/essex`
    },
    {
        name: "bbc-norfolk",
        url: `${BBC_LOCAL_BASE_URL}/news/england/norfolk`
    },
    {
        name: "bbc-suffolk",
        url: `${BBC_LOCAL_BASE_URL}/news/england/suffolk`
    },
    {
        name: "bbc-beds_bucks_and_herts",
        url: `${BBC_LOCAL_BASE_URL}/news/england/beds_bucks_and_herts`
    },
    {
        name: "bbc-wales",
        url: `${BBC_LOCAL_BASE_URL}/news/wales`
    },
    {
        name: "bbc-manchester",
        url: `${BBC_LOCAL_BASE_URL}/news/england/manchester`
    },
    {
        name: "bbc-birmingham",
        url: `${BBC_LOCAL_BASE_URL}/news/england/birmingham_and_black_country`
    },
    {
        name: "bbc-scotland",
        url: `${BBC_LOCAL_BASE_URL}/news/scotland`
    },
    {
        name: "bbc-tyne",
        url: `${BBC_LOCAL_BASE_URL}/news/england/tyne`
    },
    {
        name: "bbc-nottingham",
        url: `${BBC_LOCAL_BASE_URL}/news/england/nottingham`
    },
    {
        name: "bbc-tees",
        url: `${BBC_LOCAL_BASE_URL}/news/england/tees`
    },
    {
        name: "bbc-wear",
        url: `${BBC_LOCAL_BASE_URL}/news/england/wear`
    },
    {
        name: "bbc-northamptonshire",
        url: `${BBC_LOCAL_BASE_URL}/news/england/northamptonshire`
    }
].map((site) => ({ ...site, category: 'news' as const }));
