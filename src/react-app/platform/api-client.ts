import type {
	CaptureFailure,
	CaptureProviderName,
	CatalogueSite,
	ElementHistory,
	HistoryCapture,
	HistoryCaptureSummary,
	HistoryChange,
	HistoryFailure,
	HistoryImagePage,
	HistorySearchPage,
	HistorySite,
	HistoryTrends,
	SavedTimeline,
	SavedTimelineRecord,
	SavedTimelineSummary,
	Snapshot,
} from "../core/types.ts";
import type { CaptureDispatch, CaptureSelection } from "../../core/contracts.ts";
import { coalescePublicGetRequests } from "../shared/requests.ts";

async function readJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & { message?: string };
	if (!response.ok) {
		throw new Error(body.message ?? `Request failed with ${response.status}`);
	}
	return body;
}

type RequestOptions = {
	signal?: AbortSignal;
};

// Strict Mode remounts effects in development; share identical safe reads across callers.
const fetch = coalescePublicGetRequests((input, init) => globalThis.fetch(input, init));

export async function fetchSnapshots(
	dates: readonly string[] = [],
	options?: RequestOptions,
): Promise<Snapshot[]> {
	const search = new URLSearchParams();
	for (const date of dates) {
		search.append("date", date);
	}
	const response = await fetch(`/api/screenshots${search.size > 0 ? `?${search}` : ""}`, options);
	return (await readJson<{ screenshots: Snapshot[] }>(response)).screenshots;
}

export async function fetchCatalogue(options?: RequestOptions): Promise<CatalogueSite[]> {
	const response = await fetch("/api/catalogue", options);
	return (await readJson<{ sites: CatalogueSite[] }>(response)).sites;
}

export async function startSnapshotWorkflow(
	apiKey: string,
	selection: CaptureSelection,
): Promise<CaptureDispatch> {
	const response = await fetch("/api/workflows", {
		method: "POST",
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		body: JSON.stringify(selection),
	});
	return readJson(response);
}

export async function fetchCaptureProviders(): Promise<CaptureProviderName[]> {
	const response = await fetch("/api/capture-providers");

	return (
		await readJson<{
			providers: CaptureProviderName[];
		}>(response)
	).providers;
}

export async function fetchCaptureProfiles(): Promise<string[]> {
	const response = await fetch("/api/capture-profiles");
	return (await readJson<{ profiles: string[] }>(response)).profiles;
}

export async function fetchCaptureFailures(
	apiKey: string,
	cursor?: string,
): Promise<{ cursor?: string; failures: CaptureFailure[]; hasMore: boolean }> {
	const search = new URLSearchParams({ limit: "50" });
	if (cursor) {
		search.set("cursor", cursor);
	}
	const response = await fetch(`/api/admin/failures?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export async function clearCaptureFailures(apiKey: string): Promise<number> {
	let cleared = 0;
	let cursor: string | undefined;
	let hasMore: boolean;
	do {
		const search = new URLSearchParams();
		if (cursor) {
			search.set("cursor", cursor);
		}
		const query = search.size > 0 ? `?${search}` : "";
		const response = await fetch(`/api/admin/failures${query}`, {
			headers: { authorization: `Bearer ${apiKey}` },
			method: "DELETE",
		});
		const page = await readJson<{ cleared: number; cursor?: string; hasMore: boolean }>(response);
		cleared += page.cleared;
		if (page.hasMore && !page.cursor) {
			throw new Error("Capture failure clearing could not continue");
		}
		cursor = page.cursor;
		hasMore = page.hasMore;
	} while (hasMore);
	return cleared;
}

export type BotCheckResult = {
	profile: string;
	results: Array<{
		capturedAt: string;
		device: "desktop" | "mobile";
		error?: string;
		fullImageUrl?: string;
		key?: string;
		status: "error" | "success";
		thumbnailUrl?: string;
		triggeredAt: string;
	}>;
	triggeredAt: string;
	url: string;
};

export async function startBotCheck(apiKey: string, profile: string): Promise<BotCheckResult> {
	const response = await fetch("/api/admin/bot-checks", {
		body: JSON.stringify({ profile }),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	return readJson(response);
}

export async function sendContactMessage(message: {
	email: string;
	message: string;
	name: string;
	reason: "general" | "privacy" | "rights-holder";
	sourceUrl?: string;
	startedAt: number;
	website: string;
}): Promise<void> {
	const response = await fetch("/api/contact", {
		body: JSON.stringify(message),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	await readJson(response);
}

export async function fetchHistorySites(options?: RequestOptions): Promise<HistorySite[]> {
	const response = await fetch("/api/history/sites", options);
	return (await readJson<{ sites: HistorySite[] }>(response)).sites;
}

export async function fetchAvailableHistorySites(options?: RequestOptions): Promise<string[]> {
	const response = await fetch("/api/history/sites/available", options);
	return (await readJson<{ sites: string[] }>(response)).sites;
}

export async function fetchHistoryCaptures(
	site: string,
	cursor?: string,
	options?: RequestOptions,
): Promise<{ captures: HistoryCaptureSummary[]; cursor?: string }> {
	const search = new URLSearchParams({ limit: "100" });
	if (cursor) {
		search.set("cursor", cursor);
	}
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/captures?${search}`,
		options,
	);
	return readJson(response);
}

