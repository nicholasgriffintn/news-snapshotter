import type {
	CaptureFailureRecord,
	CapturePriority,
	CaptureProviderName,
	CaptureRegion,
	CatalogueSite,
	Snapshot,
} from "../../core/contracts.ts";

export type {
	CapturePriority,
	CaptureProviderName,
	CaptureRegion,
	CatalogueSite,
	Snapshot,
} from "../../core/contracts.ts";

export type SnapshotGroup = Pick<
	Snapshot,
	"brand" | "capturedAt" | "category" | "name" | "triggeredAt" | "url"
> & {
	variants: Partial<Record<Snapshot["device"], Snapshot>>;
};

export type CaptureFailure = CaptureFailureRecord;

export type HistorySite = {
	captureCount: number;
	device: "desktop";
	firstCaptureAt: string;
	lastCaptureAt: string;
	site: string;
	sourceUrl: string;
	storyCount: number;
};

export type HistoryCaptureSummary = {
	captureId: string;
	capturedAt: string;
	contentHash: string;
	device: "desktop";
	extractorName: string;
	extractorVersion: number;
	pageHeight: number;
	pageWidth: number;
	schemaVersion: number;
	screenshotKey: string;
	sourceUrl: string;
	structureHash: string;
	triggeredAt: string;
};

export type HistoryElement = {
	canonicalUrl?: string;
	category?: string;
	elementKey: string;
	headline?: string;
	image?: { alt?: string; sourceUrl?: string };
	kind: "story" | "heading" | "image" | "navigation" | "other";
	position: {
		height: number;
		left: number;
		pageOrder: number;
		top: number;
		viewportDepth: number;
		width: number;
	};
	prominence?: "lead" | "major" | "standard" | "minor";
	section?: string;
	summary?: string;
	textFingerprint: string;
};

export type HistoryCapture = {
	capture: {
		captureId: string;
		capturedAt: string;
		device: "desktop";
		extractor: { name: string; version: number };
		pageHeight: number;
		pageWidth: number;
		schemaVersion: number;
		screenshotKey: string;
		site: string;
		sourceUrl: string;
		triggeredAt: string;
	};
	contentHash: string;
	elements: HistoryElement[];
	structureHash: string;
	warningCount: number;
};

export type HistoryChange = {
	after: unknown;
	before: unknown;
	capturedAt: string;
	changeId: string;
	currentCaptureId: string;
	elementKey?: string;
	magnitude?: number;
	previousCaptureId: string;
	storyId?: string;
	type: string;
};

export type HistoryFailure = {
	captureId?: string;
	device: "desktop";
	failedAt: string;
	stage: string;
};

export type HistorySearchResult = {
	canonicalUrl?: string;
	captureId: string;
	capturedAt: string;
	category?: string;
	headline?: string;
	imageAlt?: string;
	imageSourceUrl?: string;
	prominence?: string;
	rank: number;
	section?: string;
	site: string;
	storyId: string;
	summary?: string;
};

export type HistoryImageObservation = {
	alt?: string;
	captureId: string;
	capturedAt: string;
	cropKey?: string;
	headline?: string;
	imageId: string;
	publisherUrl: string;
	sourceUrl: string;
	storyId: string;
};

export type HistoryTrendValue = {
	count: number;
	label: string;
	weightSeconds: number;
};

export type HistoryTrends = {
	mode: "category" | "main-headline-words" | "all-headline-words";
	period: string;
	periods: Array<{ period: string; values: HistoryTrendValue[] }>;
	site: string;
	timeWeighted: boolean;
};

export type StoryObservation = {
	captureId: string;
	capturedAt: string;
	category?: string;
	headline?: string;
	height: number;
	imageAlt?: string;
	imageCropKey?: string;
	imageSourceUrl?: string;
	left: number;
	prominence?: string;
	rank: number;
	section?: string;
	summary?: string;
	top: number;
	viewportDepth: number;
	width: number;
};

export type StoryHistory = {
	canonicalUrl?: string;
	cursor?: string;
	observations: StoryObservation[];
	storyId: string;
};

export type SavedTimeline = {
	createdAt: string;
	name: string;
	observations: Array<{
		canonicalUrl?: string;
		captureId?: string;
		capturedAt?: string;
		headline?: string;
		imageSourceUrl?: string;
		imageCropKey?: string;
		position: number;
		prominence?: string;
		rank?: number;
		storyId: string;
		top?: number;
	}>;
	site: string;
	slug: string;
	timelineId: string;
	truncated?: boolean;
};
