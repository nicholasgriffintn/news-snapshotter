import { decodeCursor, encodeCursor } from "../../../core/cursor.ts";
import { InvalidInputError } from "../../../core/errors.ts";
import {
	getCapture,
	getContentHistory,
	listAvailableHistorySites,
	listCaptures,
	listChanges,
	listHistorySites,
	type ChangeListOptions,
	type HistoryListOptions,
} from "../infrastructure/history-repository.ts";
import { listExtractionFailures } from "../infrastructure/history-admin-repository.ts";

const CHANGE_TYPES = new Set<string>([
	"appeared",
	"disappeared",
	"headline-changed",
	"summary-changed",
	"image-changed",
	"image-alt-changed",
	"section-changed",
	"category-changed",
	"rank-changed",
	"promoted",
	"demoted",
	"position-changed",
	"size-changed",
	"page-structure-changed",
	"capture-gap",
	"extractor-version-boundary",
]);
const MAX_PATH_IDENTIFIER_LENGTH = 4_096;

function jsonError(message: string, status: number): Response {
	return Response.json({ message, status: "error" }, { status });
}

function validDate(value: string | null, name: string): string | undefined {
	if (value === null) {
		return undefined;
	}

	if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new InvalidInputError(`${name} must be an ISO timestamp`);
	}

	return new Date(value).toISOString();
}

function limit(url: URL): number {
	const value = url.searchParams.get("limit");
	const parsed = value === null ? 50 : Number(value);

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}

	return parsed;
}

function captureListOptions(url: URL): HistoryListOptions {
	const cursorValue = url.searchParams.get("cursor");
	let cursor: HistoryListOptions["cursor"];

	if (cursorValue) {
		const decoded = decodeCursor(cursorValue);
		if (!decoded.capturedAt || !decoded.captureId) {
			throw new InvalidInputError("cursor is invalid");
		}
		cursor = { capturedAt: decoded.capturedAt, captureId: decoded.captureId };
	}

	return {
		cursor,
		from: validDate(url.searchParams.get("from"), "from"),
		limit: limit(url),
		to: validDate(url.searchParams.get("to"), "to"),
	};
}

function changeListOptions(url: URL): ChangeListOptions {
	const cursorValue = url.searchParams.get("cursor");
	const type = url.searchParams.get("type");

	if (type && !CHANGE_TYPES.has(type)) {
		throw new InvalidInputError("type is not a supported change type");
	}

	let cursor: ChangeListOptions["cursor"];

	if (cursorValue) {
		const decoded = decodeCursor(cursorValue);
		if (!decoded.capturedAt || !decoded.changeId) {
			throw new InvalidInputError("cursor is invalid");
		}
		cursor = { capturedAt: decoded.capturedAt, changeId: decoded.changeId };
	}

	return {
		cursor,
		from: validDate(url.searchParams.get("from"), "from"),
		limit: limit(url),
		to: validDate(url.searchParams.get("to"), "to"),
		type: type ?? undefined,
	};
}

function publicFailureOptions(url: URL) {
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

	return { cursor, limit: limit(url) };
}

function publicCapture(document: NonNullable<Awaited<ReturnType<typeof getCapture>>>) {
	const {
		htmlKey: _privateHtmlKey,
		profile: _privateProfile,
		sanitisationVersion: _privateVersion,
		...capture
	} = document.capture;

	return {
		capture,
		contentHash: document.contentHash,
		elements: document.elements,
		structureHash: document.structureHash,
		warningCount: document.warnings.length,
	};
}

export async function handleHistoryRequest(
	request: Request,
	database: D1Database,
): Promise<Response | null> {
	if (request.method !== "GET") {
		return null;
	}
	const url = new URL(request.url);

	if (url.pathname === "/api/history/sites") {
		return Response.json({ sites: await listHistorySites(database) });
	}
	if (url.pathname === "/api/history/sites/available") {
		return Response.json({ sites: await listAvailableHistorySites(database) });
	}

	const match = /^\/api\/history\/([^/]+)\/(captures|changes|content|failures)(?:\/([^/]+))?$/.exec(
		url.pathname,
	);

	if (!match) {
		return null;
	}

	const site = decodeURIComponent(match[1]);
	const resource = match[2];
	const identifier = match[3] ? decodeURIComponent(match[3]) : undefined;
	if (site.length === 0 || site.length > MAX_PATH_IDENTIFIER_LENGTH) {
		throw new InvalidInputError("site identifier is invalid");
	}
	if (identifier !== undefined && identifier.length > MAX_PATH_IDENTIFIER_LENGTH) {
		throw new InvalidInputError("resource identifier is invalid");
	}

	if (resource === "captures" && !identifier) {
		const result = await listCaptures(database, site, captureListOptions(url));
		return Response.json({
			captures: result.captures,
			cursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
		});
	}

	if (resource === "captures" && identifier) {
		const capture = await getCapture(database, site, identifier);
		return capture ? Response.json(publicCapture(capture)) : jsonError("Capture not found", 404);
	}

	if (resource === "content" && identifier) {
		const element = await getContentHistory(
			database,
			site,
			identifier,
			captureListOptions(url),
		);
		if (!element) {
			return jsonError("Content item not found", 404);
		}
		const { nextCursor, ...elementDetails } = element;
		return Response.json({
			...elementDetails,
			cursor: nextCursor ? encodeCursor(nextCursor) : undefined,
		});
	}

	if (resource === "changes" && !identifier) {
		const result = await listChanges(database, site, changeListOptions(url));

		return Response.json({
			changes: result.changes,
			cursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
		});
	}

	if (resource === "failures" && !identifier) {
		const result = await listExtractionFailures(database, {
			...publicFailureOptions(url),
			site,
		});

		return Response.json({
			cursor: result.nextCursor
				? encodeCursor({
						failedAt: result.nextCursor.failedAt,
						failureId: String(result.nextCursor.failureId),
					})
				: undefined,
			failures: result.failures.map((failure) => {
				return {
					captureId: failure.captureId,
					device: failure.device,
					failedAt: failure.failedAt,
					stage: failure.stage,
				};
			}),
		});
	}

	return jsonError("Not found", 404);
}
