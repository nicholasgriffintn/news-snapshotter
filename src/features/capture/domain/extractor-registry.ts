import type { PageElementKind } from "../../../core/contracts.ts";
import type { ExtractorName } from "../../../core/domain.ts";

export type { ExtractorName } from "../../../core/domain.ts";

export type ExtractorContentRule = {
	cardSelector: string;
	candidateSelector: string;
	categoryAttribute?: string;
	categorySelector?: string;
	extractCanonicalUrl?: boolean;
	excludedUrlPathPrefixes?: readonly string[];
	fixedCategory?: string;
	headlineAttribute?: string;
	headlineSelector: string | readonly string[];
	kind: PageElementKind;
	minimumHeadlineLength?: number;
	prominenceHint?: "lead";
	scope?: "content" | "page";
	sectionHeadingSelector?: string;
	sectionSelector?: string;
	summarySelector?: string;
	urlAttribute?: string;
};

export type ExtractorDefinition = {
	name: ExtractorName;
	rules: readonly ExtractorContentRule[];
	version: number;
};

const BBC_SECTION_SELECTOR = "[data-testid='spc-container'], section, [data-testid*='section']";
const BBC_PROMO_HEADLINE_SELECTORS = [
	"[class*='-PromoHeadline']",
	"[type='headline']",
	"[data-testid*='headline']",
	"h1, h2, h3",
] as const;
const BBC_PROMO_RULE = {
	cardSelector: "[data-testid='promo']",
	categorySelector: "[type='attribution']",
	headlineSelector: BBC_PROMO_HEADLINE_SELECTORS,
	sectionHeadingSelector: "h2[type='normal']",
	sectionSelector: BBC_SECTION_SELECTOR,
	summarySelector: "p, [data-testid*='summary']",
} as const;

const PAGE_HEADING_SELECTOR =
	"main h1, main h2, main h3, [role='main'] h1, [role='main'] h2, [role='main'] h3";
const PAGE_ELEMENT_RULES: readonly ExtractorContentRule[] = [
	{
		cardSelector: "h1, h2, h3",
		candidateSelector: PAGE_HEADING_SELECTOR,
		headlineSelector: "h1, h2, h3",
		kind: "heading",
		minimumHeadlineLength: 1,
		scope: "page",
	},
	{
		cardSelector: "img",
		candidateSelector: "main img[alt]:not([alt='']), [role='main'] img[alt]:not([alt=''])",
		headlineAttribute: "alt",
		headlineSelector: "img",
		kind: "image",
		minimumHeadlineLength: 1,
		scope: "page",
		sectionHeadingSelector: PAGE_HEADING_SELECTOR,
	},
	{
		cardSelector: "a[href], button",
		candidateSelector:
			"header a[href], header button, nav a[href], nav button, footer a[href], footer button",
		fixedCategory: "Navigation",
		headlineSelector: "a[href], button",
		kind: "navigation",
		minimumHeadlineLength: 1,
		scope: "page",
	},
];

