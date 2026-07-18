export type SiteCategory = "news" | "sport";
export type Device = "desktop" | "mobile";
export type CapturePriority = 1 | 2 | 3 | 4;
export type CaptureRegion = "international" | "uk" | "us";
export type CaptureProviderName = "cloudflare" | "hyperbrowser";

export type Snapshot = {
	brand: string;
	capturedAt: string;
	category: SiteCategory;
	device: Device;
	displayName?: string;
	fullImageUrl: string;
	key: string;
	name: string;
	thumbnailUrl: string;
	triggeredAt: string;
	url: string;
};

export type CatalogueSite = Pick<Snapshot, "brand" | "category" | "displayName" | "name"> & {
	captureRegion: CaptureRegion;
	priority: CapturePriority;
	provider: CaptureProviderName;
};

export type CaptureFailureRecord = {
	brand: string;
	capturedAt: string;
	category: SiteCategory;
	device: Device;
	message: string;
	name: string;
	reason: string;
	storedAt: string;
	triggeredAt: string;
	url: string;
};

export type CaptureSelection = {
	brand?: string;
	name?: string;
	priority?: CapturePriority;
	provider?: CaptureProviderName;
};

export type CaptureDispatch = {
	batchId: string;
	runnerCount: number;
	selectedSites: CatalogueSite[];
	triggeredAt: string;
	workflowId?: string;
	workflowIds: string[];
};
