import { materialiseHistoryMonth } from "../infrastructure/history-trend-repository.ts";

export type HistoryAggregateMessage = {
	kind: "materialise-history-month";
	month: string;
	site: string;
};

export function previousUtcMonth(timestamp: number): string {
	const date = new Date(timestamp);
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() - 1);
	return date.toISOString().slice(0, 7);
}

export async function enqueueHistoryAggregateMonth(
	database: D1Database,
	queue: Queue<HistoryAggregateMessage>,
	month: string,
): Promise<number> {
	const from = `${month}-01T00:00:00.000Z`;
	const toDate = new Date(from);
	if (Number.isNaN(toDate.getTime()) || toDate.toISOString().slice(0, 7) !== month) {
		throw new Error("month must use YYYY-MM");
	}
	toDate.setUTCMonth(toDate.getUTCMonth() + 1);
	const result = await database
		.prepare(
			`SELECT DISTINCT site
			FROM indexed_desktop_captures
			WHERE captured_at >= ? AND captured_at < ?
			ORDER BY site`,
		)
		.bind(from, toDate.toISOString())
		.all<{ site: string }>();
	const sites = result.results.map(({ site }) => site);
	for (let offset = 0; offset < sites.length; offset += 100) {
		await queue.sendBatch(
			sites.slice(offset, offset + 100).map((site) => ({
				body: { kind: "materialise-history-month", month, site },
			})),
		);
	}
	return sites.length;
}

export async function processHistoryAggregateMessage(
	database: D1Database,
	message: HistoryAggregateMessage,
): Promise<{ rows: number }> {
	return materialiseHistoryMonth(database, message.site, message.month);
}
