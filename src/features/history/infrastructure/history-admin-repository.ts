export type FailureListOptions = {
	cursor?: {
		failedAt: string;
		failureId: number;
	};
	device?: "desktop" | "mobile";
	limit: number;
	site?: string;
};

export type ExtractionListOptions = {
	limit: number;
	site?: string;
	sort: "newest" | "oldest";
};

export async function listIndexedExtractions(
	database: D1Database,
	options: ExtractionListOptions,
): Promise<Record<string, unknown>[]> {
	const direction = options.sort === "oldest" ? "ASC" : "DESC";
	const where = options.site ? "WHERE site = ?" : "";
	const parameters: Array<number | string> = options.site
		? [options.site, options.limit]
		: [options.limit];
	const result = await database
		.prepare(
			`SELECT
				capture_id AS captureId,
				captured_at AS capturedAt,
				device,
				extraction_key AS extractionKey,
				extractor_name AS extractorName,
				extractor_version AS extractorVersion,
				site,
				(
					SELECT COUNT(*) FROM page_elements
					WHERE page_elements.capture_id = analysed_captures.capture_id
				) AS matchedElements
			FROM analysed_captures
			${where}
			ORDER BY captured_at ${direction}, capture_id ${direction}
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();

	return result.results;
}

export async function historyIndexStatus(database: D1Database): Promise<{
	resourceUsage: Record<string, unknown>[];
	sites: Record<string, unknown>[];
	totals: Record<string, number>;
}> {
	const totals = await database
		.prepare(
			`SELECT
				(SELECT COUNT(*) FROM analysed_captures) AS captures,
				(SELECT COUNT(DISTINCT element_key) FROM page_elements) AS content,
				(SELECT COUNT(*) FROM page_elements) AS observations,
				(SELECT COUNT(*) FROM change_events) AS changes,
				(SELECT COUNT(*) FROM extraction_failures) AS failures`,
		)
		.first<Record<string, number>>();
	const sites = await database
		.prepare(
			`SELECT
				analysed_captures.site,
				COUNT(DISTINCT analysed_captures.capture_id) AS captureCount,
				MIN(analysed_captures.captured_at) AS firstCaptureAt,
				MAX(analysed_captures.captured_at) AS lastCaptureAt,
				MAX(analysed_captures.indexed_at) AS lastIndexedAt,
				COUNT(DISTINCT page_elements.element_key) AS contentCount
			FROM analysed_captures
			LEFT JOIN page_elements
				ON page_elements.capture_id = analysed_captures.capture_id
			GROUP BY analysed_captures.site
			ORDER BY analysed_captures.site`,
		)
		.all<Record<string, unknown>>();
	const resourceUsage = await database
		.prepare(
			`SELECT
				site,
				COUNT(*) AS indexedCaptures,
				SUM(compressed_bytes) AS compressedExtractionBytes,
				SUM(decompressed_bytes) AS decompressedExtractionBytes,
				SUM(element_count) AS indexedElements,
				SUM(content_count) AS indexedContent,
				SUM(image_count) AS indexedImages,
				SUM(change_count) AS indexedChanges,
				SUM(d1_statement_count) AS d1WriteStatements,
				MAX(indexed_at) AS measuredAt
			FROM history_ingestion_metrics
			GROUP BY site
			ORDER BY site`,
		)
		.all<Record<string, unknown>>();

	return {
		resourceUsage: resourceUsage.results,
		sites: sites.results,
		totals: totals ?? { captures: 0, changes: 0, content: 0, failures: 0, observations: 0 },
	};
}

export async function listExtractionFailures(
	database: D1Database,
	options: FailureListOptions,
): Promise<{
	failures: Record<string, unknown>[];
	nextCursor?: { failedAt: string; failureId: number };
}> {
	const conditions: string[] = [];
	const parameters: Array<number | string> = [];
	if (options.site) {
		conditions.push("site = ?");
		parameters.push(options.site);
	}
	if (options.device) {
		conditions.push("device = ?");
		parameters.push(options.device);
	}
	if (options.cursor) {
		conditions.push("(failed_at < ? OR (failed_at = ? AND failure_id < ?))");
		parameters.push(options.cursor.failedAt, options.cursor.failedAt, options.cursor.failureId);
	}
	parameters.push(options.limit + 1);
	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const result = await database
		.prepare(
			`SELECT
				failure_id AS failureId, capture_id AS captureId, site, device,
				extraction_key AS extractionKey, stage, message, failed_at AS failedAt
			FROM extraction_failures
			${where}
			ORDER BY failed_at DESC, failure_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const failures = result.results.slice(0, options.limit);
	const last = failures.at(-1);

	return {
		failures,
		nextCursor:
			hasMore && last
				? { failedAt: String(last.failedAt), failureId: Number(last.failureId) }
				: undefined,
	};
}

export async function clearExtractionFailures(
	database: D1Database,
	site?: string,
): Promise<number> {
	const statement = site
		? database.prepare("DELETE FROM extraction_failures WHERE site = ?").bind(site)
		: database.prepare("DELETE FROM extraction_failures");
	const result = await statement.run();
	return result.meta.changes;
}

export async function resetHistoryIndex(database: D1Database, site?: string): Promise<void> {
	await database.exec("PRAGMA foreign_keys = ON");
	const suffix = site ? " WHERE site = ?" : "";
	const statement = (sql: string): D1PreparedStatement => {
		const prepared = database.prepare(`${sql}${suffix}`);
		return site ? prepared.bind(site) : prepared;
	};
	const statements = [
		statement("DELETE FROM history_monthly_aggregates"),
		statement("DELETE FROM history_monthly_aggregate_runs"),
		statement("DELETE FROM history_ingestion_metrics"),
		statement("DELETE FROM content_observation_search"),
		statement("DELETE FROM analysed_captures"),
		statement("DELETE FROM images"),
		statement("DELETE FROM extraction_failures"),
	];
	await database.batch(statements);
}
