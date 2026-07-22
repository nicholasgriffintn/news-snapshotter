import { headlineWords } from "../domain/word-frequency.ts";

type TrendRow = {
	capture_id: string;
	captured_at: string;
	category: string | null;
	element_key: string;
	headline: string | null;
	next_captured_at: string | null;
	placement_key: string;
	prominence: string | null;
};

type TrendMode = "category" | "main-headline-words" | "all-headline-words";
type TrendValue = { count: number; weightSeconds: number };
type TrendBuckets = Map<string, Map<string, TrendValue>>;
type TrendCursor = { captureId: string; capturedAt: string; placementKey: string };
type TrendRange = { from?: string; to?: string };

const TREND_PAGE_SIZE = 1_000;
const TREND_MODES: TrendMode[] = ["category", "main-headline-words", "all-headline-words"];

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

function monthRange(month: string): { from: string; monthEnd: number; to: string } {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
		throw new Error("month must use YYYY-MM");
	}
	const from = `${month}-01T00:00:00.000Z`;
	const toDate = new Date(from);
	toDate.setUTCMonth(toDate.getUTCMonth() + 1);
	return { from, monthEnd: toDate.getTime(), to: toDate.toISOString() };
}

async function readTrendRows(
	database: D1Database,
	site: string,
	range: TrendRange,
	consume: (rows: TrendRow[]) => void,
): Promise<void> {
	let cursor: TrendCursor | undefined;
	while (true) {
		const conditions: string[] = [];
		const parameters: Array<number | string> = [site];
		if (range.from) {
			conditions.push("capture_windows.captured_at >= ?");
			parameters.push(range.from);
		}
		if (range.to) {
			conditions.push("capture_windows.captured_at < ?");
			parameters.push(range.to);
		}
		if (cursor) {
			conditions.push(`(
				capture_windows.captured_at > ? OR
				(capture_windows.captured_at = ? AND capture_windows.capture_id > ?) OR
				(capture_windows.captured_at = ? AND capture_windows.capture_id = ? AND page_elements.placement_key > ?)
			)`);
			parameters.push(
				cursor.capturedAt,
				cursor.capturedAt,
				cursor.captureId,
				cursor.capturedAt,
				cursor.captureId,
				cursor.placementKey,
			);
		}
		parameters.push(TREND_PAGE_SIZE);
		const result = await database
			.prepare(
				`WITH capture_windows AS (
					SELECT
						capture_id, captured_at,
						LEAD(captured_at) OVER (
							PARTITION BY site, device ORDER BY captured_at, capture_id
						) AS next_captured_at
					FROM indexed_desktop_captures
					WHERE site = ?
				)
				SELECT
					capture_windows.capture_id,
					capture_windows.captured_at,
					capture_windows.next_captured_at,
					page_elements.placement_key,
					page_elements.element_key,
					page_elements.category,
					page_elements.headline,
					page_elements.prominence
				FROM capture_windows
				JOIN page_elements ON page_elements.capture_id = capture_windows.capture_id
				WHERE page_elements.kind = 'story'
				${conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""}
				ORDER BY capture_windows.captured_at, capture_windows.capture_id, page_elements.placement_key
				LIMIT ?`,
			)
			.bind(...parameters)
			.all<TrendRow>();
		consume(result.results);
		if (result.results.length < TREND_PAGE_SIZE) {
			return;
		}
		const last = result.results.at(-1);
		if (!last) {
			return;
		}
		cursor = {
			captureId: last.capture_id,
			capturedAt: last.captured_at,
			placementKey: last.placement_key,
		};
	}
}

function addTrendValue(
	buckets: TrendBuckets,
	bucket: string,
	label: string,
	count: number,
	weightSeconds: number,
): void {
	const values = buckets.get(bucket) ?? new Map<string, TrendValue>();
	const current = values.get(label) ?? { count: 0, weightSeconds: 0 };
	current.count += count;
	current.weightSeconds += weightSeconds;
	values.set(label, current);
	buckets.set(bucket, values);
}

function accumulateRows(
	buckets: TrendBuckets,
	rows: TrendRow[],
	period: string,
	mode: TrendMode,
	capAt?: number,
): void {
	for (const row of rows) {
		const capturedAt = Date.parse(row.captured_at);
		const naturalEnd = row.next_captured_at ? Date.parse(row.next_captured_at) : undefined;
		const end =
			naturalEnd === undefined
				? capAt
				: capAt === undefined
					? naturalEnd
					: Math.min(naturalEnd, capAt);
		const weightSeconds = end === undefined ? 0 : Math.max(0, (end - capturedAt) / 1_000);
		const bucket = bucketPeriod(row.captured_at, period);
		if (mode === "category") {
			addTrendValue(buckets, bucket, row.category ?? "Front page", 1, weightSeconds);
		} else if (row.headline && (mode === "all-headline-words" || row.prominence === "lead")) {
			for (const word of headlineWords(row.headline)) {
				addTrendValue(buckets, bucket, word, 1, weightSeconds);
			}
		}
	}
}

