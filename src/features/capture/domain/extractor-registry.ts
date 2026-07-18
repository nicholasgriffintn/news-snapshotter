import type { ExtractorName } from "../../../core/domain.ts";

export type { ExtractorName } from "../../../core/domain.ts";

export type ExtractorDefinition = {
	cardSelector: string;
	categoryAttribute?: string;
	categorySelector?: string;
	headlineSelector: string;
	name: ExtractorName;
	sectionSelector?: string;
	storyLinkSelector: string;
	summarySelector: string;
	version: number;
};

const EXTRACTORS: Record<ExtractorName, ExtractorDefinition> = {
	"generic-baseline": {
		cardSelector: "article, li, [role='article']",
		headlineSelector: "h1, h2, h3",
		name: "generic-baseline",
		storyLinkSelector:
			"article h1 a[href], article h2 a[href], article h3 a[href], [role='article'] h1 a[href], [role='article'] h2 a[href], [role='article'] h3 a[href], li h1 a[href], li h2 a[href], li h3 a[href]",
		summarySelector: "p",
		version: 3,
	},
	"bbc-front-page": {
		cardSelector: "[data-testid='promo']",
		categorySelector: "[type='attribution']",
		headlineSelector: "h1, h2, h3, [data-testid*='headline']",
		name: "bbc-front-page",
		sectionSelector: "section, [data-testid*='section']",
		storyLinkSelector:
			"[data-testid='promo'] h1 a[href], [data-testid='promo'] h2 a[href], [data-testid='promo'] h3 a[href]",
		summarySelector: "p, [data-testid*='summary']",
		version: 5,
	},
	"cnn-front-page": {
		cardSelector: "[data-component-name='card']",
		categoryAttribute: "data-section",
		categorySelector: "[data-section]",
		headlineSelector: "[data-editable='headline']",
		name: "cnn-front-page",
		storyLinkSelector: "[data-component-name='card'] a[data-link-type='article'][href]",
		summarySelector: "[data-editable='description'], .container__description",
		version: 3,
	},
	"dailymail-front-page": {
		cardSelector: ".article",
		categoryAttribute: "data-channel",
		categorySelector: ".article-icon-links__pubInfo[data-channel]",
		headlineSelector: "h2",
		name: "dailymail-front-page",
		storyLinkSelector: ".article h2 a[itemprop='url'][href]",
		summarySelector: ".articletext > div, .articletext",
		version: 3,
	},
	"guardian-front-page": {
		cardSelector: "li",
		categorySelector: ".card-headline > div",
		headlineSelector: "h1, h2, h3, [data-gu-name='headline']",
		name: "guardian-front-page",
		sectionSelector: "section[data-component]",
		storyLinkSelector:
			"a[data-link-name='article'][href], a[data-link-name*=' | card-@'][href]:not([data-link-name*='media-']), li[data-link-name^='sublinks'] a[href]",
		summarySelector: "p, [data-link-name='standfirst']",
		version: 5,
	},
	"nytimes-front-page": {
		cardSelector: "[data-tpl='sli']",
		headlineSelector: "[data-tpl='h'] p",
		name: "nytimes-front-page",
		storyLinkSelector: "a[data-tpl='l'][href*='nytimes.com']",
		summarySelector: "[data-tpl='bo'] p",
		version: 3,
	},
	"telegraph-front-page": {
		cardSelector: "[data-test='card']",
		categorySelector: "[data-test='kicker']",
		headlineSelector: "[data-test='headline']",
		name: "telegraph-front-page",
		storyLinkSelector: "a[data-test='list-headline-link'][href]",
		summarySelector: "[data-test='standfirst']",
		version: 2,
	},
	"times-front-page": {
		cardSelector:
			"[data-testid='lead-article'], [data-testid='vertical-article'], [data-testid='horizontal-article'], [data-testid='lead-media-article'], [class*='composed-article-card-'], .grid-area--content",
		categorySelector: "[data-testid='tag-and-flag'] a",
		headlineSelector: ".article-headline span, [data-testid='lead-article'] > a:first-of-type span",
		name: "times-front-page",
		storyLinkSelector:
			"a.article-headline[href], [data-testid='lead-article'] > a:first-of-type[href]",
		summarySelector: ".short-summary p, a:not(.article-headline) > p",
		version: 3,
	},
	"washingtonpost-front-page": {
		cardSelector: "[data-feature-id='homepage/story']",
		headlineSelector: "h1, h2, h3",
		name: "washingtonpost-front-page",
		storyLinkSelector: "a[data-pb-local-content-field='web_headline'][href]",
		summarySelector: ".font-size-blurb",
		version: 2,
	},
};

export function extractorDefinition(name: ExtractorName, version: number): ExtractorDefinition {
	const definition = EXTRACTORS[name];

	if (definition.version !== version) {
		throw new Error(
			`Extractor ${name} v${version} is not registered; current version is v${definition.version}`,
		);
	}

	return definition;
}
