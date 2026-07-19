import { useEffect, useMemo, useState } from "react";

import { fetchAvailableHistorySites, fetchSnapshots } from "../../platform/api-client.ts";
import { captureWindowKey, groupLabel } from "../../shared/format.ts";
import type { Snapshot, SnapshotGroup } from "../../core/types.ts";
import { DEFAULT_ARCHIVE_PERIOD, periodDescription } from "./domain/archive-period.ts";
import { filterSnapshots } from "./domain/snapshot-filter.ts";
import { groupSnapshotVariants } from "./domain/snapshot-groups.ts";
import { SnapshotCard } from "./SnapshotCard";
import { SnapshotFilters, type Filters } from "./SnapshotFilters";
import { SnapshotModal } from "./SnapshotModal";
import { ArchiveSkeleton } from "./ArchiveSkeleton";

const EMPTY_FILTERS: Filters = {
	brand: "",
	category: "",
	query: "",
	...DEFAULT_ARCHIVE_PERIOD,
};

export function SnapshotGallery() {
	const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
	const [analysedSites, setAnalysedSites] = useState<Set<string>>(new Set());
	const [filters, setFilters] = useState(EMPTY_FILTERS);
	const [selected, setSelected] = useState<SnapshotGroup>();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		fetchSnapshots()
			.then(setSnapshots)
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		fetchAvailableHistorySites()
			.then((sites) => setAnalysedSites(new Set(sites)))
			.catch(() => setAnalysedSites(new Set()));
	}, []);

	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(timer);
	}, []);

	const filtered = useMemo(() => {
		return filterSnapshots(snapshots, filters, now);
	}, [filters, now, snapshots]);

	const brands = useMemo(() => {
		return [...new Set(snapshots.map(({ brand }) => brand))].sort();
	}, [snapshots]);
	const groupedSnapshots = groupSnapshotVariants(filtered);
	const groups = Map.groupBy(groupedSnapshots, ({ capturedAt }) => captureWindowKey(capturedAt));

	return (
		<>
			<SnapshotFilters brands={brands} filters={filters} onChange={setFilters} />
			<div className="gallery-status">
				<span>
					<strong>{periodDescription(filters)}</strong>
					{groupedSnapshots.length} pages · {filtered.length} variants
				</span>
				<button onClick={() => setFilters(EMPTY_FILTERS)} type="button">
					Clear filters
				</button>
			</div>

			{loading ? (
				<>
					<p aria-live="polite" className="sr-only">
						Loading the archive…
					</p>
					<ArchiveSkeleton />
				</>
			) : null}
			{error ? (
				<div className="empty-state empty-state--error">Could not load snapshots. {error}</div>
			) : null}
			{!loading && !error && groupedSnapshots.length === 0 ? (
				<div className="empty-state">No snapshots match those filters.</div>
			) : null}

			{[...groups].map(([capturedAt, items], groupIndex) => (
				<section
					className="capture-group"
					key={capturedAt}
					style={{ "--group-index": Math.min(groupIndex, 4) } as React.CSSProperties}
				>
					<div className="capture-group__heading">
						<h2>{groupLabel(capturedAt)}</h2>
						<span>{items.length} pages</span>
					</div>
					<div className="snapshot-grid">
						{items.map((group) => (
							<SnapshotCard
								analysed={analysedSites.has(group.name)}
								group={group}
								key={`${group.name}-${group.capturedAt}`}
								onSelect={() => setSelected(group)}
							/>
						))}
					</div>
				</section>
			))}

			{selected ? <SnapshotModal group={selected} onClose={() => setSelected(undefined)} /> : null}
		</>
	);
}
