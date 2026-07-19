import { historySearchQuery } from "../domain/search-query.ts";

export type ResearchCursor = {
	capturedAt: string;
	id: string;
};

export type ResearchListOptions = {
	cursor?: ResearchCursor;
	from?: string;
	limit: number;
	to?: string;
};

export type SearchCursor = {
	capturedAt: string;
	id: string;
	prominence: string;
	rank: string;
	relevance: string;
	site: string;
};

export type SearchOptions = Omit<ResearchListOptions, "cursor"> & {
	category?: string;
	cursor?: SearchCursor;
	query: string;
	site?: string;
};

export async function searchHistory(
	database: D1Database,
	options: SearchOptions,
): Promise<{ nextCursor?: SearchCursor; results: Record<string, unknown>[] }> {
	const conditions = ["content_observation_search MATCH ?"];
	const parameters: Array<number | string> = [historySearchQuery(options.query)];
	if (options.site) {
		conditions.push("content_observation_search.site = ?");
		parameters.push(options.site);
	}
	if (options.category) {
		conditions.push("page_elements.category = ?");
		parameters.push(options.category);
	}
	if (options.from) {
		conditions.push("analysed_captures.captured_at >= ?");
		parameters.push(options.from);
	}
	if (options.to) {
		conditions.push("analysed_captures.captured_at <= ?");
		parameters.push(options.to);
	}
	const cursorCondition = options.cursor
		? `AND (
			(prominenceScore < ?)
			OR (prominenceScore = ? AND relevance > ?)
			OR (prominenceScore = ? AND relevance = ? AND rank > ?)
			OR (prominenceScore = ? AND relevance = ? AND rank = ? AND capturedAt < ?)
			OR (prominenceScore = ? AND relevance = ? AND rank = ? AND capturedAt = ? AND site > ?)
			OR (prominenceScore = ? AND relevance = ? AND rank = ? AND capturedAt = ? AND site = ? AND elementKey > ?)
		)`
		: "";
	if (options.cursor) {
		const relevance = Number(options.cursor.relevance);
		const prominence = Number(options.cursor.prominence);
		const rank = Number(options.cursor.rank);
		parameters.push(
			prominence,
			prominence,
			relevance,
			prominence,
			relevance,
			rank,
			prominence,
			relevance,
			rank,
			options.cursor.capturedAt,
			prominence,
			relevance,
			rank,
			options.cursor.capturedAt,
			options.cursor.site,
			prominence,
			relevance,
			rank,
			options.cursor.capturedAt,
			options.cursor.site,
			options.cursor.id,
		);
	}
	parameters.push(options.limit + 1);
	const result = await database
		.prepare(
			`WITH matching_observations AS (
				SELECT
				content_observation_search.element_key AS elementKey,
				content_observation_search.capture_id AS captureId,
				content_observation_search.site,
				analysed_captures.captured_at AS capturedAt,
				page_elements.canonical_url AS canonicalUrl,
				page_elements.kind,
				page_elements.headline,
				page_elements.summary,
				page_elements.category,
				page_elements.section,
				page_elements.image_alt AS imageAlt,
				page_elements.image_crop_key AS imageCropKey,
				page_elements.image_source_url AS imageSourceUrl,
				page_elements.prominence,
				page_elements.rank,
				CASE page_elements.prominence
					WHEN 'lead' THEN 4 WHEN 'major' THEN 3 WHEN 'standard' THEN 2 ELSE 1
				END AS prominenceScore,
				bm25(content_observation_search, 0, 0, 0, 0, 10, 4, 2, 1) AS relevance
				FROM content_observation_search
				JOIN indexed_desktop_captures AS analysed_captures
					ON analysed_captures.capture_id = content_observation_search.capture_id
				JOIN page_elements
					ON page_elements.capture_id = content_observation_search.capture_id
					AND page_elements.placement_key = content_observation_search.placement_key
				WHERE ${conditions.join(" AND ")}
			), latest_matches AS (
				SELECT *, ROW_NUMBER() OVER (
					PARTITION BY site, elementKey
					ORDER BY capturedAt DESC, captureId DESC, prominenceScore DESC, rank
				) AS observationRank
				FROM matching_observations
			)
			SELECT * FROM latest_matches
			WHERE observationRank = 1
			${cursorCondition}
			ORDER BY prominenceScore DESC, relevance, rank, capturedAt DESC, site, elementKey
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const rows = result.results.slice(0, options.limit);
	const last = rows.at(-1);
	const results = rows.map(
		({ observationRank: _rank, prominenceScore: _score, relevance: _relevance, ...row }) => row,
	);
	return {
		nextCursor:
			hasMore && last
				? {
						capturedAt: String(last.capturedAt),
						id: String(last.elementKey),
						prominence: String(last.prominenceScore),
						rank: String(last.rank),
						relevance: String(last.relevance),
						site: String(last.site),
					}
				: undefined,
		results,
	};
}

export async function listHistoryImages(
	database: D1Database,
	site: string,
	month: string | undefined,
	options: ResearchListOptions,
): Promise<{ images: Record<string, unknown>[]; nextCursor?: ResearchCursor }> {
	const conditions = ["analysed_captures.site = ?", "page_elements.image_id IS NOT NULL"];
	const parameters: Array<number | string> = [site];
	if (month) {
		const from = new Date(`${month}-01T00:00:00.000Z`);
		const to = new Date(from);
		to.setUTCMonth(to.getUTCMonth() + 1);
		conditions.push("analysed_captures.captured_at >= ?", "analysed_captures.captured_at < ?");
		parameters.push(from.toISOString(), to.toISOString());
	}
	const cursorCondition = options.cursor
		? "AND (capturedAt < ? OR (capturedAt = ? AND imageId < ?))"
		: "";
	if (options.cursor) {
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.id);
	}
	parameters.push(options.limit + 1);
	const result = await database
		.prepare(
			`WITH ranked_images AS (
				SELECT
					page_elements.image_id AS imageId,
					page_elements.image_source_url AS sourceUrl,
					page_elements.image_crop_key AS cropKey,
					page_elements.image_alt AS alt,
					page_elements.element_key AS elementKey,
					page_elements.kind,
					page_elements.headline,
					page_elements.capture_id AS captureId,
					analysed_captures.captured_at AS capturedAt,
					analysed_captures.source_url AS publisherUrl,
					ROW_NUMBER() OVER (
						PARTITION BY page_elements.image_id
						ORDER BY analysed_captures.captured_at DESC,
							page_elements.capture_id DESC,
							page_elements.element_key DESC
					) AS imageRank
				FROM page_elements
				JOIN indexed_desktop_captures AS analysed_captures
					ON analysed_captures.capture_id = page_elements.capture_id
				WHERE ${conditions.join(" AND ")}
			)
			SELECT
				imageId, sourceUrl, cropKey, alt, elementKey, kind, headline,
				captureId, capturedAt, publisherUrl
			FROM ranked_images
			WHERE imageRank = 1 ${cursorCondition}
			ORDER BY capturedAt DESC, imageId DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const images = result.results.slice(0, options.limit);
	const last = images.at(-1);
	return {
		images,
		nextCursor:
			hasMore && last
				? { capturedAt: String(last.capturedAt), id: String(last.imageId) }
				: undefined,
	};
}

export async function createSavedTimeline(
	database: D1Database,
	input: { elementKeys: string[]; name: string; site: string },
): Promise<{ slug: string; timelineId: string }> {
	const timelineId = crypto.randomUUID();
	const safeName = input.name
		.toLocaleLowerCase("en-GB")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
	const slug = `${safeName || "timeline"}-${timelineId.slice(0, 8)}`;
	const existing = await database
		.prepare(
			`SELECT DISTINCT page_elements.element_key
			FROM page_elements
			JOIN indexed_desktop_captures AS analysed_captures
				ON analysed_captures.capture_id = page_elements.capture_id
			WHERE analysed_captures.site = ?
				AND page_elements.element_key IN (${input.elementKeys.map(() => "?").join(",")})`,
		)
		.bind(input.site, ...input.elementKeys)
		.all<{ element_key: string }>();
	if (existing.results.length !== input.elementKeys.length) {
		throw new Error("Every timeline item must exist for the selected site");
	}
	await database.batch([
		database
			.prepare(
				"INSERT INTO saved_timelines (timeline_id, slug, name, site, created_at) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(timelineId, slug, input.name, input.site, new Date().toISOString()),
		...input.elementKeys.map((elementKey, position) => {
			return database
				.prepare(
					"INSERT INTO saved_timeline_elements (timeline_id, element_key, position) VALUES (?, ?, ?)",
				)
				.bind(timelineId, elementKey, position);
		}),
	]);
	return { slug, timelineId };
}

export async function getSavedTimeline(
	database: D1Database,
	slug: string,
): Promise<Record<string, unknown> | null> {
	const timeline = await database
		.prepare(
			"SELECT timeline_id AS timelineId, slug, name, site, created_at AS createdAt FROM saved_timelines WHERE slug = ?",
		)
		.bind(slug)
		.first<Record<string, unknown>>();
	if (!timeline) {
		return null;
	}
	const observations = await database
		.prepare(
			`WITH ranked_observations AS (
				SELECT
					saved_timeline_elements.position,
					saved_timeline_elements.element_key AS elementKey,
					page_elements.kind,
					page_elements.canonical_url AS canonicalUrl,
					page_elements.capture_id AS captureId,
					analysed_captures.captured_at AS capturedAt,
					page_elements.headline,
					page_elements.image_source_url AS imageSourceUrl,
					page_elements.image_crop_key AS imageCropKey,
					page_elements.rank,
					page_elements.top,
					page_elements.prominence,
					ROW_NUMBER() OVER (
						PARTITION BY saved_timeline_elements.element_key, page_elements.capture_id
						ORDER BY
							CASE page_elements.prominence
								WHEN 'lead' THEN 4 WHEN 'major' THEN 3
								WHEN 'standard' THEN 2 ELSE 1
							END DESC,
							page_elements.rank
					) AS placementRank
				FROM saved_timeline_elements
				JOIN page_elements
					ON page_elements.element_key = saved_timeline_elements.element_key
				JOIN indexed_desktop_captures AS analysed_captures
					ON analysed_captures.capture_id = page_elements.capture_id
					AND analysed_captures.site = ?
				WHERE saved_timeline_elements.timeline_id = ?
			)
			SELECT
				position, elementKey, kind, canonicalUrl, captureId, capturedAt,
				headline, imageSourceUrl, imageCropKey, rank, top, prominence
			FROM ranked_observations
			WHERE placementRank = 1
			ORDER BY position, capturedAt
			LIMIT 1001`,
		)
		.bind(String(timeline.site), String(timeline.timelineId))
		.all<Record<string, unknown>>();
	return {
		...timeline,
		observations: observations.results.slice(0, 1_000),
		truncated: observations.results.length > 1_000,
	};
}
