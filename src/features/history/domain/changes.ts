import type { PageElement, PageExtraction } from "./extraction.ts";

export const POSITION_NOISE = {
	minimumNormalisedDistance: 0.005,
	minimumPixelDistance: 8,
	minimumSizeRatio: 0.02,
	minimumSizePixels: 2,
} as const;

const EXPECTED_CAPTURE_INTERVAL_MS = 60 * 60 * 1_000;
const CAPTURE_GAP_THRESHOLD_MS = EXPECTED_CAPTURE_INTERVAL_MS * 1.5;

export type ChangeType =
	| "appeared"
	| "disappeared"
	| "headline-changed"
	| "summary-changed"
	| "image-changed"
	| "image-alt-changed"
	| "kind-changed"
	| "section-changed"
	| "category-changed"
	| "rank-changed"
	| "promoted"
	| "demoted"
	| "position-changed"
	| "size-changed"
	| "page-structure-changed"
	| "capture-gap"
	| "extractor-version-boundary";

export type ChangeValue = null | number | string | Record<string, number | string>;

export type ChangeEvent = {
	after: ChangeValue;
	before: ChangeValue;
	changeId: string;
	currentCaptureId: string;
	elementKey?: string;
	extractorName: string;
	extractorVersion: number;
	magnitude?: number;
	previousCaptureId: string;
	schemaVersion: number;
	type: ChangeType;
};

type PendingChange = Omit<ChangeEvent, "changeId">;

async function sha256(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);

	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function baseChange(
	previous: PageExtraction,
	current: PageExtraction,
	type: ChangeType,
	before: ChangeValue,
	after: ChangeValue,
): PendingChange {
	return {
		after,
		before,
		currentCaptureId: current.capture.captureId,
		extractorName: current.capture.extractor.name,
		extractorVersion: current.capture.extractor.version,
		previousCaptureId: previous.capture.captureId,
		schemaVersion: current.capture.schemaVersion,
		type,
	};
}

function elementChange(
	previous: PageExtraction,
	current: PageExtraction,
	element: PageElement,
	type: ChangeType,
	before: ChangeValue,
	after: ChangeValue,
	magnitude?: number,
): PendingChange {
	return {
		...baseChange(previous, current, type, before, after),
		elementKey: element.elementKey,
		magnitude,
	};
}

function stringChange(
	changes: PendingChange[],
	previous: PageExtraction,
	current: PageExtraction,
	element: PageElement,
	type: ChangeType,
	before: string | undefined,
	after: string | undefined,
): void {
	if ((before ?? null) !== (after ?? null)) {
		changes.push(elementChange(previous, current, element, type, before ?? null, after ?? null));
	}
}

function prominenceScore(value: PageElement["prominence"]): number {
	return { lead: 4, major: 3, standard: 2, minor: 1 }[value ?? "minor"];
}

function addMatchedElementChanges(
	changes: PendingChange[],
	previous: PageExtraction,
	current: PageExtraction,
	before: PageElement,
	after: PageElement,
): void {
	stringChange(
		changes,
		previous,
		current,
		after,
		"headline-changed",
		before.headline,
		after.headline,
	);
	stringChange(changes, previous, current, after, "summary-changed", before.summary, after.summary);
	stringChange(
		changes,
		previous,
		current,
		after,
		"image-changed",
		before.image?.sourceUrl,
		after.image?.sourceUrl,
	);
	stringChange(
		changes,
		previous,
		current,
		after,
		"image-alt-changed",
		before.image?.alt,
		after.image?.alt,
	);
	stringChange(changes, previous, current, after, "section-changed", before.section, after.section);
	stringChange(
		changes,
		previous,
		current,
		after,
		"category-changed",
		before.category,
		after.category,
	);
	stringChange(changes, previous, current, after, "kind-changed", before.kind, after.kind);

	if (before.position.pageOrder !== after.position.pageOrder) {
		changes.push(
			elementChange(
				previous,
				current,
				after,
				"rank-changed",
				before.position.pageOrder,
				after.position.pageOrder,
				Math.abs(after.position.pageOrder - before.position.pageOrder),
			),
		);
	}

	const beforeProminence = prominenceScore(before.prominence);
	const afterProminence = prominenceScore(after.prominence);
	if (beforeProminence !== afterProminence) {
		changes.push(
			elementChange(
				previous,
				current,
				after,
				afterProminence > beforeProminence ? "promoted" : "demoted",
				before.prominence ?? "minor",
				after.prominence ?? "minor",
				Math.abs(afterProminence - beforeProminence),
			),
		);
	}

	const rawDistance = Math.hypot(
		after.position.top - before.position.top,
		after.position.left - before.position.left,
	);
	const beforeNormalised = {
		left: before.position.left / previous.capture.pageWidth,
		top: before.position.top / previous.capture.pageHeight,
	};
	const afterNormalised = {
		left: after.position.left / current.capture.pageWidth,
		top: after.position.top / current.capture.pageHeight,
	};
	const normalisedDistance = Math.hypot(
		afterNormalised.top - beforeNormalised.top,
		afterNormalised.left - beforeNormalised.left,
	);
	if (
		rawDistance >= POSITION_NOISE.minimumPixelDistance &&
		normalisedDistance >= POSITION_NOISE.minimumNormalisedDistance
	) {
		changes.push(
			elementChange(
				previous,
				current,
				after,
				"position-changed",
				{ ...beforeNormalised, leftPixels: before.position.left, topPixels: before.position.top },
				{ ...afterNormalised, leftPixels: after.position.left, topPixels: after.position.top },
				normalisedDistance,
			),
		);
	}

	const widthDelta = Math.abs(after.position.width - before.position.width);
	const heightDelta = Math.abs(after.position.height - before.position.height);
	const sizeRatio = Math.max(
		widthDelta / Math.max(before.position.width, 1),
		heightDelta / Math.max(before.position.height, 1),
	);
	if (
		Math.max(widthDelta, heightDelta) >= POSITION_NOISE.minimumSizePixels &&
		sizeRatio >= POSITION_NOISE.minimumSizeRatio
	) {
		changes.push(
			elementChange(
				previous,
				current,
				after,
				"size-changed",
				{ height: before.position.height, width: before.position.width },
				{ height: after.position.height, width: after.position.width },
				sizeRatio,
			),
		);
	}
}