export async function fetchHistoryCapture(
	site: string,
	captureId: string,
	options?: RequestOptions,
): Promise<HistoryCapture> {
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/captures/${encodeURIComponent(captureId)}`,
		options,
	);
	return readJson(response);
}

export async function fetchHistoryChanges(
	site: string,
	capturedAt: string,
	options?: RequestOptions,
): Promise<HistoryChange[]> {
	const changes: HistoryChange[] = [];
	let cursor: string | undefined;
	do {
		const search = new URLSearchParams({ from: capturedAt, limit: "100", to: capturedAt });
		if (cursor) {
			search.set("cursor", cursor);
		}
		const response = await fetch(
			`/api/history/${encodeURIComponent(site)}/changes?${search}`,
			options,
		);
		const page = await readJson<{ changes: HistoryChange[]; cursor?: string }>(response);
		changes.push(...page.changes);
		if (page.cursor && page.cursor === cursor) {
			throw new Error("History change pagination did not advance");
		}
		cursor = page.cursor;
	} while (cursor);
	return changes;
}

export async function fetchHistoryFailures(
	site: string,
	options?: RequestOptions,
): Promise<{ cursor?: string; failures: HistoryFailure[] }> {
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/failures?limit=100`,
		options,
	);
	return readJson(response);
}

export function historyScreenshotUrl(key: string): string {
	return `/api/screenshots/image?key=${encodeURIComponent(key)}`;
}

export async function searchHistory(
	input: {
		category?: string;
		query: string;
		site?: string;
	},
	options?: RequestOptions & { cursor?: string },
): Promise<HistorySearchPage> {
	const search = new URLSearchParams({ limit: "100", q: input.query });
	if (input.site) {
		search.set("site", input.site);
	}
	if (input.category) {
		search.set("category", input.category);
	}
	if (options?.cursor) {
		search.set("cursor", options.cursor);
	}
	const response = await fetch(
		`/api/history/search?${search}`,
		options?.signal ? { signal: options.signal } : undefined,
	);
	return readJson(response);
}

export async function fetchHistoryImages(
	site: string,
	month?: string,
	options?: RequestOptions & { cursor?: string },
): Promise<HistoryImagePage> {
	const search = new URLSearchParams({ limit: "100" });
	if (month) {
		search.set("month", month);
	}
	if (options?.cursor) {
		search.set("cursor", options.cursor);
	}
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/images?${search}`,
		options?.signal ? { signal: options.signal } : undefined,
	);
	return readJson(response);
}

export async function fetchHistoryTrends(
	site: string,
	period: string,
	mode: HistoryTrends["mode"],
	options?: RequestOptions,
): Promise<HistoryTrends> {
	const search = new URLSearchParams({ mode, period });
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/trends?${search}`,
		options,
	);
	return readJson(response);
}

export async function fetchElementHistory(
	site: string,
	elementKey: string,
	options?: RequestOptions & { cursor?: string },
): Promise<ElementHistory> {
	const search = new URLSearchParams({ limit: "100" });
	if (options?.cursor) {
		search.set("cursor", options.cursor);
	}
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/content/${encodeURIComponent(elementKey)}?${search}`,
		options?.signal ? { signal: options.signal } : undefined,
	);
	return readJson(response);
}

export async function fetchSavedTimelines(
	site: string,
	options?: RequestOptions,
): Promise<SavedTimelineSummary[]> {
	const response = await fetch(`/api/history/${encodeURIComponent(site)}/timelines`, options);
	return (await readJson<{ timelines: SavedTimelineSummary[] }>(response)).timelines;
}

export async function fetchSavedTimeline(
	site: string,
	slug: string,
	options?: RequestOptions,
): Promise<SavedTimeline> {
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/timelines/${encodeURIComponent(slug)}`,
		options,
	);
	return readJson(response);
}

