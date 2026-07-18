import { withBrand, withIndividualBrands, withoutDuplicateNames } from "./site-catalogue.ts";
import { BBC_LOCAL_SITES } from "./sites/bbc-local.ts";
import { BBC_SITES } from "./sites/bbc.ts";
import { BELFAST_LIVE_SITES } from "./sites/belfast-live.ts";
import { BELFAST_TELEGRAPH_SITES } from "./sites/belfast-telegraph.ts";
import { BLOOMBERG_SITES } from "./sites/bloomberg.ts";
import { CNN_SITES } from "./sites/cnn.ts";
import { DAILYMAIL_SITES } from "./sites/dailymail.ts";
import { ESPN_SITES } from "./sites/espn.ts";
import { FINANCIAL_TIMES_SITES } from "./sites/financial-times.ts";
import { GIVEMESPORT_SITES } from "./sites/givemesport.ts";
import { GUARDIAN_SITES } from "./sites/guardian.ts";
import { INDEPENDENT_SITES } from "./sites/independent.ts";
import { ITV_LOCAL_SITES } from "./sites/itv-local.ts";
import { ITV_SITES } from "./sites/itv.ts";
import { METRO_SITES } from "./sites/metro.ts";
import { NEW_YORK_TIMES_SITES } from "./sites/new-york-times.ts";
import { NEWSQUEST_SITES } from "./sites/newsquest.ts";
import { OTHER_SITES } from "./sites/other.ts";
import { REACH_SITES } from "./sites/reach.ts";
import { SKY_SPORTS_SITES } from "./sites/sky-sports.ts";
import { SKY_SITES } from "./sites/sky.ts";
import { STV_SITES } from "./sites/stv.ts";
import { TELEGRAPH_SITES } from "./sites/telegraph.ts";
import { TIMES_SITES } from "./sites/times.ts";
import { WASHINGTON_POST_SITES } from "./sites/washington-post.ts";

export const SITES = [
	...withBrand("bbc", BBC_SITES),
	...withBrand("bbc", withoutDuplicateNames(BBC_LOCAL_SITES, BBC_SITES), "local"),
	...withBrand("times", TIMES_SITES),
	...withBrand("nytimes", NEW_YORK_TIMES_SITES),
	...withBrand("sky", SKY_SITES),
	...withBrand("skysports", SKY_SPORTS_SITES),
	...withBrand("dailymail", DAILYMAIL_SITES),
	...withBrand("guardian", GUARDIAN_SITES),
	...withBrand("itv", ITV_SITES),
	...withBrand("itv", ITV_LOCAL_SITES, "local"),
	...withBrand("stv", STV_SITES),
	...withBrand("metro", METRO_SITES),
	...withBrand("cnn", CNN_SITES),
	...withBrand("washingtonpost", WASHINGTON_POST_SITES),
	...withBrand("financialtimes", FINANCIAL_TIMES_SITES),
	...withBrand("telegraph", TELEGRAPH_SITES),
	...withBrand("bloomberg", BLOOMBERG_SITES),
	...withBrand("espn", ESPN_SITES),
	...withBrand("independent", INDEPENDENT_SITES),
	...withBrand("givemesport", GIVEMESPORT_SITES),
	...withBrand("belfasttelegraph", BELFAST_TELEGRAPH_SITES),
	...withBrand("reach", REACH_SITES, "local"),
	...withBrand("reach", BELFAST_LIVE_SITES, "local"),
	...withBrand("newsquest", NEWSQUEST_SITES, "local"),
	...withIndividualBrands(OTHER_SITES, "local"),
];
