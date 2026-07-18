import { historySearchQuery } from "../domain/search-query.ts";
import { weightedWordFrequency } from "../domain/word-frequency.ts";
import { groupBy } from "../../../core/collections.ts";

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

export type SearchOptions = ResearchListOptions & {
	category?: string;
	query: string;
	site?: string;
};

type TrendRow = {
	capture_id: string;
	captured_at: string;
	category: string | null;
	headline: string | null;
	next_captured_at: string | null;
	prominence: string | null;
};

type TrendMode = "category" | "main-headline-words" | "all-headline-words";

export async function searchHistory(
	database: D1Database,
	options: SearchOptions,
): Promise<{ nextCursor?: ResearchCursor; results: Record<string, unknown>[] }> {
	const conditions = ["story_observation_search MATCH ?"];
	const parameters: Array<number | string> = [historySearchQuery(options.query)];
	if (options.site) {
		conditions.push("story_observation_search.site = ?");
		parameters.push(options.site);
	}
	if (options.category) {
		conditions.push("story_observations.category = ?");
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
	if (options.cursor) {
		conditions.push(
			"(analysed_captures.captured_at < ? OR (analysed_captures.captured_at = ? AND story_observation_search.story_id < ?))",
		);
		parameters.push(options.cursor.capturedAt, options.cursor.capturedAt, options.cursor.id);
	}
	parameters.push(options.limit + 1);
	const result = await database
		.prepare(
			`SELECT
				story_observation_search.story_id AS storyId,
				story_observation_search.capture_id AS captureId,
				story_observation_search.site,
				analysed_captures.captured_at AS capturedAt,
				stories.canonical_url AS canonicalUrl,
				story_observations.headline,
				story_observations.summary,
				story_observations.category,
				story_observations.section,
				story_observations.image_alt AS imageAlt,
				story_observations.image_crop_key AS imageCropKey,
				story_observations.image_source_url AS imageSourceUrl,
				story_observations.prominence,
				story_observations.rank
			FROM story_observation_search
			JOIN analysed_captures
				ON analysed_captures.capture_id = story_observation_search.capture_id
			JOIN story_observations
				ON story_observations.capture_id = story_observation_search.capture_id
				AND story_observations.story_id = story_observation_search.story_id
			JOIN stories ON stories.story_id = story_observation_search.story_id
			WHERE ${conditions.join(" AND ")}
			ORDER BY analysed_captures.captured_at DESC, story_observation_search.story_id DESC
			LIMIT ?`,
		)
		.bind(...parameters)
		.all<Record<string, unknown>>();
	const hasMore = result.results.length > options.limit;
	const results = result.results.slice(0, options.limit);
	const last = results.at(-1);
	return {
		nextCursor:
			hasMore && last
				? { capturedAt: String(last.capturedAt), id: String(last.storyId) }
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
	const conditions = ["analysed_captures.site = ?", "story_observations.image_id IS NOT NULL"];
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
					story_observations.image_id AS imageId,
					story_observations.image_source_url AS sourceUrl,
					story_observations.image_crop_key AS cropKey,
					story_observations.image_alt AS alt,
					story_observations.story_id AS storyId,
					story_observations.headline,
					story_observations.capture_id AS captureId,
					analysed_captures.captured_at AS capturedAt,
					analysed_captures.source_url AS publisherUrl,
					ROW_NUMBER() OVER (
						PARTITION BY story_observations.image_id
						ORDER BY analysed_captures.captured_at DESC,
							story_observations.capture_id DESC,
							story_observations.story_id DESC
					) AS imageRank
				FROM story_observations
				JOIN analysed_captures
					ON analysed_captures.capture_id = story_observations.capture_id
				WHERE ${conditions.join(" AND ")}
			)
			SELECT
				imageId, sourceUrl, cropKey, alt, storyId, headline,
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

function trendStart(period: string, now: Date): string | undefined {
	const durations: Record<string, number> = {
		"24h": 24 * 60 * 60 * 1_000,
		"7d": 7 * 24 * 60 * 60 * 1_000,
		"30d": 30 * 24 * 60 * 60 * 1_000,
		"90d": 90 * 24 * 60 * 60 * 1_000,
	};
	return period === "all" ? undefined : new Date(now.getTime() - durations[period]).toISOString();
}

function bucketPeriod(capturedAt: string, period: string): string {
	return period === "90d" || period === "all" ? capturedAt.slice(0, 7) : capturedAt.slice(0, 10);
}

export async function historyTrends(
	database: D1Database,
	site: string,
	period: "24h" | "7d" | "30d" | "90d" | "all",
	mode: TrendMode,
	now = new Date(),
): Promise<Record<string, unknown>> {
	if (period === "all") {
		const materialised = await database
			.prepare(
				`SELECT
					month AS period, label, observation_count AS count,
					weighted_seconds AS weightSeconds
				FROM history_monthly_aggregates
				WHERE site = ? AND mode = ?
				ORDER BY month, weighted_seconds DESC, label`,
			)
			.bind(site, mode)
			.all<{ count: number; label: string; period: string; weightSeconds: number }>();
		if (materialised.results.length > 0) {
			return {
				materialised: true,
				mode,
				period,
				periods: [...groupBy(materialised.results, (row) => row.period)].map(([month, rows]) => ({
					period: month,
					values: rows.map(({ count, label, weightSeconds }) => ({
						count,
						label,
						weightSeconds,
					})),
				})),
				site,
				timeWeighted: true,
			};
		}
	}
	const start = trendStart(period, now);
	const conditions = ["capture_windows.site = ?"];
	const parameters: string[] = [site];
	if (start) {
		conditions.push("capture_windows.captured_at >= ?");
		parameters.push(start);
	}
	const result = await database
		.prepare(
			`WITH capture_windows AS (
				SELECT
					capture_id, site, captured_at,
					LEAD(captured_at) OVER (
						PARTITION BY site, device ORDER BY captured_at, capture_id
					) AS next_captured_at
				FROM analysed_captures
				WHERE status = 'indexed'
			)
			SELECT
				capture_windows.capture_id,
				capture_windows.captured_at,
				capture_windows.next_captured_at,
				story_observations.category,
				story_observations.headline,
				story_observations.prominence
			FROM capture_windows
			JOIN story_observations ON story_observations.capture_id = capture_windows.capture_id
			WHERE ${conditions.join(" AND ")}
			ORDER BY capture_windows.captured_at
			LIMIT 10000`,
		)
		.bind(...parameters)
		.all<TrendRow>();
	const buckets = new Map<string, Map<string, { count: number; weightSeconds: number }>>();
	const wordsByBucket = new Map<string, Array<{ headline: string; weightSeconds: number }>>();

	for (const row of result.results) {
		const weightSeconds = row.next_captured_at
			? Math.max(0, (Date.parse(row.next_captured_at) - Date.parse(row.captured_at)) / 1_000)
			: 0;
		const bucket = bucketPeriod(row.captured_at, period);
		if (mode === "category") {
			const values = buckets.get(bucket) ?? new Map();
			const label = row.category ?? "Front page";
			const current = values.get(label) ?? { count: 0, weightSeconds: 0 };
			current.count += 1;
			current.weightSeconds += weightSeconds;
			values.set(label, current);
			buckets.set(bucket, values);
		} else if (row.headline && (mode === "all-headline-words" || row.prominence === "lead")) {
			const observations = wordsByBucket.get(bucket) ?? [];
			observations.push({ headline: row.headline, weightSeconds });
			wordsByBucket.set(bucket, observations);
		}
	}

	const periods =
		mode === "category"
			? [...buckets].map(([bucket, values]) => ({
					period: bucket,
					values: [...values]
						.map(([label, value]) => ({ label, ...value }))
						.sort((left, right) => right.weightSeconds - left.weightSeconds),
				}))
			: [...wordsByBucket].map(([bucket, observations]) => ({
					period: bucket,
					values: weightedWordFrequency(observations).slice(0, 50),
				}));

	return { mode, period, periods, site, timeWeighted: true };
}

export async function materialiseHistoryMonth(
	database: D1Database,
	site: string,
	month: string,
): Promise<{ rows: number }> {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
		throw new Error("month must use YYYY-MM");
	}
	const from = `${month}-01T00:00:00.000Z`;
	const toDate = new Date(from);
	toDate.setUTCMonth(toDate.getUTCMonth() + 1);
	const monthEnd = toDate.getTime();
	const result = await database
		.prepare(
			`WITH capture_windows AS (
				SELECT
					capture_id, site, captured_at,
					LEAD(captured_at) OVER (
						PARTITION BY site, device ORDER BY captured_at, capture_id
					) AS next_captured_at
				FROM analysed_captures
				WHERE status = 'indexed' AND site = ?
			)
			SELECT
				capture_windows.capture_id,
				capture_windows.captured_at,
				capture_windows.next_captured_at,
				story_observations.category,
				story_observations.headline,
				story_observations.prominence
			FROM capture_windows
			JOIN story_observations ON story_observations.capture_id = capture_windows.capture_id
			WHERE capture_windows.captured_at >= ? AND capture_windows.captured_at < ?
			ORDER BY capture_windows.captured_at
			LIMIT 10000`,
		)
		.bind(site, from, toDate.toISOString())
		.all<TrendRow>();
	const aggregate = (mode: TrendMode) => {
		const categories = new Map<string, { count: number; weightSeconds: number }>();
		const headlines: Array<{ headline: string; weightSeconds: number }> = [];
		for (const row of result.results) {
			const weightSeconds = row.next_captured_at
				? Math.max(
						0,
						(Math.min(Date.parse(row.next_captured_at), monthEnd) - Date.parse(row.captured_at)) /
							1_000,
					)
				: 0;
			if (mode === "category") {
				const label = row.category ?? "Front page";
				const current = categories.get(label) ?? { count: 0, weightSeconds: 0 };
				current.count += 1;
				current.weightSeconds += weightSeconds;
				categories.set(label, current);
			} else if (row.headline && (mode === "all-headline-words" || row.prominence === "lead")) {
				headlines.push({ headline: row.headline, weightSeconds });
			}
		}
		return mode === "category"
			? [...categories].map(([label, value]) => ({ label, ...value }))
			: weightedWordFrequency(headlines).slice(0, 50);
	};
	const modes: TrendMode[] = ["category", "main-headline-words", "all-headline-words"];
	const generatedAt = new Date().toISOString();
	const statements = [
		database
			.prepare("DELETE FROM history_monthly_aggregates WHERE site = ? AND month = ?")
			.bind(site, month),
		...modes.flatMap((mode) =>
			aggregate(mode).map((value) =>
				database
					.prepare(
						`INSERT INTO history_monthly_aggregates (
							site, month, mode, label, observation_count, weighted_seconds, generated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(site, month, mode, value.label, value.count, value.weightSeconds, generatedAt),
			),
		),
	];
	await database.batch(statements);
	return { rows: statements.length - 1 };
}

export async function createSavedTimeline(
	database: D1Database,
	input: { name: string; site: string; storyIds: string[] },
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
			`SELECT story_id FROM stories
			WHERE site = ? AND story_id IN (${input.storyIds.map(() => "?").join(",")})`,
		)
		.bind(input.site, ...input.storyIds)
		.all<{ story_id: string }>();
	if (existing.results.length !== input.storyIds.length) {
		throw new Error("Every timeline story must exist for the selected site");
	}
	await database.batch([
		database
			.prepare(
				"INSERT INTO saved_timelines (timeline_id, slug, name, site, created_at) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(timelineId, slug, input.name, input.site, new Date().toISOString()),
		...input.storyIds.map((storyId, position) => {
			return database
				.prepare(
					"INSERT INTO saved_timeline_stories (timeline_id, story_id, position) VALUES (?, ?, ?)",
				)
				.bind(timelineId, storyId, position);
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
			`SELECT
				saved_timeline_stories.position,
				stories.story_id AS storyId,
				stories.canonical_url AS canonicalUrl,
				story_observations.capture_id AS captureId,
				analysed_captures.captured_at AS capturedAt,
				story_observations.headline,
				story_observations.image_source_url AS imageSourceUrl,
				story_observations.image_crop_key AS imageCropKey,
				story_observations.rank,
				story_observations.top,
				story_observations.prominence
			FROM saved_timeline_stories
			JOIN stories ON stories.story_id = saved_timeline_stories.story_id
			LEFT JOIN story_observations ON story_observations.story_id = stories.story_id
			LEFT JOIN analysed_captures ON analysed_captures.capture_id = story_observations.capture_id
			WHERE saved_timeline_stories.timeline_id = ?
			ORDER BY saved_timeline_stories.position, analysed_captures.captured_at
			LIMIT 1001`,
		)
		.bind(String(timeline.timelineId))
		.all<Record<string, unknown>>();
	return {
		...timeline,
		observations: observations.results.slice(0, 1_000),
		truncated: observations.results.length > 1_000,
	};
}
