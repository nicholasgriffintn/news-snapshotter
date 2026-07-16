import { withBrand, withIndividualBrands, withoutDuplicateNames } from './lib/site-catalogue';
import { BBC_LOCAL_SITES } from './sites/bbc-local';
import { BBC_SITES } from './sites/bbc';
import { BELFAST_LIVE_SITES } from './sites/belfast-live';
import { BELFAST_TELEGRAPH_SITES } from './sites/belfast-telegraph';
import { BLOOMBERG_SITES } from './sites/bloomberg';
import { CNN_SITES } from './sites/cnn';
import { DAILYMAIL_SITES } from './sites/dailymail';
import { ESPN_SITES } from './sites/espn';
import { FINANCIAL_TIMES_SITES } from './sites/financial-times';
import { GIVEMESPORT_SITES } from './sites/givemesport';
import { GUARDIAN_SITES } from './sites/guardian';
import { INDEPENDENT_SITES } from './sites/independent';
import { ITV_LOCAL_SITES } from './sites/itv-local';
import { ITV_SITES } from './sites/itv';
import { METRO_SITES } from './sites/metro';
import { NEW_YORK_TIMES_SITES } from './sites/new-york-times';
import { NEWSQUEST_SITES } from './sites/newsquest';
import { OTHER_SITES } from './sites/other';
import { REACH_SITES } from './sites/reach';
import { SKY_SPORTS_SITES } from './sites/sky-sports';
import { SKY_SITES } from './sites/sky';
import { STV_SITES } from './sites/stv';
import { TELEGRAPH_SITES } from './sites/telegraph';
import { TIMES_SITES } from './sites/times';
import { WASHINGTON_POST_SITES } from './sites/washington-post';

export const SITES = [
	...withBrand('bbc', [...BBC_SITES, ...withoutDuplicateNames(BBC_LOCAL_SITES, BBC_SITES)]),
	...withBrand('times', TIMES_SITES),
	...withBrand('nytimes', NEW_YORK_TIMES_SITES),
	...withBrand('sky', SKY_SITES),
	...withBrand('skysports', SKY_SPORTS_SITES),
	...withBrand('dailymail', DAILYMAIL_SITES),
	...withBrand('guardian', GUARDIAN_SITES),
	...withBrand('itv', [...ITV_SITES, ...ITV_LOCAL_SITES]),
	...withBrand('stv', STV_SITES),
	...withBrand('metro', METRO_SITES),
	...withBrand('cnn', CNN_SITES),
	...withBrand('washingtonpost', WASHINGTON_POST_SITES),
	...withBrand('financialtimes', FINANCIAL_TIMES_SITES),
	...withBrand('telegraph', TELEGRAPH_SITES),
	...withBrand('bloomberg', BLOOMBERG_SITES),
	...withBrand('espn', ESPN_SITES),
	...withBrand('independent', INDEPENDENT_SITES),
	...withBrand('givemesport', GIVEMESPORT_SITES),
	...withBrand('belfasttelegraph', BELFAST_TELEGRAPH_SITES),
	...withBrand('reach', [...REACH_SITES, ...BELFAST_LIVE_SITES]),
	...withBrand('newsquest', NEWSQUEST_SITES),
	...withIndividualBrands(OTHER_SITES),
];
