import type { HistorySite } from "../../../core/types.ts";

export type HistorySiteListItem = HistorySite & {
	category?: string;
	displayName: string;
};

export type HistorySiteOrder = "captures" | "latest" | "name";

export type HistorySiteFilters = {
	category: string;
	order: HistorySiteOrder;
	query: string;
};

export function isHistorySiteOrder(value: string): value is HistorySiteOrder {
	return ["captures", "latest", "name"].includes(value);
}

export function filterHistorySites(
	sites: HistorySiteListItem[],
	filters: HistorySiteFilters,
): HistorySiteListItem[] {
	const query = filters.query.trim().toLocaleLowerCase("en-GB");
	const filtered = sites.filter((site) => {
		const matchesCategory = !filters.category || site.category === filters.category;
		const matchesQuery =
			!query ||
			`${site.displayName} ${site.site} ${site.sourceUrl}`
				.toLocaleLowerCase("en-GB")
				.includes(query);

		return matchesCategory && matchesQuery;
	});

	return filtered.sort((left, right) => {
		if (filters.order === "captures") {
			return right.captureCount - left.captureCount || left.displayName.localeCompare(right.displayName);
		}
		if (filters.order === "name") {
			return left.displayName.localeCompare(right.displayName);
		}
		return (
			Date.parse(right.lastCaptureAt) - Date.parse(left.lastCaptureAt) ||
			left.displayName.localeCompare(right.displayName)
		);
	});
}
