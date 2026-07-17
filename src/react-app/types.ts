export type Snapshot = {
	brand: string;
	capturedAt: string;
	category: "news" | "sport";
	device: "desktop" | "mobile";
	fullImageUrl: string;
	key: string;
	name: string;
	thumbnailUrl: string;
	triggeredAt: string;
	url: string;
};

export type SnapshotGroup = Pick<
	Snapshot,
	"brand" | "capturedAt" | "category" | "name" | "triggeredAt" | "url"
> & {
	variants: Partial<Record<Snapshot["device"], Snapshot>>;
};

export type CapturePriority = 1 | 2 | 3 | 4;

export type CatalogueSite = Pick<Snapshot, "brand" | "category" | "name"> & {
	priority: CapturePriority;
};

export type CaptureFailure = {
	brand: string;
	capturedAt: string;
	category: Snapshot["category"];
	device: Snapshot["device"];
	message: string;
	name: string;
	reason: string;
	storedAt: string;
	url: string;
};
