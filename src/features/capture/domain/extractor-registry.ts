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
		cardSelector: "article, [data-testid*='card'], li",
		categorySelector: "[type='attribution']",
		headlineSelector: "h1, h2, h3, [data-testid*='headline']",
		name: "bbc-front-page",
		sectionSelector: "section, [data-testid*='section']",
		storyLinkSelector: "a[href*='/news/'], a[href*='/sport/'], main a[href]",
		summarySelector: "p, [data-testid*='summary']",
		version: 3,
	},
	"guardian-front-page": {
		cardSelector: "article, li, [data-link-name*='article']",
		headlineSelector: "h1, h2, h3, [data-gu-name='headline']",
		name: "guardian-front-page",
		sectionSelector: "section, [data-component*='container']",
		storyLinkSelector: "a[href*='theguardian.com'], main a[href]",
		summarySelector: "p, [data-link-name='standfirst']",
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
