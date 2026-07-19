import type { HistoryCaptureSummary } from "../../../core/types.ts";

export function captureTimelinePosition(
	captures: HistoryCaptureSummary[],
	selectedId?: string,
) {
	const selectedIndex = Math.max(
		0,
		captures.findIndex(({ captureId }) => captureId === selectedId),
	);

	return {
		newer: selectedIndex > 0 ? captures[selectedIndex - 1] : undefined,
		older: selectedIndex < captures.length - 1 ? captures[selectedIndex + 1] : undefined,
		selected: captures[selectedIndex],
		selectedIndex,
	};
}