function addPageChanges(
	changes: PendingChange[],
	previous: PageExtraction,
	current: PageExtraction,
): void {
	const elapsedMs =
		Date.parse(current.capture.capturedAt) - Date.parse(previous.capture.capturedAt);
	if (elapsedMs > CAPTURE_GAP_THRESHOLD_MS) {
		changes.push(
			baseChange(
				previous,
				current,
				"capture-gap",
				previous.capture.capturedAt,
				current.capture.capturedAt,
			),
		);
	}

	const pageHeightRatio =
		Math.abs(current.capture.pageHeight - previous.capture.pageHeight) /
		Math.max(previous.capture.pageHeight, 1);
	const elementCountRatio =
		Math.abs(current.elements.length - previous.elements.length) /
		Math.max(previous.elements.length, 1);
	if (pageHeightRatio >= 0.1 || elementCountRatio >= 0.2) {
		changes.push({
			...baseChange(
				previous,
				current,
				"page-structure-changed",
				{ elementCount: previous.elements.length, pageHeight: previous.capture.pageHeight },
				{ elementCount: current.elements.length, pageHeight: current.capture.pageHeight },
			),
			magnitude: Math.max(pageHeightRatio, elementCountRatio),
		});
	}
}

export async function diffAdjacentCaptures(
	previous: PageExtraction,
	current: PageExtraction,
): Promise<ChangeEvent[]> {
	if (
		previous.capture.site !== current.capture.site ||
		previous.capture.device !== current.capture.device
	) {
		throw new Error("Only captures from the same site and device can be compared");
	}

	const changes: PendingChange[] = [];
	addPageChanges(changes, previous, current);

	if (
		previous.capture.extractor.name !== current.capture.extractor.name ||
		previous.capture.extractor.version !== current.capture.extractor.version ||
		previous.capture.schemaVersion !== current.capture.schemaVersion
	) {
		changes.push(
			baseChange(
				previous,
				current,
				"extractor-version-boundary",
				{
					extractor: previous.capture.extractor.name,
					extractorVersion: previous.capture.extractor.version,
					schemaVersion: previous.capture.schemaVersion,
				},
				{
					extractor: current.capture.extractor.name,
					extractorVersion: current.capture.extractor.version,
					schemaVersion: current.capture.schemaVersion,
				},
			),
		);
	} else {
		const previousContent = new Map(previous.elements.map((element) => [element.elementKey, element]));
		const currentContent = new Map(current.elements.map((element) => [element.elementKey, element]));

		for (const [id, before] of previousContent) {
			const after = currentContent.get(id);
			if (!after) {
				changes.push(
					elementChange(previous, current, before, "disappeared", before.elementKey, null),
				);
				continue;
			}
			addMatchedElementChanges(changes, previous, current, before, after);
		}

		for (const [id, after] of currentContent) {
			if (!previousContent.has(id)) {
				changes.push(elementChange(previous, current, after, "appeared", null, after.elementKey));
			}
		}
	}

	changes.sort((left, right) => {
		return `${left.type}:${left.elementKey ?? ""}`.localeCompare(
			`${right.type}:${right.elementKey ?? ""}`,
		);
	});

	return Promise.all(
		changes.map(async (change) => {
			const identity = [
				change.previousCaptureId,
				change.currentCaptureId,
				change.elementKey ?? "page",
				change.type,
			].join("\n");

			return { ...change, changeId: await sha256(identity) };
		}),
	);
}