function periodsFromBuckets(
	buckets: TrendBuckets,
	mode: TrendMode,
): Array<{
	period: string;
	values: Array<{ count: number; label: string; weightSeconds: number }>;
}> {
	return [...buckets]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([period, values]) => ({
			period,
			values: [...values]
				.map(([label, value]) => ({ label, ...value }))
				.sort(
					(left, right) =>
						right.weightSeconds - left.weightSeconds || left.label.localeCompare(right.label),
				)
				.slice(0, mode === "category" ? undefined : 50),
		}));
}

async function calculateTrendBuckets(
	database: D1Database,
	site: string,
	range: TrendRange,
	period: string,
	mode: TrendMode,
	capAt?: number,
): Promise<TrendBuckets> {
	const buckets: TrendBuckets = new Map();
	await readTrendRows(database, site, range, (rows) =>
		accumulateRows(buckets, rows, period, mode, capAt),
	);
	return buckets;
}

async function historyMonths(database: D1Database, site: string): Promise<string[]> {
	const result = await database
		.prepare(
			`SELECT DISTINCT substr(captured_at, 1, 7) AS month
			FROM indexed_desktop_captures
			WHERE site = ?
			ORDER BY month`,
		)
		.bind(site)
		.all<{ month: string }>();
	return result.results.map(({ month }) => month);
}

async function allHistoryBuckets(
	database: D1Database,
	site: string,
	mode: TrendMode,
	now: Date,
): Promise<{ buckets: TrendBuckets; materialised: boolean }> {
	const [months, runs, cached] = await Promise.all([
		historyMonths(database, site),
		database
			.prepare("SELECT month FROM history_monthly_aggregate_runs WHERE site = ? ORDER BY month")
			.bind(site)
			.all<{ month: string }>(),
		database
			.prepare(
				`SELECT month, label, observation_count AS count, weighted_seconds AS weightSeconds
				FROM history_monthly_aggregates
				WHERE site = ? AND mode = ?
				ORDER BY month, weighted_seconds DESC, label`,
			)
			.bind(site, mode)
			.all<{ count: number; label: string; month: string; weightSeconds: number }>(),
	]);
	const materialisedMonths = new Set(runs.results.map(({ month }) => month));
	const allMonths = [...new Set([...months, ...materialisedMonths])].sort();
	const buckets: TrendBuckets = new Map(allMonths.map((month) => [month, new Map()]));
	for (const row of cached.results) {
		if (
			materialisedMonths.has(row.month) &&
			(mode === "category" || headlineWords(row.label).length === 1)
		) {
			addTrendValue(buckets, row.month, row.label, row.count, row.weightSeconds);
		}
	}
	for (const month of months) {
		if (materialisedMonths.has(month)) {
			continue;
		}
		const range = monthRange(month);
		const capAt = month < now.toISOString().slice(0, 7) ? range.monthEnd : undefined;
		await readTrendRows(database, site, range, (rows) =>
			accumulateRows(buckets, rows, "all", mode, capAt),
		);
	}
	return { buckets, materialised: materialisedMonths.size > 0 };
}

export async function historyTrends(
	database: D1Database,
	site: string,
	period: "24h" | "7d" | "30d" | "90d" | "all",
	mode: TrendMode,
	now = new Date(),
): Promise<Record<string, unknown>> {
	if (period === "all") {
		const result = await allHistoryBuckets(database, site, mode, now);
		return {
			materialised: result.materialised,
			mode,
			period,
			periods: periodsFromBuckets(result.buckets, mode),
			site,
			timeWeighted: true,
		};
	}
	const buckets = await calculateTrendBuckets(
		database,
		site,
		{ from: trendStart(period, now) },
		period,
		mode,
	);
	return { mode, period, periods: periodsFromBuckets(buckets, mode), site, timeWeighted: true };
}

export async function materialiseHistoryMonth(
	database: D1Database,
	site: string,
	month: string,
): Promise<{ rows: number }> {
	const range = monthRange(month);
	const bucketsByMode = new Map<TrendMode, TrendBuckets>(
		TREND_MODES.map((mode) => [mode, new Map()]),
	);
	await readTrendRows(database, site, range, (rows) => {
		for (const mode of TREND_MODES) {
			const buckets = bucketsByMode.get(mode);
			if (buckets) {
				accumulateRows(buckets, rows, "all", mode, range.monthEnd);
			}
		}
	});
	const generatedAt = new Date().toISOString();
	const values = TREND_MODES.flatMap((mode) =>
		periodsFromBuckets(bucketsByMode.get(mode) ?? new Map(), mode).flatMap(
			({ values: periodValues }) => periodValues.map((value) => ({ mode, ...value })),
		),
	);
	await database.batch([
		database
			.prepare("DELETE FROM history_monthly_aggregates WHERE site = ? AND month = ?")
			.bind(site, month),
		database
			.prepare(
				`INSERT INTO history_monthly_aggregate_runs (site, month, generated_at)
				VALUES (?, ?, ?)
				ON CONFLICT(site, month) DO UPDATE SET generated_at = excluded.generated_at`,
			)
			.bind(site, month, generatedAt),
		...values.map((value) =>
			database
				.prepare(
					`INSERT INTO history_monthly_aggregates (
						site, month, mode, label, observation_count, weighted_seconds, generated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(site, month, value.mode, value.label, value.count, value.weightSeconds, generatedAt),
		),
	]);
	return { rows: values.length };
}
