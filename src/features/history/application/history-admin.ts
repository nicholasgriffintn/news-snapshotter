import { decodeCursor, encodeCursor } from "../../../core/cursor.ts";
import { InvalidInputError } from "../../../core/errors.ts";
import type { HistoryIndexMessage } from "./index-extraction.ts";
import {
	historyIndexStatus,
	type ExtractionListOptions,
	listIndexedExtractions,
	listExtractionFailures,
	resetHistoryIndex,
} from "../infrastructure/history-admin-repository.ts";
import { createSavedTimeline } from "../infrastructure/history-research-repository.ts";
import { materialiseHistoryMonth } from "../infrastructure/history-trend-repository.ts";
import { parsePageExtraction } from "../domain/extraction.ts";
import { SITES } from "../../catalogue/domain/sites.ts";

type HistoryAdminEnv = {
	ARCHIVE_DATA: R2Bucket;
	HISTORY_DB: D1Database;
	HISTORY_INDEX_QUEUE: Queue<HistoryIndexMessage>;
};

type ArchiveIndexOptions = {
	cursor?: string;
	from?: string;
	limit: number;
	reset: boolean;
	site?: string;
	to?: string;
};

function optionalString(
	record: Record<string, unknown>,
	key: string,
	maximumLength: number,
): string | undefined {
	const value = record[key];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) {
		throw new InvalidInputError(`${key} is invalid`);
	}
	return value;
}

function timestamp(value: string | undefined, name: string): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new InvalidInputError(`${name} must be an ISO timestamp`);
	}

	return new Date(value).toISOString();
}

async function requestOptions(request: Request, allowReset: boolean): Promise<ArchiveIndexOptions> {
	let body: unknown = {};

	if (request.headers.get("content-type")?.includes("application/json")) {
		body = await request.json();
	}

	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new InvalidInputError("History indexing request must be an object");
	}

	const record = body as Record<string, unknown>;
	const limit = record.limit === undefined ? 250 : Number(record.limit);

	if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
		throw new InvalidInputError("limit must be between 1 and 1000");
	}

	const reset = allowReset && record.reset === true;
	const cursor = optionalString(record, "cursor", 2_048);

	if (reset && cursor) {
		throw new InvalidInputError("reset is only valid on the first reindex page");
	}

	return {
		cursor,
		from: timestamp(optionalString(record, "from", 64), "from"),
		limit,
		reset,
		site: optionalString(record, "site", 200),
		to: timestamp(optionalString(record, "to", 64), "to"),
	};
}

function isSelected(object: R2Object, options: ArchiveIndexOptions): boolean {
	const metadata = object.customMetadata;

	if (options.site) {
		const keySite = object.key.includes(`/site=${options.site}/`);
		if (metadata?.site !== options.site && !keySite) {
			return false;
		}
	}

	const capturedAt = metadata?.capturedAt ?? metadata?.triggeredAt;

	if (capturedAt && options.from && capturedAt < options.from) {
		return false;
	}

	if (capturedAt && options.to && capturedAt > options.to) {
		return false;
	}

	return true;
}

function messageForObject(object: R2Object): HistoryIndexMessage | undefined {
	if (/\.extraction\.v\d+\.json\.gz$/.test(object.key)) {
		return { extractionKey: object.key, kind: "extraction" };
	}

	if (object.key.endsWith(".analysis-failure.json")) {
		return { failureKey: object.key, kind: "failure" };
	}

	return undefined;
}

async function sendMessages(
	queue: Queue<HistoryIndexMessage>,
	messages: HistoryIndexMessage[],
): Promise<void> {
	for (let index = 0; index < messages.length; index += 100) {
		await queue.sendBatch(
			messages.slice(index, index + 100).map((body) => {
				return { body };
			}),
		);
	}
}

function extractionKey(url: URL): string {
	const key = url.searchParams.get("key");

	if (
		!key ||
		key.length > 2_048 ||
		key.startsWith("/") ||
		key.includes("..") ||
		!/\.extraction\.v\d+\.json\.gz$/.test(key)
	) {
		throw new InvalidInputError("A valid extraction artefact key is required");
	}

	return key;
}

async function readExtraction(bucket: R2Bucket, key: string) {
	const object = await bucket.get(key);

	if (!object) {
		return undefined;
	}

	const stream =
		object.httpMetadata?.contentEncoding === "gzip"
			? object.body.pipeThrough(new DecompressionStream("gzip"))
			: object.body;

	return parsePageExtraction(await new Response(stream).json());
}

async function extractorPreview(env: HistoryAdminEnv, url: URL): Promise<Response> {
	const key = extractionKey(url);
	const extraction = await readExtraction(env.ARCHIVE_DATA, key);

	if (!extraction) {
		return Response.json(
			{ message: "Extraction artefact not found", status: "error" },
			{ status: 404 },
		);
	}

	const site = SITES.find(({ name }) => name === extraction.capture.site);

	const body = {
		capture: extraction.capture,
		expectedMinimum: site?.analysis?.minimumElements,
		extractionKey: key,
		matchedElements: extraction.elements.length,
		elements: extraction.elements,
		warnings: extraction.warnings,
	};

	if (url.searchParams.get("download") === "fixture") {
		return Response.json(body, {
			headers: {
				"content-disposition": `attachment; filename="${extraction.capture.site}.expected.json"`,
				"x-content-type-options": "nosniff",
			},
		});
	}

	return Response.json(body);
}

