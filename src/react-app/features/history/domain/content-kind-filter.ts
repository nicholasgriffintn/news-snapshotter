import type { HistoryElement, PageElementKind } from "../../../core/types.ts";

export const HISTORY_CONTENT_KINDS: readonly PageElementKind[] = [
	"story",
	"video",
	"audio",
	"image",
	"heading",
	"navigation",
	"other",
];

export const DEFAULT_HISTORY_CONTENT_KINDS: readonly PageElementKind[] = [
	"story",
	"video",
	"audio",
	"image",
];

export function contentKindCounts(
	elements: readonly HistoryElement[],
): Record<PageElementKind, number> {
	const counts = Object.fromEntries(HISTORY_CONTENT_KINDS.map((kind) => [kind, 0])) as Record<
		PageElementKind,
		number
	>;

	for (const element of elements) {
		counts[element.kind] += 1;
	}

	return counts;
}

export function contentWithKinds(
	elements: readonly HistoryElement[],
	visibleKinds: ReadonlySet<PageElementKind>,
): HistoryElement[] {
	return elements.filter(({ kind }) => visibleKinds.has(kind));
}

export function toggledContentKinds(
	visibleKinds: ReadonlySet<PageElementKind>,
	kind: PageElementKind,
): Set<PageElementKind> {
	const next = new Set(visibleKinds);

	if (next.has(kind)) {
		next.delete(kind);
	} else {
		next.add(kind);
	}

	return next;
}
