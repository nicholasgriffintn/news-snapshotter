import type { PageExtraction } from "../domain/extraction.ts";
import { loadCaptureExtraction } from "./history-capture-store.ts";

export type CaptureCursor = {
	capturedAt: string;
	captureId: string;
};

export type HistoryListOptions = {
	cursor?: CaptureCursor;
	from?: string;
	limit: number;
	to?: string;
};

export type ChangeListOptions = Omit<HistoryListOptions, "cursor"> & {
	cursor?: {
		capturedAt: string;
		changeId: string;
	};
	type?: string;
};

export async function listCaptures(
	database: D1Database,
	site: string,
	options: HistoryListOptions,
): Promise<{ captures: Record<string, unknown>[]; nextCursor?: CaptureCursor }> {
	const conditions = ["site = ?"];
	const parameters: Array<number | string> = [site];
	if (options.from) {
		conditions.push("captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.cursor) {
		conditions.push("(captured_at < ? OR (captured_at = ? AND capture_id < ?))");
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.captureId);
	}
	parameters.push(options.limit + 1);

	const result = await database
		.prepare(
			`SELECT
				capture_id AS captureId, captured_at AS capturedAt, triggered_at AS triggeredAt,
				device, source_url AS sourceUrl, screenshot_key AS screenshotKey,
				page_width AS pageWidth, page_height AS pageHeight,
				extractor_name AS extractorName, extractor_version AS extractorVersion,
				schema_version AS schemaVersion, content_hash AS contentHash,
				structure_hash AS structureHash
			FROM indexed_desktop_captures
			WHERE ${conditions.join(" AND ")}
			ORDER BY captured_at DESC, capture_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const captures = result.results.slice(0, options.limit);
	const last = captures.at(-1);
	const nextCursor =
		hasMore && last
			? { capturedAt: String(last.capturedAt), captureId: String(last.captureId) }
			: undefined;
	return { captures, nextCursor };
}

export async function listHistorySites(database: D1Database): Promise<Record<string, unknown>[]> {
	const result = await database
		.prepare(
			`SELECT
				analysed_captures.site,
				analysed_captures.device,
				COUNT(DISTINCT analysed_captures.capture_id) AS captureCount,
				MIN(analysed_captures.captured_at) AS firstCaptureAt,
				MAX(analysed_captures.captured_at) AS lastCaptureAt,
				MAX(analysed_captures.source_url) AS sourceUrl,
				COUNT(DISTINCT page_elements.element_key) AS contentCount
			FROM indexed_desktop_captures AS analysed_captures
			LEFT JOIN page_elements
				ON page_elements.capture_id = analysed_captures.capture_id
			GROUP BY analysed_captures.site, analysed_captures.device
			ORDER BY analysed_captures.site, analysed_captures.device`,
		)
		.all<Record<string, unknown>>();
	return result.results;
}

export async function listAvailableHistorySites(database: D1Database): Promise<string[]> {
	const result = await database
		.prepare("SELECT DISTINCT site FROM indexed_desktop_captures ORDER BY site")
		.all<{ site: string }>();
	return result.results.map(({ site }) => site);
}

export async function getCapture(
	database: D1Database,
	site: string,
	captureId: string,
): Promise<PageExtraction | null> {
	const visible = await database
		.prepare("SELECT 1 AS visible FROM indexed_desktop_captures WHERE site = ? AND capture_id = ?")
		.bind(site, captureId)
		.first<{ visible: number }>();
	if (!visible) {
		return null;
	}
	const extraction = await loadCaptureExtraction(database, captureId);
	return extraction;
}

export async function getContentHistory(
	database: D1Database,
	site: string,
	elementKey: string,
	options: HistoryListOptions,
): Promise<(Record<string, unknown> & { nextCursor?: CaptureCursor }) | null> {
	const element = await database
		.prepare(
			`SELECT
				page_elements.element_key AS elementKey,
				page_elements.kind,
				page_elements.canonical_url AS canonicalUrl
			FROM page_elements
			JOIN indexed_desktop_captures AS analysed_captures
				ON analysed_captures.capture_id = page_elements.capture_id
			WHERE analysed_captures.site = ?
				AND page_elements.element_key = ?
			ORDER BY
				analysed_captures.captured_at DESC,
				page_elements.capture_id DESC,
				CASE page_elements.prominence
					WHEN 'lead' THEN 4 WHEN 'major' THEN 3 WHEN 'standard' THEN 2 ELSE 1
				END DESC,
				page_elements.rank
			LIMIT 1`,
		)
		.bind(site, elementKey)
		.first<Record<string, unknown>>();
	if (!element) {
		return null;
	}

	const conditions = ["analysed_captures.site = ?", "page_elements.element_key = ?"];
	const parameters: Array<number | string> = [site, elementKey];
	if (options.from) {
		conditions.push("analysed_captures.captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("analysed_captures.captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.cursor) {
		conditions.push(
			"(analysed_captures.captured_at < ? OR (analysed_captures.captured_at = ? AND page_elements.capture_id < ?))",
		);
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.captureId);
	}
	parameters.push(options.limit + 1);

	const result = await database
		.prepare(
			`WITH ranked_observations AS (
				SELECT
					page_elements.capture_id AS captureId,
					analysed_captures.captured_at AS capturedAt,
					page_elements.headline,
					page_elements.summary,
					page_elements.image_source_url AS imageSourceUrl,
					page_elements.image_alt AS imageAlt,
					page_elements.image_crop_key AS imageCropKey,
					page_elements.category,
					page_elements.section,
					page_elements.prominence,
					page_elements.rank,
					page_elements.top,
					page_elements.left_position AS left,
					page_elements.width,
					page_elements.height,
					page_elements.viewport_depth AS viewportDepth,
					ROW_NUMBER() OVER (
						PARTITION BY page_elements.capture_id
						ORDER BY
							CASE page_elements.prominence
								WHEN 'lead' THEN 4 WHEN 'major' THEN 3
								WHEN 'standard' THEN 2 ELSE 1
							END DESC,
							page_elements.rank
					) AS placementRank
				FROM page_elements
				JOIN indexed_desktop_captures AS analysed_captures
					ON analysed_captures.capture_id = page_elements.capture_id
				WHERE ${conditions.join(" AND ")}
			)
			SELECT * FROM ranked_observations
			WHERE placementRank = 1
			ORDER BY capturedAt DESC, captureId DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const page = result.results.slice(0, options.limit);
	const last = page.at(-1);
	const observations = page.reverse().map(({ placementRank: _placementRank, ...observation }) => {
		return observation;
	});

	return {
		...element,
		nextCursor:
			hasMore && last
				? { capturedAt: String(last.capturedAt), captureId: String(last.captureId) }
				: undefined,
		observations,
	};
}

export async function listChanges(
	database: D1Database,
	site: string,
	options: ChangeListOptions,
): Promise<{
	changes: Record<string, unknown>[];
	nextCursor?: { capturedAt: string; changeId: string };
}> {
	const conditions = ["change_events.site = ?"];
	const parameters: Array<number | string> = [site];
	if (options.from) {
		conditions.push("analysed_captures.captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("analysed_captures.captured_at <= ?");
		parameters.push(options.to);
	}
	if (options.type) {
		conditions.push("change_events.change_type = ?");
		parameters.push(options.type);
	}
	if (options.cursor) {
		conditions.push(
			"(analysed_captures.captured_at < ? OR (analysed_captures.captured_at = ? AND change_events.change_id < ?))",
		);
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.changeId);
	}
	parameters.push(options.limit + 1);

	const result = await database
		.prepare(
			`SELECT
				change_id AS changeId, previous_capture_id AS previousCaptureId,
				current_capture_id AS currentCaptureId,
				element_key AS elementKey, placement_key AS placementKey,
				change_type AS type, before_value AS beforeValue,
				after_value AS afterValue, magnitude,
				change_events.extractor_name AS extractorName,
				change_events.extractor_version AS extractorVersion,
				change_events.schema_version AS schemaVersion,
				analysed_captures.captured_at AS capturedAt
			FROM change_events
			JOIN indexed_desktop_captures AS analysed_captures
				ON analysed_captures.capture_id = change_events.current_capture_id
			WHERE ${conditions.join(" AND ")}
			ORDER BY analysed_captures.captured_at DESC, change_events.change_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const rows = result.results.slice(0, options.limit);
	const changes = rows.map((row) => {
		const { afterValue, beforeValue, ...details } = row;
		return {
			...details,
			after: JSON.parse(String(afterValue)),
			before: JSON.parse(String(beforeValue)),
		};
	});
	return {
		changes,
		nextCursor:
			hasMore && rows.at(-1)
				? {
						capturedAt: String(rows.at(-1)?.capturedAt),
						changeId: String(rows.at(-1)?.changeId),
					}
				: undefined,
	};
}