export type HistoryAdminStatus = {
	resourceUsage: Array<{
		compressedExtractionBytes: number;
		d1WriteStatements: number;
		decompressedExtractionBytes: number;
		indexedCaptures: number;
		indexedChanges: number;
		indexedElements: number;
		indexedImages: number;
		indexedContent: number;
		measuredAt: string;
		site: string;
	}>;
	sites: Array<{
		captureCount: number;
		firstCaptureAt: string;
		lastCaptureAt: string;
		lastIndexedAt: string;
		site: string;
		contentCount: number;
	}>;
	totals: Record<"captures" | "changes" | "content" | "failures" | "observations", number>;
};

export type HistoryExtractionFailure = {
	captureId?: string;
	device?: "desktop" | "mobile";
	extractionKey?: string;
	failureId: number;
	failedAt: string;
	message: string;
	site?: string;
	stage: string;
};

export async function fetchHistoryAdminStatus(apiKey: string): Promise<HistoryAdminStatus> {
	const response = await fetch("/api/admin/history/status", {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export async function fetchHistoryExtractionFailures(
	apiKey: string,
	input: { cursor?: string; site?: string } = {},
): Promise<{ cursor?: string; failures: HistoryExtractionFailure[] }> {
	const search = new URLSearchParams({ limit: "50" });
	if (input.cursor) {
		search.set("cursor", input.cursor);
	}
	if (input.site) {
		search.set("site", input.site);
	}
	const response = await fetch(`/api/admin/history/extraction-failures?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export async function clearHistoryExtractionFailures(
	apiKey: string,
	site?: string,
): Promise<number> {
	const search = new URLSearchParams();
	if (site) {
		search.set("site", site);
	}
	const query = search.size > 0 ? `?${search}` : "";
	const response = await fetch(`/api/admin/history/extraction-failures${query}`, {
		headers: { authorization: `Bearer ${apiKey}` },
		method: "DELETE",
	});
	return (await readJson<{ cleared: number }>(response)).cleared;
}

export async function indexHistoryArchivePage(
	apiKey: string,
	input: {
		cursor?: string;
		from?: string;
		mode: "backfill" | "reindex";
		reset?: boolean;
		site?: string;
		to?: string;
	},
): Promise<{ cursor?: string; enqueued: number; hasMore: boolean; scanned: number }> {
	const response = await fetch(`/api/admin/history/${input.mode}`, {
		body: JSON.stringify({
			cursor: input.cursor,
			from: input.from,
			limit: 1_000,
			reset: input.reset,
			site: input.site,
			to: input.to,
		}),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	return readJson(response);
}

type AdminCredential = string;

function timelineAdminHeaders(credential: AdminCredential, json = false): Headers {
	const headers = new Headers();
	headers.set("authorization", ["Bearer", credential].join(" "));
	if (json) {
		headers.set("content-type", "application/json");
	}
	return headers;
}

export async function fetchAdminHistoryTimelines(
	credential: AdminCredential,
): Promise<SavedTimelineRecord[]> {
	const response = await fetch("/api/admin/history/timelines", {
		headers: timelineAdminHeaders(credential),
	});
	return (await readJson<{ timelines: SavedTimelineRecord[] }>(response)).timelines;
}

export async function createHistoryTimeline(
	credential: AdminCredential,
	input: { elementKeys: string[]; name: string; site: string },
): Promise<{ slug: string; timelineId: string }> {
	const response = await fetch("/api/admin/history/timelines", {
		body: JSON.stringify(input),
		headers: timelineAdminHeaders(credential, true),
		method: "POST",
	});
	return readJson(response);
}

export async function updateHistoryTimeline(
	credential: AdminCredential,
	timelineId: string,
	input: { elementKeys: string[]; name: string; site: string },
): Promise<void> {
	const response = await fetch(`/api/admin/history/timelines/${encodeURIComponent(timelineId)}`, {
		body: JSON.stringify(input),
		headers: timelineAdminHeaders(credential, true),
		method: "PUT",
	});
	await readJson(response);
}

export async function deleteHistoryTimeline(
	credential: AdminCredential,
	timelineId: string,
): Promise<void> {
	const response = await fetch(`/api/admin/history/timelines/${encodeURIComponent(timelineId)}`, {
		headers: timelineAdminHeaders(credential),
		method: "DELETE",
	});
	await readJson(response);
}

export async function materialiseHistoryAggregates(
	apiKey: string,
	input: { month: string; site: string },
): Promise<{ rows: number }> {
	const response = await fetch("/api/admin/history/aggregates", {
		body: JSON.stringify(input),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	return readJson(response);
}

export type ExtractorPreview = {
	capture: HistoryCapture["capture"];
	elements: HistoryCapture["elements"];
	expectedMinimum?: number;
	extractionKey: string;
	matchedElements: number;
	warnings: Array<{ code: string; message: string }>;
};

export type ExtractionSummary = {
	captureId: string;
	capturedAt: string;
	device: "desktop" | "mobile";
	extractionKey: string;
	extractorName: string;
	extractorVersion: number;
	matchedElements: number;
	site: string;
};

export async function fetchHistoryExtractions(
	apiKey: string,
	options: { limit: number; site?: string; sort: "newest" | "oldest" },
): Promise<ExtractionSummary[]> {
	const search = new URLSearchParams({
		limit: String(options.limit),
		sort: options.sort,
	});
	if (options.site) {
		search.set("site", options.site);
	}
	const response = await fetch(`/api/admin/history/extractions?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return (await readJson<{ extractions: ExtractionSummary[] }>(response)).extractions;
}

export async function fetchExtractorPreview(
	apiKey: string,
	key: string,
): Promise<ExtractorPreview> {
	const search = new URLSearchParams({ key });
	const response = await fetch(`/api/admin/history/extractor-preview?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
}

export async function downloadExtractorFixture(apiKey: string, key: string): Promise<void> {
	const search = new URLSearchParams({ download: "fixture", key });
	const response = await fetch(`/api/admin/history/extractor-preview?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	if (!response.ok) {
		await readJson(response);
	}
	const objectUrl = URL.createObjectURL(await response.blob());
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download =
		response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
		"extraction.expected.json";
	anchor.click();
	URL.revokeObjectURL(objectUrl);
}

export type ComparisonAnalysisRun = {
	attemptCount: number;
	captureId?: string;
	completedAt?: string;
	createdAt: string;
	errorCode?: string;
	errorMessage?: string;
	kind: string;
	model: string;
	runId: string;
	site?: string;
	status: string;
	storyId?: string;
	windowId?: string;
};

export type ComparisonFeedback = {
	evidenceId?: string;
	feedbackId: string;
	label: string;
	note?: string;
	reason: string;
	resolution?: string;
	reviewStatus: string;
	revisionId: string;
	storyId: string;
	submittedAt: string;
};

type ComparisonRunRecord = Record<string, number | string | null>;

function optionalRecordString(record: ComparisonRunRecord, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value ? value : undefined;
}

export async function fetchComparisonRuns(
	apiKey: string,
	status?: string,
): Promise<ComparisonAnalysisRun[]> {
	const search = new URLSearchParams({ limit: "100" });
	if (status) {
		search.set("status", status);
	}
	const response = await fetch(`/api/admin/comparison/runs?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	const records = (await readJson<{ runs: ComparisonRunRecord[] }>(response)).runs;

	return records.map((record) => ({
		attemptCount: Number(record.attempt_count ?? 0),
		captureId: optionalRecordString(record, "capture_id"),
		completedAt: optionalRecordString(record, "completed_at"),
		createdAt: String(record.created_at),
		errorCode: optionalRecordString(record, "error_code"),
		errorMessage: optionalRecordString(record, "error_message"),
		kind: String(record.kind),
		model: String(record.model),
		runId: String(record.run_id),
		site: optionalRecordString(record, "site"),
		status: String(record.status),
		storyId: optionalRecordString(record, "story_id"),
		windowId: optionalRecordString(record, "window_id"),
	}));
}

export async function fetchComparisonFeedback(
	apiKey: string,
	status: "dismissed" | "pending" | "resolved",
): Promise<ComparisonFeedback[]> {
	const search = new URLSearchParams({ limit: "100", status });
	const response = await fetch(`/api/admin/comparison/feedback?${search}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	const records = (await readJson<{ feedback: ComparisonRunRecord[] }>(response)).feedback;

	return records.map((record) => ({
		evidenceId: optionalRecordString(record, "evidence_id"),
		feedbackId: String(record.feedback_id),
		label: String(record.normalised_label),
		note: optionalRecordString(record, "note"),
		reason: String(record.reason),
		resolution: optionalRecordString(record, "resolution"),
		reviewStatus: String(record.review_status),
		revisionId: String(record.revision_id),
		storyId: String(record.story_id),
		submittedAt: String(record.submitted_at),
	}));
}

export async function requeueComparisonCaptures(
	apiKey: string,
	captureIds: string[],
): Promise<void> {
	const response = await fetch("/api/admin/comparison/requeue", {
		body: JSON.stringify({ captureIds }),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	await readJson(response);
}

export async function resolveComparisonFeedback(
	apiKey: string,
	feedbackId: string,
	input: { resolution: string; status: "dismissed" | "resolved" },
): Promise<void> {
	const response = await fetch(
		`/api/admin/comparison/feedback/${encodeURIComponent(feedbackId)}/resolve`,
		{
			body: JSON.stringify(input),
			headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
			method: "POST",
		},
	);
	await readJson(response);
}
