import { comparisonWindowPeriod, windowPublicationStatus } from "../domain/pipeline.ts";
import type { ComparisonCohort } from "../domain/configuration.ts";
import type { SiteDefinition } from "../../../core/domain.ts";

type WindowRow = {
	analysed_site_count: number;
	captured_site_count: number;
	cohort_id: string;
	ends_at: string;
	expected_site_count: number;
	finalised_at: string | null;
	starts_at: string;
	status: string;
	window_id: string;
};

export type ComparisonWindowCursor = { startsAt: string; windowId: string };

export async function ensureComparisonWindow(
	database: D1Database,
	cohort: ComparisonCohort,
	sites: readonly SiteDefinition[],
	timestamp: string,
): Promise<{ endsAt: string; startsAt: string; windowId: string }> {
	const period = comparisonWindowPeriod(cohort, timestamp);
	const now = new Date().toISOString();
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`INSERT INTO comparison_windows (
					window_id, cohort_id, starts_at, ends_at, expected_site_count, status
				) VALUES (?, ?, ?, ?, ?, 'pending')
				ON CONFLICT(window_id) DO UPDATE SET
					expected_site_count = excluded.expected_site_count`,
			)
			.bind(period.windowId, cohort.id, period.startsAt, period.endsAt, sites.length),
	];
	for (const site of sites) {
		statements.push(
			database
				.prepare(
					`INSERT INTO comparison_window_sites (window_id, site, status, updated_at)
					VALUES (?, ?, 'expected', ?)
					ON CONFLICT(window_id, site) DO NOTHING`,
				)
				.bind(period.windowId, site.name, now),
		);
	}
	await database.batch(statements);
	return period;
}

export async function markWindowSite(
	database: D1Database,
	windowId: string,
	site: string,
	status: "analysed" | "captured" | "failed",
	options: { captureId?: string; failureReason?: string } = {},
): Promise<void> {
	await database
		.prepare(
			`UPDATE comparison_window_sites
			SET
				status = CASE
					WHEN status = 'analysed' AND ? IN ('captured', 'failed') THEN status
					ELSE ?
				END,
				capture_id = COALESCE(?, capture_id),
				failure_reason = CASE
					WHEN status = 'analysed' AND ? IN ('captured', 'failed') THEN failure_reason
					ELSE ?
				END,
				updated_at = ?
			WHERE window_id = ? AND site = ?`,
		)
		.bind(
			status,
			status,
			options.captureId ?? null,
			status,
			options.failureReason ?? null,
			new Date().toISOString(),
			windowId,
			site,
		)
		.run();
	await refreshWindowCounts(database, windowId);
}

async function refreshWindowCounts(database: D1Database, windowId: string): Promise<void> {
	await database
		.prepare(
			`UPDATE comparison_windows SET
				captured_site_count = (
					SELECT COUNT(*) FROM comparison_window_sites
					WHERE window_id = ? AND capture_id IS NOT NULL
				),
				analysed_site_count = (
					SELECT COUNT(*) FROM comparison_window_sites
					WHERE window_id = ? AND status = 'analysed'
				)
			WHERE window_id = ?`,
		)
		.bind(windowId, windowId, windowId)
		.run();
}

export async function comparisonWindowProgress(database: D1Database, windowId: string) {
	await refreshWindowCounts(database, windowId);
	const window = await database
		.prepare(
			`SELECT expected_site_count, captured_site_count, analysed_site_count
			FROM comparison_windows WHERE window_id = ?`,
		)
		.bind(windowId)
		.first<{
			analysed_site_count: number;
			captured_site_count: number;
			expected_site_count: number;
		}>();
	if (!window) {
		throw new Error(`Comparison window not found: ${windowId}`);
	}
	return {
		analysedSites: window.analysed_site_count,
		capturedSites: window.captured_site_count,
		expectedSites: window.expected_site_count,
	};
}

export async function finaliseComparisonWindow(
	database: D1Database,
	windowId: string,
	minimumAnalysedSites: number,
): Promise<"complete" | "partial" | "suppressed"> {
	const window = await comparisonWindowProgress(database, windowId);
	const status = windowPublicationStatus({
		analysedSites: window.analysedSites,
		capturedSites: window.capturedSites,
		expectedSites: window.expectedSites,
		minimumSites: minimumAnalysedSites,
	});
	await database
		.prepare(`UPDATE comparison_windows SET status = ?, finalised_at = ? WHERE window_id = ?`)
		.bind(status, new Date().toISOString(), windowId)
		.run();
	return status;
}

export async function listComparisonWindows(
	database: D1Database,
	cohortId: string,
	options: {
		cursor?: ComparisonWindowCursor;
		from?: string;
		limit: number;
		to?: string;
	},
) {
	const conditions = ["cohort_id = ?", "status != 'pending'"];
	const bindings: Array<number | string> = [cohortId];
	if (options.from) {
		conditions.push("starts_at >= ?");
		bindings.push(options.from);
	}
	if (options.to) {
		conditions.push("starts_at <= ?");
		bindings.push(options.to);
	}
	if (options.cursor) {
		conditions.push("(starts_at < ? OR (starts_at = ? AND window_id < ?))");
		bindings.push(options.cursor.startsAt, options.cursor.startsAt, options.cursor.windowId);
	}
	bindings.push(options.limit + 1);

	const rows = await database
		.prepare(
			`SELECT * FROM comparison_windows
			WHERE ${conditions.join(" AND ")}
			ORDER BY starts_at DESC, window_id DESC
			LIMIT ?`,
		)
		.bind(...bindings)
		.all<WindowRow>();
	const page = rows.results.slice(0, options.limit);
	const last = page.at(-1);

	return {
		nextCursor:
			rows.results.length > options.limit && last
				? { startsAt: last.starts_at, windowId: last.window_id }
				: undefined,
		windows: page.map((row) => ({
			analysedSites: row.analysed_site_count,
			capturedSites: row.captured_site_count,
			cohortId: row.cohort_id,
			endsAt: row.ends_at,
			expectedSites: row.expected_site_count,
			finalisedAt: row.finalised_at ?? undefined,
			startsAt: row.starts_at,
			status: row.status,
			windowId: row.window_id,
		})),
	};
}
