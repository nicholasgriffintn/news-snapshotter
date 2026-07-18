import type { Page } from "@cloudflare/puppeteer";

import type { Device, SiteDefinition } from "../../../core/domain.ts";
import type { ElementPosition, PageElement } from "../../history/domain/extraction.ts";
import { storyCategory } from "../../history/domain/story-classification.ts";
import { extractorDefinition, type ExtractorDefinition } from "../domain/extractor-registry.ts";
import { determineStoryProminence } from "../domain/story-prominence.ts";

const SCHEMA_VERSION = 1;
const SANITISATION_VERSION = 1;

type CollectedElement = PageElement & {
	canonicalUrl: string;
	headline: string;
	kind: "story";
	position: ElementPosition;
	prominence: "lead" | "major" | "minor" | "standard";
	selectorHint: string;
};

type CollectedPage = {
	elements: CollectedElement[];
	html: string;
	pageHeight: number;
	pageWidth: number;
	warnings: Array<{ code: string; message: string }>;
};

type ScreenshotAnalysis = import("../../../core/domain.ts").ScreenshotResult["analysis"];

export type AnalysisOutcome = NonNullable<ScreenshotAnalysis>;

type AnalysisInput = {
	bucket: R2Bucket;
	capturedAt: string;
	device: Device;
	page: Page;
	profile: string;
	screenshotBucket?: R2Bucket;
	screenshotKey: string;
	site: SiteDefinition;
	triggeredAt: string;
};

export function normaliseStoryElements(
	elements: CollectedPage["elements"],
): CollectedPage["elements"] {
	const visibleStories = elements.filter((element) => {
		return (
			element.selectorHint !== "a" && element.position.height > 0 && element.position.width > 0
		);
	});
	const uniqueStories = new Map<string, CollectedElement>();

	for (const element of visibleStories) {
		if (!uniqueStories.has(element.canonicalUrl)) {
			uniqueStories.set(element.canonicalUrl, element);
		}
	}

	return [...uniqueStories.values()].map((element, index) => {
		let summary = element.summary;

		if (summary === element.headline) {
			summary = undefined;
		}

		return {
			...element,
			position: {
				...element.position,
				pageOrder: index + 1,
			},
			summary,
		};
	});
}

