import type { Page } from "@cloudflare/puppeteer";

import type { Device, SiteDefinition } from "./types";

const SCHEMA_VERSION = 1;
const SANITISATION_VERSION = 1;

type ElementPosition = {
	height: number;
	left: number;
	pageOrder: number;
	top: number;
	viewportDepth: number;
	width: number;
};

type CollectedElement = {
	canonicalUrl: string;
	elementKey: string;
	headline: string;
	image?: {
		alt?: string;
		sourceUrl?: string;
	};
	kind: "story";
	position: ElementPosition;
	prominence: "lead" | "major" | "standard";
	selectorHint: string;
	summary?: string;
	textFingerprint: string;
};

type CollectedPage = {
	elements: CollectedElement[];
	html: string;
	pageHeight: number;
	pageWidth: number;
};

type ScreenshotAnalysis = import("./types").ScreenshotResult["analysis"];

export type AnalysisOutcome = NonNullable<ScreenshotAnalysis>;

type AnalysisInput = {
	bucket: R2Bucket;
	capturedAt: string;
	device: Device;
	page: Page;
	profile: string;
	screenshotKey: string;
	site: SiteDefinition;
	triggeredAt: string;
};

export function normaliseStoryElements(
	elements: CollectedPage["elements"],
): CollectedPage["elements"] {
	return elements
		.filter((element) => {
			return (
				element.selectorHint !== "a" && element.position.height > 0 && element.position.width > 0
			);
		})
		.map((element, index) => {
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

async function collectPage(page: Page): Promise<CollectedPage> {
	const serialised = await page.evaluate(() => {
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

		const seen = new Set<string>();
		const links = Array.from(document.querySelectorAll("a[href]"));
		const elements = links.flatMap((link) => {
			const cardSelector = 'article, [data-testid*="card"], li';
			const headlineSelector = 'h1, h2, h3, [data-testid*="headline"]';
			const card = link.closest(cardSelector) ?? link;
			const heading = card.querySelector(headlineSelector);

			if (!heading) {
				return [];
			}

			const headingText = heading.textContent ?? link.textContent ?? "";
			const headline = headingText.trim().replace(/\s+/g, " ");

			if (headline.length < 10) {
				return [];
			}

			const canonicalUrl = new URL(link.href, document.baseURI).toString();

			if (seen.has(canonicalUrl)) {
				return [];
			}

			seen.add(canonicalUrl);

			const rect = link.getBoundingClientRect();
			const image = card.querySelector("img");
			const summaryElement = card.querySelector("p");
			const summary = summaryElement?.textContent?.trim().replace(/\s+/g, " ");
			const headingName = heading.tagName.toLowerCase();
			const isLead = headingName === "h1";
			const majorStoryWidth = document.documentElement.scrollWidth * 0.4;
			const isWide = rect.width > majorStoryWidth;
			const isAboveFold = rect.top < browser.innerHeight;
			const absoluteTop = rect.top + browser.scrollY;
			const viewportDepth = absoluteTop / browser.innerHeight;
			let prominence: CollectedElement["prominence"] = "standard";

			if (isLead) {
				prominence = "lead";
			} else if (isWide && isAboveFold) {
				prominence = "major";
			}

			let imageDetails: CollectedElement["image"];

			if (image) {
				imageDetails = {
					alt: image.getAttribute("alt") ?? undefined,
					sourceUrl: image.getAttribute("src") ?? undefined,
				};
			}

			return [
				{
					canonicalUrl,
					elementKey: canonicalUrl,
					headline,
					image: imageDetails,
					kind: "story",
					position: {
						height: rect.height,
						left: rect.left,
						pageOrder: seen.size,
						top: absoluteTop,
						viewportDepth,
						width: rect.width,
					},
					prominence,
					selectorHint: headingName,
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
		});
	});

	return JSON.parse(serialised) as CollectedPage;
}

export async function collectAndStoreAnalysis(input: AnalysisInput): Promise<AnalysisOutcome> {
	const { bucket, capturedAt, device, page, profile, screenshotKey, site, triggeredAt } = input;
	if (!site.analysis || site.analysis.device !== device) {
		return {
			status: "failed",
		};
	}

	const keys = analysisKeys(site, device, triggeredAt);
	const captureId = `${site.name}:${device}:${triggeredAt}`;

	try {
		const collected = await collectPage(page);
		const stories = normaliseStoryElements(collected.elements);
		const canonicalElements = stories.map((element) => {
			const canonicalUrl = canonicaliseUrl(element.canonicalUrl);

			return {
				...element,
				canonicalUrl,
				elementKey: canonicalUrl,
			};
		});

		collected.elements = [
			...new Map(canonicalElements.map((element) => [element.elementKey, element])).values(),
		];

		if (collected.elements.length < site.analysis.minimumElements) {
			throw new Error(
				`Expected at least ${site.analysis.minimumElements} elements, ` +
					`found ${collected.elements.length}`,
			);
		}
		const contentHash = await sha256(collected.html);
		const structureSource = collected.elements.map(({ elementKey }) => elementKey).join("\n");
		const structureHash = await sha256(structureSource);

		const extraction = {
			capture: {
				captureId,
				capturedAt,
				device,
				extractor: {
					name: site.analysis.extractor,
					version: site.analysis.version,
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
			warnings: [],
		};

		const metadata = {
			captureId,
			capturedAt,
			category: site.category,
			device,
			extractor: site.analysis.extractor,
			extractorVersion: String(site.analysis.version),
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
