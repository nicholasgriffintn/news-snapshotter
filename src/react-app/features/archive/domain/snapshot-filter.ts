import type { Snapshot } from "../../../core/types.ts";
import type { ArchivePeriodFilter } from "./archive-period.ts";
import { matchesArchivePeriod } from "./archive-period.ts";

export type SnapshotFilter = ArchivePeriodFilter & {
	brand: string;
	category: string;
	query: string;
};

type FilterableSnapshot = Pick<Snapshot, "brand" | "capturedAt" | "category" | "name">;

export function filterSnapshots<T extends FilterableSnapshot>(
	snapshots: T[],
	filters: SnapshotFilter,
	now = new Date(),
): T[] {
	const query = filters.query.trim().toLowerCase();

	return snapshots.filter((snapshot) => {
		const matchesBrand = !filters.brand || snapshot.brand === filters.brand;
		const matchesCategory = !filters.category || snapshot.category === filters.category;
		const matchesQuery =
			!query || `${snapshot.name} ${snapshot.brand}`.toLowerCase().includes(query);

		return (
			matchesBrand &&
			matchesCategory &&
			matchesQuery &&
			matchesArchivePeriod(snapshot.capturedAt, filters, now)
		);
	});
}
