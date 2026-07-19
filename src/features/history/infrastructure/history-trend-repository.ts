import { groupBy } from "../../../core/collections.ts";
import { headlineWords, weightedWordFrequency } from "../domain/word-frequency.ts";

type TrendRow = {
	capture_id: string;
	captured_at: string;
	category: string | null;
	headline: string | null;
	next_captured_at: string | null;
	prominence: string | null;
};

type TrendMode = "category" | "main-headline-words" | "all-headline-words";
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
			const rows =
				mode === "category"
					? materialised.results
					: materialised.results.filter(({ label }) => headlineWords(label).length === 1);
			return {
				materialised: true,
				mode,
				period,
				periods: [...groupBy(rows, (row) => row.period)].map(([month, monthRows]) => ({
					period: month,
					values: monthRows.map(({ count, label, weightSeconds }) => ({
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
				FROM indexed_desktop_captures
			)
			SELECT
				capture_windows.capture_id,
				capture_windows.captured_at,
				capture_windows.next_captured_at,
				page_elements.category,
				page_elements.headline,
				page_elements.prominence
			FROM capture_windows
			JOIN page_elements ON page_elements.capture_id = capture_windows.capture_id
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
				FROM indexed_desktop_captures
				WHERE site = ?
			)
			SELECT
				capture_windows.capture_id,
				capture_windows.captured_at,
				capture_windows.next_captured_at,
				page_elements.category,
				page_elements.headline,
				page_elements.prominence
			FROM capture_windows
			JOIN page_elements ON page_elements.capture_id = capture_windows.capture_id
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