function safeSegment(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function canonicaliseUrl(value: string): string {
	const url = new URL(value);
	url.hash = "";

	for (const parameter of [...url.searchParams.keys()]) {
		if (/^(utm_|at_|cmpid$)/i.test(parameter)) {
			url.searchParams.delete(parameter);
		}
	}

	if (url.pathname !== "/") {
		url.pathname = url.pathname.replace(/\/+$/, "");
	}

	return url.toString();
}

export function analysisKeys(site: SiteDefinition, device: Device, triggeredAt: string) {
	const timestamp = triggeredAt.replace(/[:.]/g, "-");
	const prefix = [
		`brand=${safeSegment(site.brand)}`,
		`category=${site.category}`,
		`date=${triggeredAt.slice(0, 10)}`,
		`site=${safeSegment(site.name)}`,
		`device=${device}`,
	].join("/");

	return {
		extractionKey: `${prefix}/${timestamp}.extraction.v${SCHEMA_VERSION}.json.gz`,
		failureKey: `${prefix}/${timestamp}.analysis-failure.json`,
		htmlKey: `${prefix}/${timestamp}.rendered.html.gz`,
	};
}

async function sha256(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);

	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function gzip(value: string): Promise<ArrayBuffer> {
	const source = new Blob([value]).stream();
	const compression = new CompressionStream("gzip");
	const stream = source.pipeThrough(compression);

	return new Response(stream).arrayBuffer();
}

async function storeOptionalImageCrops(
	input: AnalysisInput,
	elements: CollectedElement[],
	extractionKey: string,
	warnings: CollectedPage["warnings"],
): Promise<CollectedElement[]> {
	const cropConfig = input.site.analysis?.imageCrops;

	if (!cropConfig || !input.screenshotBucket) {
		return elements;
	}

	const maximum = Math.max(0, Math.min(20, Math.floor(cropConfig.maxPerCapture)));
	let stored = 0;
	const prefix = extractionKey.replace(/\.extraction\.v\d+\.json\.gz$/, "");
	const next: CollectedElement[] = [];

	for (const element of elements) {
		if (!element.image?.sourceUrl || stored >= maximum) {
			next.push(element);
			continue;
		}

		const { height, left, top, width } = element.position;

		if (height < 1 || width < 1 || left < 0 || top < 0) {
			next.push(element);
			continue;
		}

		const cropKey = `${prefix}.image-${String(stored + 1).padStart(2, "0")}.jpeg`;

		try {
			const crop = await input.page.screenshot({
				captureBeyondViewport: true,
				clip: { height, width, x: left, y: top },
				quality: 80,
				type: "jpeg",
			});

			await input.screenshotBucket.put(cropKey, crop, {
				customMetadata: {
					capturedAt: input.capturedAt,
					device: input.device,
					name: input.site.name,
					triggeredAt: input.triggeredAt,
					visibility: input.site.visibility ?? "public",
				},
				httpMetadata: { contentType: "image/jpeg" },
			});

			stored += 1;
			next.push({ ...element, image: { ...element.image, cropKey } });
		} catch {
			warnings.push({
				code: "image-crop-failed",
				message: `Could not preserve a screenshot crop for ${element.elementKey}`,
			});
			next.push(element);
		}
	}
	return next;
}

async function collectPage(page: Page, extractor: ExtractorDefinition): Promise<CollectedPage> {
	const serialised = await page.evaluate((extractorDefinition) => {
		type DomElement = {
			attributes: ArrayLike<{
				name: string;
			}>;
			cloneNode: (deep: boolean) => DomElement;
			closest: (selector: string) => DomElement | null;
			getBoundingClientRect: () => {
				height: number;
				left: number;
				top: number;
				width: number;
			};
			href: string;
			getAttribute: (name: string) => string | null;
			outerHTML: string;
			querySelector: (selector: string) => DomElement | null;
			querySelectorAll: (selector: string) => ArrayLike<DomElement>;
			remove: () => void;
			removeAttribute: (name: string) => void;
			scrollHeight: number;
			scrollWidth: number;
			tagName: string;
			textContent: string | null;
			matches: (selector: string) => boolean;
		};

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
		const clone = document.documentElement.cloneNode(true);
		const unsafeNodes = clone.querySelectorAll("script, [data-pashi-cleanup]");

		Array.from(unsafeNodes).forEach((node) => {
			node.remove();
		});

		Array.from(clone.querySelectorAll("*")).forEach((node) => {
			for (const attribute of Array.from(node.attributes)) {
				const isEventHandler = /^on/i.test(attribute.name);
				const isSensitiveValue = /^(nonce|value)$/i.test(attribute.name);

				if (isEventHandler || isSensitiveValue) {
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

		const links = Array.from(document.querySelectorAll(extractorDefinition.storyLinkSelector));
		const elements = links.flatMap((link) => {
			const card = link.closest(extractorDefinition.cardSelector) ?? link;
			const heading = card.querySelector(extractorDefinition.headlineSelector);

			if (!heading) {
				return [];
			}

			const headingText = heading.textContent ?? link.textContent ?? "";
			const headline = headingText.trim().replace(/\s+/g, " ");

			if (headline.length < 10) {
				return [];
			}

			const canonicalUrl = new URL(link.href, document.baseURI).toString();

			const rect = card.getBoundingClientRect();
			const image = card.querySelector("img");
			const summaryElement = card.querySelector(extractorDefinition.summarySelector);
			const summary = summaryElement?.textContent?.trim().replace(/\s+/g, " ");
			const headingName = heading.tagName.toLowerCase();
			const sectionContainer = extractorDefinition.sectionSelector
				? card.closest(extractorDefinition.sectionSelector)
				: null;
			const sectionHeading = sectionContainer?.querySelector("h1, h2");
			const sectionText = sectionHeading?.textContent?.trim().replace(/\s+/g, " ");
			const section = sectionText && sectionText !== headline ? sectionText : undefined;
			const categoryElement = extractorDefinition.categorySelector
				? card.matches(extractorDefinition.categorySelector)
					? card
					: card.querySelector(extractorDefinition.categorySelector)
				: null;
			const categoryValue = extractorDefinition.categoryAttribute
				? categoryElement?.getAttribute(extractorDefinition.categoryAttribute)
				: categoryElement?.textContent;
			const categoryText = categoryValue?.trim().replace(/\s+/g, " ");
			const absoluteTop = rect.top + browser.scrollY;
			const viewportDepth = absoluteTop / browser.innerHeight;

			let imageDetails: CollectedElement["image"];

			if (image) {
				const imageSource = image.getAttribute("src");
				imageDetails = {
					alt: image.getAttribute("alt") ?? undefined,
					sourceUrl: imageSource ? new URL(imageSource, document.baseURI).toString() : undefined,
				};
			}

			return [
				{
					canonicalUrl,
					category: categoryText || section,
					elementKey: canonicalUrl,
					headline,
					image: imageDetails,
					kind: "story",
					position: {
						height: rect.height,
						left: rect.left,
						pageOrder: 0,
						top: absoluteTop,
						viewportDepth,
						width: rect.width,
					},
					prominence: "standard",
					selectorHint: headingName,
					section,
					summary: summary || undefined,
					textFingerprint: headline.toLowerCase(),
				},
			];
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
								code: "no-story-matches",
								message: `No elements matched ${extractorDefinition.name}`,
							},
						]
					: [],
		});
	}, extractor);

	return JSON.parse(serialised) as CollectedPage;
}

export async function collectAndStoreAnalysis(input: AnalysisInput): Promise<AnalysisOutcome> {
	const { bucket, capturedAt, device, page, profile, screenshotKey, site, triggeredAt } = input;

	const allowAllAnalysis = false;
	if (!allowAllAnalysis && (!site.analysis || site.analysis?.device !== device)) {
		return {
			status: "failed",
		};
	}

	const keys = analysisKeys(site, device, triggeredAt);
	const captureId = `${site.name}:${device}:${triggeredAt}`;

	try {
		const extractorToUse = site.analysis?.extractor ? site.analysis.extractor : "generic-baseline";
		const versionToUse = site.analysis?.version ? site.analysis.version : 1;
		const extractor = extractorDefinition(extractorToUse, versionToUse);

		const collected = await collectPage(page, extractor);
		const stories = determineStoryProminence(
			normaliseStoryElements(collected.elements),
			collected.pageWidth,
		);

		const canonicalElements = stories.map((element) => {
			const canonicalUrl = canonicaliseUrl(element.canonicalUrl);
			const category = storyCategory(canonicalUrl, element.category ?? element.section);

			return {
				...element,
				canonicalUrl,
				category,
				elementKey: canonicalUrl,
			};
		});

		collected.elements = [
			...new Map(canonicalElements.map((element) => [element.elementKey, element])).values(),
		];

		const minimumElements = site?.analysis?.minimumElements ?? 0;
		if (collected.elements.length < minimumElements) {
			throw new Error(
				`Expected at least ${minimumElements} elements, ` + `found ${collected.elements.length}`,
			);
		}

		collected.elements = await storeOptionalImageCrops(
			input,
			collected.elements,
			keys.extractionKey,
			collected.warnings,
		);
		const contentHash = await sha256(collected.html);
		const structureSource = collected.elements.map(({ elementKey }) => elementKey).join("\n");
		const structureHash = await sha256(structureSource);

		const extraction = {
			capture: {
				captureId,
				capturedAt,
				device,
				extractor: {
					name: extractorToUse,
					version: versionToUse,
				},
				htmlKey: keys.htmlKey,
				pageHeight: collected.pageHeight,
				pageWidth: collected.pageWidth,
				profile,
				sanitisationVersion: SANITISATION_VERSION,
				schemaVersion: SCHEMA_VERSION,
				screenshotKey,
				site: site.name,
				sourceUrl: site.url,
				triggeredAt,
			},
			contentHash,
			elements: collected.elements,
			structureHash,
			warnings: collected.warnings,
		};

		const metadata = {
			captureId,
			capturedAt,
			category: site.category,
			device,
			extractor: extractorToUse,
			extractorVersion: String(versionToUse),
			profile,
			schemaVersion: String(SCHEMA_VERSION),
			site: site.name,
			sourceUrl: site.url,
			triggeredAt,
			visibility: site.visibility ?? "public",
		};

		const compressedHtml = await gzip(collected.html);
		const serialisedExtraction = JSON.stringify(extraction);
		const compressedExtraction = await gzip(serialisedExtraction);

		await bucket.put(keys.htmlKey, compressedHtml, {
			customMetadata: {
				...metadata,
				contentHash,
				sanitisationVersion: String(SANITISATION_VERSION),
				structureHash,
			},
			httpMetadata: {
				contentEncoding: "gzip",
				contentType: "text/html; charset=utf-8",
			},
		});

		await bucket.put(keys.extractionKey, compressedExtraction, {
			customMetadata: metadata,
			httpMetadata: {
				contentEncoding: "gzip",
				contentType: "application/json",
			},
		});
		return {
			extractionKey: keys.extractionKey,
			htmlKey: keys.htmlKey,
			status: "stored",
		};
	} catch (error) {
		let message = "Unknown analysis failure";

		if (error instanceof Error) {
			message = error.message;
		}

		const failure = {
			captureId,
			capturedAt,
			device,
			message,
			site: site.name,
			triggeredAt,
		};

		try {
			const serialisedFailure = JSON.stringify(failure);

			await bucket.put(keys.failureKey, serialisedFailure, {
				customMetadata: {
					captureId,
					capturedAt,
					device,
					site: site.name,
					triggeredAt,
				},
				httpMetadata: {
					contentType: "application/json",
				},
			});

			return {
				failureKey: keys.failureKey,
				status: "failed",
			};
		} catch {
			return {
				status: "failed",
			};
		}
	}
}
