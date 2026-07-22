import { decodeCursor, encodeCursor } from "../../../core/cursor.ts";
import { InvalidInputError } from "../../../core/errors.ts";
import {
	getSavedTimeline,
	listHistoryImages,
	listSavedTimelines,
	searchHistory,
	type ResearchCursor,
	type SearchCursor,
} from "../infrastructure/history-research-repository.ts";
import { historyTrends } from "../infrastructure/history-trend-repository.ts";

function limit(url: URL): number {
	const value = url.searchParams.get("limit");
	const parsed = value === null ? 50 : Number(value);

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
		throw new InvalidInputError("limit must be between 1 and 100");
	}

	return parsed;
}

function timestamp(url: URL, name: string): string | undefined {
	const value = url.searchParams.get(name);

	if (value === null) {
		return undefined;
	}

	if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new InvalidInputError(`${name} must be an ISO timestamp`);
	}

	return new Date(value).toISOString();
}

function cursor(url: URL): ResearchCursor | undefined {
	const value = url.searchParams.get("cursor");

	if (!value) {
		return undefined;
	}

	const decoded = decodeCursor(value);

	if (!decoded.capturedAt || !decoded.id) {
		throw new InvalidInputError("cursor is invalid");
	}

	return { capturedAt: decoded.capturedAt, id: decoded.id };
}

function encodedCursor(value: ResearchCursor | undefined): string | undefined {
	return value ? encodeCursor(value) : undefined;
}

function searchCursor(url: URL): SearchCursor | undefined {
	const value = url.searchParams.get("cursor");
	if (!value) {
		return undefined;
	}
	const decoded = decodeCursor(value);
	const required = ["capturedAt", "id", "prominence", "rank", "relevance", "site"] as const;
	if (!required.every((key) => decoded[key])) {
		throw new InvalidInputError("cursor is invalid");
	}
	if (
		!Number.isFinite(Number(decoded.prominence)) ||
		!Number.isFinite(Number(decoded.rank)) ||
		!Number.isFinite(Number(decoded.relevance))
	) {
		throw new InvalidInputError("cursor is invalid");
	}
	return {
		capturedAt: decoded.capturedAt,
		id: decoded.id,
		prominence: decoded.prominence,
		rank: decoded.rank,
		relevance: decoded.relevance,
		site: decoded.site,
	};
}

type TrendPeriod = "24h" | "7d" | "30d" | "90d" | "all";
type TrendMode = "category" | "main-headline-words" | "all-headline-words";

function isTrendPeriod(value: string): value is TrendPeriod {
	return ["24h", "7d", "30d", "90d", "all"].includes(value);
}

function isTrendMode(value: string): value is TrendMode {
	return ["category", "main-headline-words", "all-headline-words"].includes(value);
}

export async function handleHistoryResearchRequest(
	request: Request,
	database: D1Database,
): Promise<Response | null> {
	if (request.method !== "GET") {
		return null;
	}
	const url = new URL(request.url);

	if (url.pathname === "/api/history/search") {
		const query = url.searchParams.get("q")?.trim();
		if (!query || query.length > 200) {
			throw new InvalidInputError("q must be between 1 and 200 characters");
		}
		const result = await searchHistory(database, {
			category: url.searchParams.get("category") ?? undefined,
			cursor: searchCursor(url),
			from: timestamp(url, "from"),
			limit: limit(url),
			query,
			site: url.searchParams.get("site") ?? undefined,
			to: timestamp(url, "to"),
		});
		return Response.json({ cursor: encodedCursor(result.nextCursor), results: result.results });
	}

	const siteTimelineMatch = /^\/api\/history\/([^/]+)\/timelines(?:\/([^/]+))?$/.exec(url.pathname);
	if (siteTimelineMatch) {
		const site = decodeURIComponent(siteTimelineMatch[1]);
		const slug = siteTimelineMatch[2] ? decodeURIComponent(siteTimelineMatch[2]) : undefined;
		if (!site || site.length > 200 || (slug !== undefined && (!slug || slug.length > 100))) {
			throw new InvalidInputError("Timeline path is invalid");
		}
		if (!slug) {
			const timelines = (await listSavedTimelines(database, site)).map(
				({ elementKeys: _elementKeys, ...timeline }) => timeline,
			);
			return Response.json({ timelines });
		}
		const timeline = await getSavedTimeline(database, slug);
		return timeline && timeline.site === site
			? Response.json(timeline)
			: Response.json({ message: "Timeline not found", status: "error" }, { status: 404 });
	}

	const timelineMatch = /^\/api\/history\/timelines\/([^/]+)$/.exec(url.pathname);
	if (timelineMatch) {
		const slug = decodeURIComponent(timelineMatch[1]);
		if (!slug || slug.length > 100) {
			throw new InvalidInputError("Timeline slug is invalid");
		}
		const timeline = await getSavedTimeline(database, slug);
		return timeline
			? Response.json(timeline)
			: Response.json({ message: "Timeline not found", status: "error" }, { status: 404 });
	}

	const match = /^\/api\/history\/([^/]+)\/(images|trends)$/.exec(url.pathname);
	if (!match) {
		return null;
	}
	const site = decodeURIComponent(match[1]);
	if (match[2] === "images") {
		const month = url.searchParams.get("month") ?? undefined;
		if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
			throw new InvalidInputError("month must use YYYY-MM");
		}
		const result = await listHistoryImages(database, site, month, {
			cursor: cursor(url),
			limit: limit(url),
		});
		return Response.json({ cursor: encodedCursor(result.nextCursor), images: result.images });
	}

	const period = url.searchParams.get("period") ?? "30d";
	const mode = url.searchParams.get("mode") ?? "category";
	if (!isTrendPeriod(period)) {
		throw new InvalidInputError("period is invalid");
	}
	if (!isTrendMode(mode)) {
		throw new InvalidInputError("mode is invalid");
	}
	return Response.json(await historyTrends(database, site, period, mode));
}
