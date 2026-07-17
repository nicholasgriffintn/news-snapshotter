export type SiteCategory = "news" | "sport";
export type Device = "desktop" | "mobile";

export type SiteDefinition = {
	analysis?: SiteAnalysisConfig;
	name: string;
	brand: string;
	category: SiteCategory;
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

export type SiteAnalysisConfig = {
	device: "desktop";
	extractor: "bbc-front-page";
	minimumElements: number;
	version: number;
};

export type SiteSource = Omit<SiteDefinition, "brand">;

export type ScreenshotResult = {
	analysis?: {
		extractionKey?: string;
		failureKey?: string;
		htmlKey?: string;
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

export type ScreenshotSummary = {
	brand: string;
	capturedAt: string;
	category: SiteCategory;
	device: Device;
	fullImageUrl: string;
	key: string;
	name: string;
	thumbnailUrl: string;
	triggeredAt: string;
	url: string;
};
