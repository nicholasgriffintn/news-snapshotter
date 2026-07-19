import type { HistoryCaptureSummary } from "../../../core/types.ts";

export function captureTimelinePosition(captures: HistoryCaptureSummary[], selectedId?: string) {
	const selectedIndex = selectedId
		? captures.findIndex(({ captureId }) => captureId === selectedId)
		: captures.length > 0
			? 0
			: -1;

	return {
		newer: selectedIndex > 0 ? captures[selectedIndex - 1] : undefined,
		older:
			selectedIndex >= 0 && selectedIndex < captures.length - 1
				? captures[selectedIndex + 1]
				: undefined,
		selected: selectedIndex >= 0 ? captures[selectedIndex] : undefined,
		selectedIndex,
	};
}