async function enqueueArchivePage(
	env: HistoryAdminEnv,
	options: ArchiveIndexOptions,
): Promise<Record<string, unknown>> {
	if (options.reset) {
		await resetHistoryIndex(env.HISTORY_DB, options.site);
	}

	const page = await env.ARCHIVE_DATA.list({
		cursor: options.cursor,
		include: ["customMetadata"],
		limit: options.limit,
	});

	const messages = page.objects
		.filter((object) => isSelected(object, options))
		.flatMap((object) => {
			const message = messageForObject(object);
			return message ? [message] : [];
		});
	await sendMessages(env.HISTORY_INDEX_QUEUE, messages);

	return {
		cursor: page.truncated ? page.cursor : undefined,
		enqueued: messages.length,
		hasMore: page.truncated,
		reset: options.reset,
		scanned: page.objects.length,
	};
}

function failureOptions(url: URL) {
	const limitValue = url.searchParams.get("limit");
	const limit = limitValue === null ? 50 : Number(limitValue);

	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}

	const cursorValue = url.searchParams.get("cursor");
	let cursor: { failedAt: string; failureId: number } | undefined;

	if (cursorValue) {
		const decoded = decodeCursor(cursorValue);
		const failureId = Number(decoded.failureId);
		if (!decoded.failedAt || !Number.isInteger(failureId)) {
			throw new InvalidInputError("cursor is invalid");
		}
		cursor = { failedAt: decoded.failedAt, failureId };
	}

	return { cursor, limit, site: url.searchParams.get("site") ?? undefined };
}

function extractionListOptions(url: URL): ExtractionListOptions {
	const limitValue = url.searchParams.get("limit");
	const limit = limitValue === null ? 25 : Number(limitValue);

	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}

	const sortValue = url.searchParams.get("sort") ?? "newest";

	if (sortValue !== "newest" && sortValue !== "oldest") {
		throw new InvalidInputError("sort must be newest or oldest");
	}

	const sort = sortValue === "oldest" ? "oldest" : "newest";
	const siteValue = url.searchParams.get("site")?.trim();

	if (siteValue && siteValue.length > 200) {
		throw new InvalidInputError("site is invalid");
	}

	return { limit, site: siteValue || undefined, sort };
}

export async function handleHistoryAdminRequest(
	request: Request,
	env: HistoryAdminEnv,
): Promise<Response | null> {
	const url = new URL(request.url);

	if (request.method === "GET" && url.pathname === "/api/admin/history/status") {
		return Response.json(await historyIndexStatus(env.HISTORY_DB));
	}

	if (request.method === "GET" && url.pathname === "/api/admin/history/extractions") {
		return Response.json({
			extractions: await listIndexedExtractions(env.HISTORY_DB, extractionListOptions(url)),
		});
	}

	if (request.method === "GET" && url.pathname === "/api/admin/history/extractor-preview") {
		return extractorPreview(env, url);
	}

	if (request.method === "GET" && url.pathname === "/api/admin/history/extraction-failures") {
		const result = await listExtractionFailures(env.HISTORY_DB, failureOptions(url));
		return Response.json({
			failures: result.failures,
			cursor: result.nextCursor
				? encodeCursor({
						failedAt: result.nextCursor.failedAt,
						failureId: String(result.nextCursor.failureId),
					})
				: undefined,
		});
	}

	if (request.method === "POST" && url.pathname === "/api/admin/history/reindex") {
		return Response.json(await enqueueArchivePage(env, await requestOptions(request, true)), {
			status: 202,
		});
	}

	if (request.method === "POST" && url.pathname === "/api/admin/history/backfill") {
		return Response.json(await enqueueArchivePage(env, await requestOptions(request, false)), {
			status: 202,
		});
	}

	if (request.method === "POST" && url.pathname === "/api/admin/history/timelines") {
		const body: unknown = await request.json();

		if (!body || typeof body !== "object" || Array.isArray(body)) {
			throw new InvalidInputError("Timeline request must be an object");
		}

		const record = body as Record<string, unknown>;
		const elementKeys = Array.isArray(record.elementKeys)
			? record.elementKeys.filter((key): key is string => typeof key === "string")
			: [];

		if (
			typeof record.name !== "string" ||
			record.name.trim().length === 0 ||
			record.name.length > 120 ||
			typeof record.site !== "string" ||
			record.site.length === 0 ||
			record.site.length > 200 ||
			!Array.isArray(record.elementKeys) ||
			elementKeys.length !== record.elementKeys.length ||
			elementKeys.length < 2 ||
			elementKeys.length > 10 ||
			elementKeys.some((key) => key.length > 4_096) ||
			new Set(elementKeys).size !== elementKeys.length
		) {
			throw new InvalidInputError(
				"Timeline requires a name, site, and 2 to 10 unique content keys",
			);
		}

		return Response.json(
			await createSavedTimeline(env.HISTORY_DB, {
				name: record.name.trim(),
				site: record.site,
				elementKeys,
			}),
			{ status: 201 },
		);
	}

	if (request.method === "POST" && url.pathname === "/api/admin/history/aggregates") {
		const body: unknown = await request.json();

		if (!body || typeof body !== "object" || Array.isArray(body)) {
			throw new InvalidInputError("Aggregate request must be an object");
		}

		const record = body as Record<string, unknown>;

		if (
			typeof record.site !== "string" ||
			record.site.length === 0 ||
			record.site.length > 200 ||
			typeof record.month !== "string"
		) {
			throw new InvalidInputError("Aggregate request requires a site and month");
		}
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month)) {
			throw new InvalidInputError("month must use YYYY-MM");
		}

		return Response.json(await materialiseHistoryMonth(env.HISTORY_DB, record.site, record.month), {
			status: 201,
		});
	}
	return null;
}
