import type { ElementHistory } from "../../../core/types.ts";

export function mergeElementHistoryPages(
	current: ElementHistory,
	older: ElementHistory,
): ElementHistory {
	const observations = new Map(
		[...older.observations, ...current.observations].map((observation) => [
			observation.captureId,
			observation,
		]),
	);

	return {
		...current,
		cursor: older.cursor,
		observations: [...observations.values()],
	};
}
