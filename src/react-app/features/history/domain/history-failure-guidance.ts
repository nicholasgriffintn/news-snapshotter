import type { HistoryFailure } from "../../../core/types.ts";

export type HistoryFailureGuidance = {
	label: string;
	meaning: string;
	resolution: string;
};

const GUIDANCE: Record<string, HistoryFailureGuidance> = {
	indexing: {
		label: "Archive indexing failed",
		meaning: "An archived analysis could not be added to structured history.",
		resolution: "Review the private error, correct the indexing issue, then backfill this site.",
	},
	validation: {
		label: "Capture analysis failed",
		meaning:
			"The screenshot was saved, but structured analysis did not complete or pass its checks.",
		resolution: "Review the private error, correct the capture or extractor issue, then recapture.",
	},
};

const UNKNOWN_GUIDANCE: HistoryFailureGuidance = {
	label: "Analysis failed",
	meaning: "This capture could not be added to structured history.",
	resolution: "Review the private failure details before retrying the capture.",
};

export function historyFailureGuidance(stage: string): HistoryFailureGuidance {
	return GUIDANCE[stage] ?? UNKNOWN_GUIDANCE;
}

export function historyFailureLogHref(site: string): string {
	const parameters = new URLSearchParams({ tool: "failures" });
	if (site) {
		parameters.set("site", site);
	}
	return `/admin?${parameters.toString()}`;
}

export function groupHistoryFailures(
	failures: HistoryFailure[],
): Array<{ failures: HistoryFailure[]; stage: string }> {
	const groups = new Map<string, HistoryFailure[]>();
	for (const failure of failures) {
		const group = groups.get(failure.stage) ?? [];
		group.push(failure);
		groups.set(failure.stage, group);
	}
	return [...groups].map(([stage, groupedFailures]) => ({ failures: groupedFailures, stage }));
}
