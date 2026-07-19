import type { Page } from "@cloudflare/puppeteer";

import type { Device, SiteDefinition } from "../../../core/domain.ts";
import { storyCategory } from "../../history/domain/story-classification.ts";
import {
	type CollectedElement,
	type CollectedPage,
	normaliseContentElements,
} from "../domain/content-elements.ts";
import { extractorDefinition } from "../domain/extractor-registry.ts";
import { determineStoryProminence } from "../domain/story-prominence.ts";
import { collectPageContent } from "./page-content-collector.ts";

const SCHEMA_VERSION = 2;
const SANITISATION_VERSION = 1;

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

		const collected = await collectPageContent(page, extractor);
		collected.warnings ??= [];
		const canonicalElements = collected.elements.map((element) => {
			const canonicalUrl = element.canonicalUrl ? canonicaliseUrl(element.canonicalUrl) : undefined;
			const category =
				element.kind === "story"
					? storyCategory(canonicalUrl, element.category ?? element.section)
					: element.category;

			return {
				...element,
				...(canonicalUrl ? { canonicalUrl } : {}),
				category,
				elementKey: canonicalUrl ?? element.elementKey,
			};
		});
		const content = normaliseContentElements(canonicalElements);
		const prominentStories = determineStoryProminence(
			content.filter((element) => element.kind === "story"),
			collected.pageWidth,
		);
		const storiesByKey = new Map(prominentStories.map((story) => [story.elementKey, story]));

		collected.elements = content.map((element) => {
			const resolved = storiesByKey.get(element.elementKey) ?? element;
			const { prominenceHint: _prominenceHint, ...storedElement } = resolved;
			return storedElement;
		});

		const minimumElements = site?.analysis?.minimumElements ?? 0;
		const storyCount = collected.elements.filter(({ kind }) => kind === "story").length;
		if (storyCount < minimumElements) {
			throw new Error(`Expected at least ${minimumElements} story elements, found ${storyCount}`);
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
