import type { Page } from "@cloudflare/puppeteer";

import type { ExtractorDefinition } from "../domain/extractor-registry.ts";
import type { CollectedElement, CollectedPage } from "../domain/content-elements.ts";

type DomElement = {
	attributes: ArrayLike<{ name: string }>;
	cloneNode: (deep: boolean) => DomElement;
	contains: (element: DomElement) => boolean;
	closest: (selector: string) => DomElement | null;
	currentSrc?: string;
	getAttribute: (name: string) => string | null;
	getBoundingClientRect: () => { height: number; left: number; top: number; width: number };
	href?: string;
	matches: (selector: string) => boolean;
	outerHTML: string;
	querySelector: (selector: string) => DomElement | null;
	querySelectorAll: (selector: string) => ArrayLike<DomElement>;
	remove: () => void;
	removeAttribute: (name: string) => void;
	scrollHeight: number;
	scrollWidth: number;
	tagName: string;
	textContent: string | null;
};

export function collectDocument(extractorDefinition: ExtractorDefinition): string {
	const browser = globalThis as unknown as {
		document: {
			baseURI: string;
			documentElement: DomElement;
			querySelectorAll: (selector: string) => ArrayLike<DomElement>;
		};
		innerHeight: number;
		scrollY: number;
	};
	const { document } = browser;
	// page.evaluate serialises this callback, so browser-realm policy must remain self-contained.
	const resolveWebUrl = (value: string): string | undefined => {
		try {
			const url = new URL(value, document.baseURI);
			return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
		} catch {
			return undefined;
		}
	};
	const contentUrlAllowed = (url: string, excludedPathPrefixes: readonly string[] = []) => {
		const path = new URL(url).pathname;
		return !excludedPathPrefixes.some((prefix) => path.startsWith(prefix));
	};

	const text = (element: DomElement | null): string => {
		if (!element) {
			return "";
		}
		const copy = element.cloneNode(true);
		Array.from(
			copy.querySelectorAll(
				"svg, [class*='visually-hidden'], [data-testid='visually-hidden-announcement']",
			),
		).forEach((node) => node.remove());
		return (copy.textContent ?? "").trim().replace(/\s+/g, " ");
	};

	const clone = document.documentElement.cloneNode(true);
	Array.from(clone.querySelectorAll("script, [data-pashi-cleanup]")).forEach((node) => {
		node.remove();
	});
	Array.from(clone.querySelectorAll("*")).forEach((node) => {
		for (const attribute of Array.from(node.attributes)) {
			if (/^on/i.test(attribute.name) || /^(nonce|value)$/i.test(attribute.name)) {
				node.removeAttribute(attribute.name);
			}
		}
	});
	Array.from(clone.querySelectorAll("input, textarea")).forEach((node) => {
		node.removeAttribute("value");
		if (node.tagName === "TEXTAREA") {
			node.textContent = "";
		}
	});

	const contentCards: DomElement[] = [];
	const elements = extractorDefinition.rules.flatMap((rule) => {
		const candidates = Array.from(document.querySelectorAll(rule.candidateSelector));

		return candidates.flatMap((candidate) => {
			if (
				rule.scope === "page" &&
				contentCards.some((contentCard) => contentCard.contains(candidate))
			) {
				return [];
			}
			const card = candidate.closest(rule.cardSelector) ?? candidate;
			const headlineSelectors =
				typeof rule.headlineSelector === "string" ? [rule.headlineSelector] : rule.headlineSelector;
			const heading = headlineSelectors
				.map((selector) => (card.matches(selector) ? card : card.querySelector(selector)))
				.find((element) => element !== null);
			const headline = rule.headlineAttribute
				? (heading?.getAttribute(rule.headlineAttribute)?.trim() ?? "")
				: text(heading ?? null) || text(candidate);

			if (!heading || headline.length < (rule.minimumHeadlineLength ?? 10)) {
				return [];
			}

			const link =
				rule.extractCanonicalUrl === false
					? null
					: candidate.matches("a[href]")
						? candidate
						: (candidate.closest("a[href]") ?? card.querySelector("a[href]"));
			const attributedUrl = rule.urlAttribute
				? (candidate.getAttribute(rule.urlAttribute) ?? card.getAttribute(rule.urlAttribute))
				: undefined;
			const href = attributedUrl ?? link?.href ?? link?.getAttribute("href") ?? undefined;
			const canonicalUrl = href ? resolveWebUrl(href) : undefined;
			if (canonicalUrl && !contentUrlAllowed(canonicalUrl, rule.excludedUrlPathPrefixes)) {
				return [];
			}
			const rect = card.getBoundingClientRect();
			const image = card.matches("img") ? card : card.querySelector("img");
			const summary = rule.summarySelector ? text(card.querySelector(rule.summarySelector)) : "";
			const headingName = heading.tagName.toLowerCase();
			const sectionContainer = rule.sectionSelector ? card.closest(rule.sectionSelector) : null;
			let sectionText = text(sectionContainer?.querySelector("h1, h2, h3") ?? null);
			if (!sectionText && rule.sectionHeadingSelector) {
				const nearestHeading = Array.from(document.querySelectorAll(rule.sectionHeadingSelector))
					.filter((sectionHeading) => {
						const headingRect = sectionHeading.getBoundingClientRect();
						return (
							sectionHeading !== heading &&
							headingRect.height > 0 &&
							headingRect.width > 0 &&
							headingRect.top <= rect.top
						);
					})
					.sort((left, right) => {
						return right.getBoundingClientRect().top - left.getBoundingClientRect().top;
					})[0];
				sectionText = text(nearestHeading ?? null);
			}
			const section = sectionText && sectionText !== headline ? sectionText : undefined;
			const categoryElement = rule.categorySelector
				? card.matches(rule.categorySelector)
					? card
					: card.querySelector(rule.categorySelector)
				: null;
			const categoryValue = rule.categoryAttribute
				? categoryElement?.getAttribute(rule.categoryAttribute)
				: text(categoryElement);
			const extractedCategory = categoryValue?.trim().replace(/\s+/g, " ");
			const category = rule.fixedCategory ?? extractedCategory;
			const absoluteTop = rect.top + browser.scrollY;
			const textFingerprint = headline.toLowerCase();
			let imageDetails: CollectedElement["image"];

			if (image) {
				const imageSource =
					image.currentSrc || image.getAttribute("src") || image.getAttribute("data-src");
				imageDetails = {
					alt: image.getAttribute("alt") ?? undefined,
					sourceUrl: imageSource ? resolveWebUrl(imageSource) : undefined,
				};
			}
			const elementKey =
				canonicalUrl ?? imageDetails?.sourceUrl ?? `${rule.kind}:${textFingerprint}`;

			if (rule.scope !== "page") {
				contentCards.push(card);
			}

			return [
				{
					...(canonicalUrl ? { canonicalUrl } : {}),
					category,
					elementKey,
					headline,
					image: imageDetails,
					kind: rule.kind,
					position: {
						height: rect.height,
						left: rect.left,
						pageOrder: 0,
						top: absoluteTop,
						viewportDepth: absoluteTop / browser.innerHeight,
						width: rect.width,
					},
					prominenceHint: rule.prominenceHint,
					selectorHint: headingName,
					section,
					summary: summary || undefined,
					textFingerprint,
				},
			];
		});
	});

	return JSON.stringify({
		elements,
		html: `<!doctype html>${clone.outerHTML}`,
		pageHeight: document.documentElement.scrollHeight,
		pageWidth: document.documentElement.scrollWidth,
		warnings:
			elements.length === 0
				? [
						{
							code: "no-content-matches",
							message: `No elements matched ${extractorDefinition.name}`,
						},
					]
				: [],
	});
}

export async function collectPageContent(
	page: Page,
	extractor: ExtractorDefinition,
): Promise<CollectedPage> {
	const serialised = await page.evaluate(collectDocument, extractor);

	return JSON.parse(serialised) as CollectedPage;
}
