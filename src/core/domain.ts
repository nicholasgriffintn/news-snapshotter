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
	displayName?: string;
	interDeviceDelaySeconds?: number;
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

export type ExtractorName =
	| "apnews-front-page"
	| "bbc-front-page"
	| "bloomberg-front-page"
	| "channel4-front-page"
	| "cnn-front-page"
	| "dailymail-front-page"
	| "express-front-page"
	| "financialtimes-front-page"
	| "forbes-front-page"
	| "foxnews-front-page"
	| "generic-baseline"
	| "guardian-front-page"
	| "inews-front-page"
	| "nbcnews-front-page"
	| "nytimes-front-page"
	| "standard-front-page"
	| "telegraph-front-page"
	| "times-front-page"
	| "usatoday-front-page"
	| "washingtonpost-front-page";

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
