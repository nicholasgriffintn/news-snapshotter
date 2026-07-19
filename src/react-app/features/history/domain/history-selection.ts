import type { HistoryCaptureSummary } from "../../../core/types.ts";

export type HistorySelection = {
	captureId?: string;
	compareId?: string;
	overlay: boolean;
};

export function normaliseHistorySelection(
	selection: HistorySelection,
	captures: HistoryCaptureSummary[],
): HistorySelection {
	if (!selection.captureId) {
		return {
			...selection,
			captureId: captures[0]?.captureId,
			compareId: captures[1]?.captureId,
		};
	}

	const selectedIndex = captures.findIndex(({ captureId }) => captureId === selection.captureId);
	if (selectedIndex < 0 || captures.some(({ captureId }) => captureId === selection.compareId)) {
		return selection;
	}

	return { ...selection, compareId: captures[selectedIndex + 1]?.captureId };
}
