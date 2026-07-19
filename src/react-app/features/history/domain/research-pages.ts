import type { HistoryImageObservation, HistorySearchResult } from "../../../core/types.ts";

function appendUnique<T>(current: T[], next: T[], key: (value: T) => string): T[] {
	const keys = new Set(current.map(key));
	return current.concat(
		next.filter((value) => {
			const valueKey = key(value);
			if (keys.has(valueKey)) {
				return false;
			}
			keys.add(valueKey);
			return true;
		}),
	);
}

export function mergeHistorySearchResults(
	current: HistorySearchResult[],
	next: HistorySearchResult[],
): HistorySearchResult[] {
	return appendUnique(current, next, (result) => `${result.site}\n${result.elementKey}`);
}

export function mergeHistoryImages(
	current: HistoryImageObservation[],
	next: HistoryImageObservation[],
): HistoryImageObservation[] {
	return appendUnique(current, next, (image) => image.imageId);
}
