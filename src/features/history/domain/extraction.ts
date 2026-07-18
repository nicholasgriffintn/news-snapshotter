export type ElementPosition = {
	height: number;
	left: number;
	pageOrder: number;
	top: number;
	viewportDepth: number;
	width: number;
};

export type PageElement = {
	canonicalUrl?: string;
	category?: string;
	elementKey: string;
	headline?: string;
	image?: {
		alt?: string;
		cropKey?: string;
		sourceUrl?: string;
	};
	kind: "story" | "heading" | "image" | "navigation" | "other";
	position: ElementPosition;
	prominence?: "lead" | "major" | "standard" | "minor";
	section?: string;
	selectorHint?: string;
	summary?: string;
	textFingerprint: string;
};

export type PageExtraction = {
	capture: {
		captureId: string;
		capturedAt: string;
		device: "desktop";
		extractor: {
			name: string;
			version: number;
		};
		htmlKey: string;
		pageHeight: number;
		pageWidth: number;
		profile: string;
		sanitisationVersion: number;
		schemaVersion: number;
		screenshotKey: string;
		site: string;
		sourceUrl: string;
		triggeredAt: string;
	};
	contentHash: string;
	elements: PageElement[];
	structureHash: string;
	warnings: Array<{
		code: string;
		message: string;
	}>;
};

const ELEMENT_KINDS = new Set(["story", "heading", "image", "navigation", "other"]);
const PROMINENCE_VALUES = new Set(["lead", "major", "standard", "minor"]);
const MAX_ELEMENTS = 200;
const MAX_WARNINGS = 100;
const MAX_TEXT_LENGTH = 20_000;
const MAX_IDENTIFIER_LENGTH = 4_096;

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
	return (
		typeof record[key] === "string" &&
		record[key].length > 0 &&
		record[key].length <= MAX_IDENTIFIER_LENGTH
	);
}

function isOptionalString(value: unknown, maximum = MAX_TEXT_LENGTH): boolean {
	return value === undefined || (typeof value === "string" && value.length <= maximum);
}

function isImage(value: unknown): boolean {
	if (value === undefined) {
		return true;
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const image = value as Record<string, unknown>;
	return (
		isOptionalString(image.alt) &&
		isOptionalString(image.cropKey, MAX_IDENTIFIER_LENGTH) &&
		isOptionalString(image.sourceUrl, MAX_IDENTIFIER_LENGTH) &&
		(image.sourceUrl === undefined || isWebUrl(image.sourceUrl))
	);
}

function isElement(value: unknown): value is PageElement {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const element = value as Record<string, unknown>;
	const position = element.position;

	if (!position || typeof position !== "object" || Array.isArray(position)) {
		return false;
	}
	const geometry = position as Record<string, unknown>;

	return (
		hasString(element, "elementKey") &&
		typeof element.kind === "string" &&
		ELEMENT_KINDS.has(element.kind) &&
		hasString(element, "textFingerprint") &&
		isOptionalString(element.canonicalUrl, MAX_IDENTIFIER_LENGTH) &&
		(element.canonicalUrl === undefined || isWebUrl(element.canonicalUrl)) &&
		isOptionalString(element.category) &&
		isOptionalString(element.headline) &&
		isImage(element.image) &&
		(element.prominence === undefined ||
			(typeof element.prominence === "string" && PROMINENCE_VALUES.has(element.prominence))) &&
		isOptionalString(element.section) &&
		isOptionalString(element.selectorHint) &&
		isOptionalString(element.summary) &&
		isFiniteNumber(geometry.height) &&
		geometry.height >= 0 &&
		isFiniteNumber(geometry.left) &&
		isFiniteNumber(geometry.pageOrder) &&
		Number.isInteger(geometry.pageOrder) &&
		geometry.pageOrder >= 0 &&
		isFiniteNumber(geometry.top) &&
		isFiniteNumber(geometry.viewportDepth) &&
		isFiniteNumber(geometry.width) &&
		geometry.width >= 0
	);
}

function isWarning(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const warning = value as Record<string, unknown>;
	return hasString(warning, "code") && hasString(warning, "message");
}

function isIsoTimestamp(value: unknown): boolean {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}T/.test(value) &&
		Number.isFinite(Date.parse(value))
	);
}

function isWebUrl(value: unknown): boolean {
	if (typeof value !== "string") {
		return false;
	}
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

export function parsePageExtraction(value: unknown): PageExtraction {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Extraction document must be an object");
	}

	const document = value as Record<string, unknown>;
	const capture = document.capture;
	if (!capture || typeof capture !== "object" || Array.isArray(capture)) {
		throw new Error("Extraction document capture is missing");
	}

	const details = capture as Record<string, unknown>;
	const extractor = details.extractor;
	if (!extractor || typeof extractor !== "object" || Array.isArray(extractor)) {
		throw new Error("Extraction document extractor is missing");
	}
	const extractorDetails = extractor as Record<string, unknown>;
	const elements = document.elements;

	const requiredCaptureStrings = [
		"captureId",
		"capturedAt",
		"device",
		"htmlKey",
		"profile",
		"screenshotKey",
		"site",
		"sourceUrl",
		"triggeredAt",
	];
	const captureIsValid = requiredCaptureStrings.every((key) => hasString(details, key));
	const hashesAreValid = hasString(document, "contentHash") && hasString(document, "structureHash");

	if (
		!captureIsValid ||
		details.device !== "desktop" ||
		!isIsoTimestamp(details.capturedAt) ||
		!isIsoTimestamp(details.triggeredAt) ||
		!isWebUrl(details.sourceUrl) ||
		!hasString(extractorDetails, "name") ||
		typeof extractorDetails.version !== "number" ||
		!Number.isInteger(extractorDetails.version) ||
		extractorDetails.version < 1 ||
		!isFiniteNumber(details.pageHeight) ||
		details.pageHeight <= 0 ||
		!isFiniteNumber(details.pageWidth) ||
		details.pageWidth <= 0 ||
		typeof details.sanitisationVersion !== "number" ||
		!Number.isInteger(details.sanitisationVersion) ||
		details.sanitisationVersion < 1 ||
		typeof details.schemaVersion !== "number" ||
		!Number.isInteger(details.schemaVersion) ||
		details.schemaVersion < 1 ||
		!hashesAreValid ||
		!Array.isArray(elements) ||
		elements.length > MAX_ELEMENTS ||
		!elements.every(isElement) ||
		!Array.isArray(document.warnings) ||
		document.warnings.length > MAX_WARNINGS ||
		!document.warnings.every(isWarning)
	) {
		throw new Error("Extraction document does not match the supported schema");
	}

	return value as PageExtraction;
}
