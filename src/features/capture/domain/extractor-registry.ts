import type { ExtractorName } from "../../../core/domain.ts";

export type { ExtractorName } from "../../../core/domain.ts";

export type ExtractorDefinition = {
	cardSelector: string;
	categorySelector?: string;
	headlineSelector: string;
	name: ExtractorName;
	sectionSelector: string;
	storyLinkSelector: string;
	summarySelector: string;
	version: number;
};

const EXTRACTORS: Record<ExtractorName, ExtractorDefinition> = {
	"generic-baseline": {
		cardSelector: "article, li, [role='article']",
		headlineSelector: "h1, h2, h3",
		name: "generic-baseline",
		sectionSelector: "section, main, [role='region']",
		storyLinkSelector: "a[href]",
		summarySelector: "p",
		version: 1,
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
		version: 4,
	},
	"cnn-front-page": {
		cardSelector: "[data-component-name='card']",
		headlineSelector: "[data-editable='headline']",
		name: "cnn-front-page",
		sectionSelector: "[data-component-name='container'], section",
		storyLinkSelector: "[data-component-name='card'] a[data-link-type='article'][href]",
		summarySelector: "[data-editable='description'], .container__description",
		version: 1,
	},
	"dailymail-front-page": {
		cardSelector: ".article",
		headlineSelector: "h2",
		name: "dailymail-front-page",
		sectionSelector: "main, #content, [data-track-module]",
		storyLinkSelector: ".article h2 a[itemprop='url'][href]",
		summarySelector: ".articletext > div, .articletext",
		version: 1,
	},
	"guardian-front-page": {
		cardSelector: "li",
		headlineSelector: "h1, h2, h3, [data-gu-name='headline']",
		name: "guardian-front-page",
		sectionSelector: "section[data-component], main",
		storyLinkSelector: "a[data-link-name='article'][href], li[data-link-name^='sublinks'] a[href]",
		summarySelector: "p, [data-link-name='standfirst']",
		version: 2,
	},
	"nytimes-front-page": {
		cardSelector: "[data-tpl='sli']",
		headlineSelector: "[data-tpl='h'] p",
		name: "nytimes-front-page",
		sectionSelector: "section, main",
		storyLinkSelector: "a[data-tpl='l'][href*='nytimes.com']",
		summarySelector: "[data-tpl='bo'] p",
		version: 1,
	},
	"times-front-page": {
		cardSelector:
			"[data-testid='lead-article'], [data-testid='vertical-article'], [data-testid='horizontal-article'], [data-testid='lead-media-article'], [class*='composed-article-card-'], .grid-area--content",
		headlineSelector: ".article-headline span, [data-testid='lead-article'] > a:first-of-type span",
		name: "times-front-page",
		sectionSelector: "section, main",
		storyLinkSelector:
			"a.article-headline[href], [data-testid='lead-article'] > a:first-of-type[href]",
		summarySelector: ".short-summary p, a:not(.article-headline) > p",
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
	return definition;
}
