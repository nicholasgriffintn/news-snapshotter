import type {
	CapturePriority,
	CaptureProviderName,
	CaptureRegion,
	Device,
	SiteCategory,
	Snapshot,
} from "./contracts.ts";

export type {
	CapturePriority,
	CaptureProviderName,
	CaptureRegion,
	Device,
	SiteCategory,
} from "./contracts.ts";

export type SiteDefinition = {
	analysis?: SiteAnalysisConfig;
	name: string;
	provider?: CaptureProviderName;
	brand: string;
	captureRegion: CaptureRegion;
	category: SiteCategory;
	priority: CapturePriority;
	completion?: {
		selector: string;
		textStartsWith: string;
		timeoutMs: number;
	};
	profile?: string;
	runtimeQuietMs?: number;
	url: string;
	requestBody?: {
		addStyleTag?: string;
	};
	visibility?: "admin" | "public";
};

export type ExtractorName = "bbc-front-page" | "generic-baseline" | "guardian-front-page";

export type SiteAnalysisConfig = {
	device: "desktop";
	extractor: ExtractorName;
	imageCrops?: {
		maxPerCapture: number;
	};
	minimumElements: number;
	version: number;
};

export type SiteSource = Omit<SiteDefinition, "brand" | "captureRegion" | "priority"> & {
	captureRegion?: CaptureRegion;
	priority?: CapturePriority;
};

export type ScreenshotResult = {
	analysis?: {
		extractionKey?: string;
		failureKey?: string;
		htmlKey?: string;
		indexingStatus?: "not-queued" | "pending";
		status: "failed" | "stored";
	};
	capturedAt: string;
	device: Device;
	name: string;
	status: "success" | "error";
	triggeredAt: string;
	key?: string;
	error?: string;
	failureKey?: string;
};

export type ScreenshotSummary = Snapshot;