const EXTRACTORS: Record<ExtractorName, ExtractorDefinition> = {
	"apnews-front-page": {
		name: "apnews-front-page",
		rules: [
			{
				cardSelector: "bsp-video-card.VideoPlaylistItemCard",
				candidateSelector: "bsp-video-card.VideoPlaylistItemCard[url]",
				headlineSelector: ".VideoPlaylistItemCard-title",
				kind: "video",
				sectionHeadingSelector: "main h2",
				urlAttribute: "url",
			},
			{
				cardSelector: ".PagePromo",
				candidateSelector: ".PagePromo-title a.Link[href]",
				categorySelector: ".PagePromo-category",
				headlineSelector: ".PagePromo-title",
				kind: "story",
				sectionHeadingSelector: "main h2",
				sectionSelector: "[data-gtm-region], section",
				summarySelector: ".PagePromo-description",
			},
		],
		version: 1,
	},
	"generic-baseline": {
		name: "generic-baseline",
		rules: [
			{
				cardSelector: "article, li, [role='article']",
				candidateSelector:
					"article h1 a[href], article h2 a[href], article h3 a[href], [role='article'] h1 a[href], [role='article'] h2 a[href], [role='article'] h3 a[href], li h1 a[href], li h2 a[href], li h3 a[href]",
				headlineSelector: "h1, h2, h3",
				kind: "story",
				summarySelector: "p",
			},
		],
		version: 4,
	},
	"bbc-front-page": {
		name: "bbc-front-page",
		rules: [
			{
				cardSelector:
					"main > div:has([data-testid='billboard-canvas-background-image']), main > div:has(> [class*='-Canvas'] [class*='-ContentWrap'] [type='headline'])",
				candidateSelector:
					"main > div:has([data-testid='billboard-canvas-background-image']) a[href]:has(:is(h1, h2, h3, [type='headline'])), main > div:has(> [class*='-Canvas'] [class*='-ContentWrap'] [type='headline']) a[href]:has(:is(h1, h2, h3, [type='headline']))",
				headlineSelector: ["[type='headline']", "h1, h2, h3"],
				kind: "story",
				prominenceHint: "lead",
				summarySelector: "p, [class*='-Summary']",
			},
			{
				...BBC_PROMO_RULE,
				candidateSelector:
					"[data-testid='promo'] :is(h1, h2, h3) a[href*='/sounds/'], [data-testid='promo'] a[href*='/sounds/']:has([class*='-PromoHeadline'])",
				excludedUrlPathPrefixes: ["/sounds/my/"],
				kind: "audio",
			},
			{
				...BBC_PROMO_RULE,
				candidateSelector:
					"[data-testid='promo'] :is(h1, h2, h3) a[href*='/videos/'], [data-testid='promo'] :is(h1, h2, h3) a[href*='/iplayer/'], [data-testid='promo'] a[href*='/videos/']:has([class*='-PromoHeadline']), [data-testid='promo'] a[href*='/iplayer/']:has([class*='-PromoHeadline'])",
				excludedUrlPathPrefixes: ["/iplayer/watchlist"],
				kind: "video",
			},
			{
				cardSelector: "[data-testid='carousel-item']",
				candidateSelector:
					"[data-testid='portrait-video-experience'] [data-testid='carousel-item'] button",
				headlineSelector: "[class*='-PromoHeadline']",
				kind: "video",
				sectionHeadingSelector: "h2[type='normal']",
				sectionSelector: "[data-testid='portrait-video-experience']",
			},
			{
				...BBC_PROMO_RULE,
				candidateSelector:
					"[data-testid='promo'] :is(h1, h2, h3, [type='headline'], [class*='-PromoHeadline']) a[href], [data-testid='promo'] a[href]:has(:is(h1, h2, h3, [type='headline'], [class*='-PromoHeadline']))",
				kind: "story",
			},
		],
		version: 10,
	},
	"bloomberg-front-page": {
		name: "bloomberg-front-page",
		rules: [
			{
				cardSelector: "div:has(> a[href]:has([data-component='headline']))",
				candidateSelector: "a[href*='/news/videos/']:has([data-component='headline'])",
				categorySelector: "[data-component='optional-eyebrow']",
				headlineSelector: "[data-component='headline']",
				kind: "video",
				sectionHeadingSelector:
					"[data-component='module-header'] [data-component='title'], [data-component='title']",
				summarySelector: "[data-component='summary']",
			},
			{
				cardSelector: "div:has(> a[href]:has([data-component='headline']))",
				candidateSelector: "a[href*='/news/audio/']:has([data-component='headline'])",
				categorySelector: "[data-component='optional-eyebrow']",
				headlineSelector: "[data-component='headline']",
				kind: "audio",
				sectionHeadingSelector:
					"[data-component='module-header'] [data-component='title'], [data-component='title']",
				summarySelector: "[data-component='summary']",
			},
			{
				cardSelector: "div:has(> a[href]:has([data-component='headline']))",
				candidateSelector:
					"a[href]:not([href*='/news/videos/']):not([href*='/news/audio/']):has([data-component='headline'])",
				categorySelector: "[data-component='optional-eyebrow']",
				headlineSelector: "[data-component='headline']",
				kind: "story",
				sectionHeadingSelector:
					"[data-component='module-header'] [data-component='title'], [data-component='title']",
				summarySelector: "[data-component='summary']",
			},
		],
		version: 4,
	},
	"channel4-front-page": {
		name: "channel4-front-page",
		rules: [
			{
				cardSelector: "li, a.featured-video-button",
				candidateSelector:
					"a.featured-video-button[href]:has(h3.heading), li:has(.duration) a[href]:has(h3.heading)",
				headlineSelector: "h3.heading",
				kind: "video",
				sectionHeadingSelector: "h2",
			},
			{
				cardSelector: "article, li",
				candidateSelector: "a[href]:has(h3.heading):not(.featured-video-button)",
				headlineSelector: "h3.heading",
				kind: "story",
				sectionHeadingSelector: "h2",
				summarySelector: "p",
			},
		],
		version: 1,
	},
	"cnn-front-page": {
		name: "cnn-front-page",
		rules: [
			{
				cardSelector: "[data-component-name='card']",
				candidateSelector: "[data-component-name='card'] a[data-link-type='article'][href]",
				categoryAttribute: "data-section",
				categorySelector: "[data-section]",
				headlineSelector: "[data-editable='headline']",
				kind: "story",
				summarySelector: "[data-editable='description'], .container__description",
			},
		],
		version: 4,
	},
	"dailymail-front-page": {
		name: "dailymail-front-page",
		rules: [
			{
				cardSelector: ".article",
				candidateSelector: ".article h2 a[itemprop='url'][href]",
				categoryAttribute: "data-channel",
				categorySelector: ".article-icon-links__pubInfo[data-channel]",
				headlineSelector: "h2",
				kind: "story",
				summarySelector: ".articletext > div, .articletext",
			},
		],
		version: 4,
	},
	"express-front-page": {
		name: "express-front-page",
		rules: [
			{
				cardSelector: "[data-vr-contentbox]",
				candidateSelector: "[data-vr-contentbox] a[data-hp-link][href]",
				headlineAttribute: "data-article-headline",
				headlineSelector: "[data-article-headline]",
				kind: "story",
				sectionHeadingSelector: "main h2",
				summarySelector: "p",
			},
		],
		version: 1,
	},
	"financialtimes-front-page": {
		name: "financialtimes-front-page",
		rules: [
			{
				cardSelector:
					".story-group__article, .o-teaser, [data-o-component='o-teaser'], [data-trackable='teaser'], article, li",
				candidateSelector:
					"main .o-teaser__heading a[href], main a[data-trackable='heading-link'][href], main [data-component='headline'] a[href], main h1 a[href], main h2 a[href], main h3 a[href]",
				categorySelector:
					".story-group__title, .o-teaser__tag, .o-teaser__meta a, [data-trackable='teaser-tag']",
				headlineSelector:
					".headline, .o-teaser__heading, [data-trackable='heading'], [data-component='headline'], h1, h2, h3",
				kind: "story",
				sectionHeadingSelector: "main h2",
				summarySelector: ".standfirst, .o-teaser__standfirst, .o-teaser__summary, p",
			},
		],
		version: 2,
	},
	"forbes-front-page": {
		name: "forbes-front-page",
		rules: [
			{
				cardSelector:
					"article, li, div:has(> a[data-testid='article-image-link']):has(a[data-testid='article-headline'])",
				candidateSelector: "a[data-testid='article-headline'][href]",
				categorySelector: "[data-testid='article-label']",
				headlineSelector: "a[data-testid='article-headline']",
				kind: "story",
				sectionHeadingSelector: "h2",
				summarySelector: "[data-testid='article-description']",
			},
		],
		version: 1,
	},
	"foxnews-front-page": {
		name: "foxnews-front-page",
		rules: [
			{
				cardSelector: "article.article",
				candidateSelector:
					"article.article:is(.has-video, .has-video-overlay, .article-watch-live) :is(h1, h2, h3) a[href], article.article:is(.has-video, .has-video-overlay, .article-watch-live) a[href]:has(:is(h1, h2, h3))",
				categorySelector: ".eyebrow, .kicker",
				headlineSelector: "h1, h2, h3",
				kind: "video",
				sectionHeadingSelector: "section.collection > header.heading > h2.title",
				summarySelector: ".dek, p",
			},
			{
				cardSelector: "article.article",
				candidateSelector:
					"article.article :is(h1, h2, h3) a[href], article.article a[href]:has(:is(h1, h2, h3))",
				categorySelector: ".eyebrow, .kicker",
				headlineSelector: "h1, h2, h3",
				kind: "story",
				sectionHeadingSelector: "section.collection > header.heading > h2.title",
				summarySelector: ".dek, p",
			},
		],
		version: 1,
	},
	"google-news-front-page": {
		name: "google-news-front-page",
		rules: [
			{
				cardSelector: ".UwIKyb",
				candidateSelector: "main .UwIKyb a.gPFEn[href]",
				headlineSelector: "a.gPFEn",
				kind: "story",
				sectionHeadingSelector: "main h2, main h3.aqvwYd",
			},
			{
				cardSelector: "div:has(> a.JtKRv[href])",
				candidateSelector: "main a.JtKRv[href]",
				headlineSelector: "a.JtKRv",
				kind: "story",
				sectionHeadingSelector: "main h2, main h3.aqvwYd",
			},
		],
		version: 2,
	},
	"guardian-front-page": {
		name: "guardian-front-page",
		rules: [
			{
				cardSelector: "li",
				candidateSelector:
					"a[data-link-name='article'][href], a[data-link-name*=' | card-@'][href], a[data-link-name*='media-'][href], li[data-link-name^='sublinks'] a[href]",
				headlineSelector: [".headline-text", "[data-gu-name='headline']", "h1, h2, h3"],
				kind: "story",
				sectionSelector: "section[data-component]",
				summarySelector: "p, [data-link-name='standfirst']",
			},
		],
		version: 8,
	},
	"hackernews-front-page": {
		name: "hackernews-front-page",
		rules: [
			{
				cardSelector: "tr.athing",
				candidateSelector: "tr.athing .titleline > a[href]",
				headlineSelector: ".titleline > a",
				kind: "story",
				minimumHeadlineLength: 1,
			},
			{
				cardSelector: "a[href]",
				candidateSelector: "#hnmain > tbody > tr:first-child table a[href]",
				fixedCategory: "Navigation",
				headlineSelector: "a[href]",
				kind: "navigation",
				minimumHeadlineLength: 1,
				scope: "page",
			},
		],
		version: 3,
	},
	"independent-front-page": {
		name: "independent-front-page",
		rules: [
			{
				cardSelector: "article",
				candidateSelector: "article a.card-link[href]:has(h2)",
				categorySelector: "footer a[href], .slot-primary > a[href], .slot-primary > p",
				headlineSelector: "h2",
				kind: "story",
				sectionHeadingSelector: "h1",
			},
		],
		version: 1,
	},
	"inews-front-page": {
		name: "inews-front-page",
		rules: [
			{
				cardSelector: "button.inews__post-videocarousel",
				candidateSelector:
					"[data-type='VideoCarousel'] button.inews__post-videocarousel[data-embed-url]:has(h2)",
				categorySelector: ".category-name",
				extractCanonicalUrl: false,
				headlineSelector: "h2",
				kind: "video",
				sectionHeadingSelector: "main h2",
			},
			{
				cardSelector: "[data-post-id]",
				candidateSelector: "[data-post-id] h2 a[href], [data-post-id] a[href]:has(h2)",
				categorySelector: "a[title^='Link to:'] .category-name",
				headlineSelector: "h2",
				kind: "story",
				sectionHeadingSelector: "main h2",
				summarySelector: "p",
			},
		],
		version: 1,
	},
	"metro-front-page": {
		name: "metro-front-page",
		rules: [
			{
				cardSelector: ".article-card",
				candidateSelector: ".article-card__title a[href]",
				categorySelector: ".channel-glyph__label",
				headlineSelector: ".article-card__title",
				kind: "story",
				sectionHeadingSelector:
					".post-grid__label, .content-group_title, .spotlight_title, .portrait-video-carousel_title",
			},
		],
		version: 1,
	},
	"nbcnews-front-page": {
		name: "nbcnews-front-page",
		rules: [
			{
				cardSelector: "[data-testid='card-container']",
				candidateSelector:
					"[data-testid='card-container'][data-contentid]:has([data-testid='card-duration']):has([data-testid='card-title'])",
				headlineSelector: "[data-testid='card-title']",
				kind: "video",
			},
			{
				cardSelector: "[data-testid='baconCardWrapper'], [data-contentid]",
				candidateSelector:
					"[data-testid='baconCardWrapper']:has([data-testid='video']) a[data-testid='x-by-one__headline__link'][href], [data-contentid]:has([data-testid='video']) :is(h1, h2, h3) a[href]",
				categorySelector: "[data-testid='unibrow-text']",
				headlineSelector: "h1, h2, h3, [data-testid='card-title']",
				kind: "video",
			},
			{
				cardSelector: "[data-testid='baconCardWrapper'], [data-contentid]",
				candidateSelector:
					"a[data-testid='x-by-one__headline__link'][href], [data-contentid] :is(h1, h2, h3) a[href], [data-contentid] a[href]:has(:is(h1, h2, h3))",
				categorySelector: "[data-testid='unibrow-text']",
				headlineSelector: "h1, h2, h3",
				kind: "story",
				summarySelector: "p",
			},
		],
		version: 1,
	},
	"nytimes-front-page": {
		name: "nytimes-front-page",
		rules: [
			{
				cardSelector: "[data-tpl='sli'], a[href*='nytimes.com']:has([data-tpl='sli'])",
				candidateSelector:
					"a[href*='nytimes.com']:has([data-tpl='sli']), a[data-tpl='l'][href*='nytimes.com']",
				headlineSelector: "[data-tpl='h'] p",
				kind: "story",
				prominenceHint: "lead",
				sectionHeadingSelector:
					".package-title-wrapper h2 [data-tpl='tk'], .package-title-wrapper h2 > div > span:first-child",
				summarySelector: "[data-tpl='bo'] p",
			},
		],
		version: 5,
	},
	"skynews-front-page": {
		name: "skynews-front-page",
		rules: [
			{
				cardSelector: ".ui-story, .sdc-site-tiles__item",
				candidateSelector:
					".ui-story a.ui-story-headline[href], .sdc-site-tiles__item .sdc-site-tile__headline a[href]",
				categorySelector:
					".ui-story-label [data-role='label'], .sdc-site-tile__label, .sdc-site-tile__tag",
				headlineSelector: [".ui-story-headline", ".sdc-site-tile__headline"],
				kind: "story",
				sectionHeadingSelector: ".ui-section-header-title, .sdc-site-component-header__title, h2",
				summarySelector: ".ui-story-summary, .sdc-site-tile__description",
			},
		],
		version: 1,
	},
	"standard-front-page": {
		name: "standard-front-page",
		rules: [
			{
				cardSelector:
					"div:has(a[data-testid='link-data-testid'][href] > p):has(a[data-testid='link-data-testid'][href] [aria-label='video'])",
				candidateSelector: "a[data-testid='link-data-testid'][href]:has([aria-label='video'])",
				headlineSelector: "p",
				kind: "video",
				sectionHeadingSelector: "h2",
			},
			{
				cardSelector: "div:has(img):has(a[data-testid='link-data-testid'][href] > p)",
				candidateSelector: "a[data-testid='link-data-testid'][href]:has(> p)",
				headlineSelector: "p",
				kind: "story",
				sectionHeadingSelector: "h2",
			},
		],
		version: 1,
	},
	"telegraph-front-page": {
		name: "telegraph-front-page",
		rules: [
			{
				cardSelector: "[data-test='card']",
				candidateSelector: "a[data-test='list-headline-link'][href]",
				categorySelector: "[data-test='kicker']",
				headlineSelector: "[data-test='headline']",
				kind: "story",
				prominenceHint: "lead",
				summarySelector: "[data-test='standfirst']",
			},
		],
		version: 3,
	},
	"times-front-page": {
		name: "times-front-page",
		rules: [
			{
				cardSelector: "[data-testid='lead-media-article']",
				candidateSelector:
					"[data-testid='lead-media-article'] [data-testid='lead-article-content'] > a:first-of-type[href]",
				categorySelector: "[data-testid='tag-and-flag'] a",
				headlineSelector: "[data-testid='lead-article-content'] > a:first-of-type[href] > span",
				kind: "story",
				prominenceHint: "lead",
				sectionHeadingSelector: "main h2",
				summarySelector: "[data-testid='lead-article-content'] a > p",
			},
			{
				cardSelector:
					"[data-testid='lead-article'], [data-testid='vertical-article'], [data-testid='horizontal-article'], [data-testid='lead-media-article'], [class*='composed-article-card-'], .grid-area--content",
				candidateSelector:
					"a.article-headline[href], [data-testid='lead-article'] > a:first-of-type[href]",
				categorySelector: "[data-testid='tag-and-flag'] a",
				headlineSelector:
					".article-headline span, [data-testid='lead-article'] > a:first-of-type span",
				kind: "story",
				sectionHeadingSelector: "main h2",
				summarySelector: ".short-summary p, a:not(.article-headline) > p",
			},
		],
		version: 5,
	},
	"usatoday-front-page": {
		name: "usatoday-front-page",
		rules: [
			{
				cardSelector: "a[data-module-name^='promo-story']",
				candidateSelector: "a[data-module-name^='promo-story'][href*='/videos/']",
				headlineSelector: ".p1-title-spacer",
				kind: "video",
				sectionHeadingSelector: "h2",
			},
			{
				cardSelector: "a[data-module-name^='promo-story']",
				candidateSelector: "a[data-module-name^='promo-story'][href]",
				categorySelector: ".p1-label",
				headlineSelector: ".p1-title-spacer",
				kind: "story",
				sectionHeadingSelector: "h2",
				summarySelector: "p",
			},
		],
		version: 1,
	},
	"washingtonpost-front-page": {
		name: "washingtonpost-front-page",
		rules: [
			{
				cardSelector: "[data-testid='vertical-thumbnail']",
				candidateSelector:
					"[data-feature-name='vertical-video-carousel-(collection)'] [data-testid='vertical-thumbnail']",
				headlineSelector: "p",
				kind: "video",
				sectionHeadingSelector:
					"[data-chain-name='vertical video'] .chain-label-side-by-side .label span",
			},
			{
				cardSelector: "[data-feature-id='homepage/story']",
				candidateSelector: "a[data-pb-local-content-field='web_headline'][href]",
				headlineSelector: "h1, h2, h3",
				kind: "story",
				summarySelector: ".font-size-blurb",
			},
		],
		version: 4,
	},
	"yahoo-news-front-page": {
		name: "yahoo-news-front-page",
		rules: [
			{
				cardSelector:
					"li.cls-card-story, article, div:has(> h2 > a[data-ylk*='elm:hdln']), div:has(> h3 > a[data-ylk*='elm:hdln'])",
				candidateSelector: "main a[data-ylk*='elm:hdln'][href]",
				headlineSelector: "h2, h3",
				kind: "story",
				summarySelector: "p",
			},
		],
		version: 1,
	},
};

export function extractorDefinition(name: ExtractorName, version: number): ExtractorDefinition {
	const definition = EXTRACTORS[name];

	if (definition.version !== version) {
		throw new Error(
			`Extractor ${name} v${version} is not registered; current version is v${definition.version}`,
		);
	}

	return {
		...definition,
		rules: [...definition.rules, ...PAGE_ELEMENT_RULES],
	};
}
