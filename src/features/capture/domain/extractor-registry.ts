import type { PageElementKind } from "../../../core/contracts.ts";
import type { ExtractorName } from "../../../core/domain.ts";

export type { ExtractorName } from "../../../core/domain.ts";

export type ExtractorContentRule = {
	cardSelector: string;
	candidateSelector: string;
	categoryAttribute?: string;
	categorySelector?: string;
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

const PAGE_HEADING_SELECTOR = "main h1, main h2, main h3, [role='main'] h1, [role='main'] h2, [role='main'] h3";
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
		candidateSelector:
			"main img[alt]:not([alt='']), [role='main'] img[alt]:not([alt=''])",
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
				cardSelector: "main > div:has([data-testid='billboard-canvas-background-image'])",
				candidateSelector:
					"main > div:has([data-testid='billboard-canvas-background-image']) a[href]:has(:is(h1, h2, h3, [type='headline']))",
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
		version: 9,
	},
	"bloomberg-front-page": {
		name: "bloomberg-front-page",
		rules: [
			{
				cardSelector: "[class^='LineupContent2Up_story__']:has(a[data-component='story-link'])",
				candidateSelector:
					"#lede > [class^='LineupContent2Up_story__']:first-child a[data-component='story-link'][href]",
				categorySelector: "[data-component='optional-eyebrow']",
				headlineSelector: "[data-component='headline']",
				kind: "story",
				prominenceHint: "lead",
				summarySelector: "[data-component='summary']",
			},
			{
				cardSelector:
					"[class*='_story__']:has(a[data-component='story-link']), article, li, a[href]:has([data-component='headline'])",
				candidateSelector: "main a[href]:has([data-component='headline'])",
				categorySelector: "[data-component='optional-eyebrow']",
				headlineSelector: "[data-component='headline']",
				kind: "story",
				sectionHeadingSelector: "main h2",
				summarySelector: "[data-component='summary']",
			},
		],
		version: 2,
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
	"washingtonpost-front-page": {
		name: "washingtonpost-front-page",
		rules: [
			{
				cardSelector: "[data-feature-id='homepage/story']",
				candidateSelector: "a[data-pb-local-content-field='web_headline'][href]",
				headlineSelector: "h1, h2, h3",
				kind: "story",
				summarySelector: ".font-size-blurb",
			},
		],
		version: 3,
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
