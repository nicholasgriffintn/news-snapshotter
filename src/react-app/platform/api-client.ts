import type {
	CaptureFailure,
	CaptureProviderName,
	CatalogueSite,
	ElementHistory,
	HistoryCapture,
	HistoryCaptureSummary,
	HistoryChange,
	HistoryFailure,
	HistoryImageObservation,
	HistorySearchResult,
	HistorySite,
	HistoryTrends,
	SavedTimeline,
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

export async function fetchSnapshots(options?: RequestOptions): Promise<Snapshot[]> {
	const response = await fetch("/api/screenshots", options);
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
	const search = new URLSearchParams({ from: capturedAt, limit: "100", to: capturedAt });
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/changes?${search}`,
		options,
	);
	return (await readJson<{ changes: HistoryChange[] }>(response)).changes;
}

export async function fetchHistoryFailures(
	site: string,
	options?: RequestOptions,
): Promise<HistoryFailure[]> {
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/failures?limit=100`,
		options,
	);
	return (await readJson<{ failures: HistoryFailure[] }>(response)).failures;
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
	options?: RequestOptions,
): Promise<HistorySearchResult[]> {
	const search = new URLSearchParams({ limit: "100", q: input.query });
	if (input.site) {
		search.set("site", input.site);
	}
	if (input.category) {
		search.set("category", input.category);
	}
	const response = await fetch(`/api/history/search?${search}`, options);
	return (await readJson<{ results: HistorySearchResult[] }>(response)).results;
}

export async function fetchHistoryImages(
	site: string,
	month?: string,
	options?: RequestOptions,
): Promise<HistoryImageObservation[]> {
	const search = new URLSearchParams({ limit: "100" });
	if (month) {
		search.set("month", month);
	}
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/images?${search}`,
		options,
	);
	return (await readJson<{ images: HistoryImageObservation[] }>(response)).images;
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
	options?: RequestOptions,
): Promise<ElementHistory> {
	const response = await fetch(
		`/api/history/${encodeURIComponent(site)}/content/${encodeURIComponent(elementKey)}?limit=100`,
		options,
	);
	return readJson(response);
}

export async function fetchSavedTimeline(
	slug: string,
	options?: RequestOptions,
): Promise<SavedTimeline> {
	const response = await fetch(`/api/history/timelines/${encodeURIComponent(slug)}`, options);
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

export async function fetchHistoryAdminStatus(apiKey: string): Promise<HistoryAdminStatus> {
	const response = await fetch("/api/admin/history/status", {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	return readJson(response);
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

export async function createHistoryTimeline(
	apiKey: string,
	input: { elementKeys: string[]; name: string; site: string },
): Promise<{ slug: string; timelineId: string }> {
	const response = await fetch("/api/admin/history/timelines", {
		body: JSON.stringify(input),
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		method: "POST",
	});
	return readJson(response);
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
