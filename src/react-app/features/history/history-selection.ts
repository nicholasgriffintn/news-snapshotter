export const MAXIMUM_CONTENT_COMPARISON_ITEMS = 10;

export function toggleContentSelection(
	current: ReadonlySet<string>,
	elementKey: string,
): Set<string> {
	const next = new Set(current);
	if (next.has(elementKey)) {
		next.delete(elementKey);
	} else if (next.size < MAXIMUM_CONTENT_COMPARISON_ITEMS) {
		next.add(elementKey);
	}
	return next;
}
