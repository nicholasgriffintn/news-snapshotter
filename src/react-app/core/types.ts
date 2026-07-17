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
