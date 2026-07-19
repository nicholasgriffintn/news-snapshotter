import type { HistoryTrends } from "../../../core/types.ts";

export type ResearchPeriod = "24h" | "7d" | "30d" | "90d" | "all";

export type ResearchState = {
	mode: HistoryTrends["mode"];
	month: string;
	period: ResearchPeriod;
	query: string;
};

const MODES = new Set<HistoryTrends["mode"]>([
	"category",
	"main-headline-words",
	"all-headline-words",
]);
const PERIODS = new Set<ResearchPeriod>(["24h", "7d", "30d", "90d", "all"]);

export function isResearchPeriod(value: string): value is ResearchPeriod {
	return PERIODS.has(value as ResearchPeriod);
}

export function researchStateFromSearch(search: string, now = new Date()): ResearchState {
	const parameters = new URLSearchParams(search);
	const mode = parameters.get("mode") as HistoryTrends["mode"] | null;
	const period = parameters.get("period") as ResearchPeriod | null;
	const month = parameters.get("month");

	return {
		mode: mode && MODES.has(mode) ? mode : "category",
		month: month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : now.toISOString().slice(0, 7),
		period: period && isResearchPeriod(period) ? period : "30d",
		query: (parameters.get("q") ?? "").slice(0, 200),
	};
}
