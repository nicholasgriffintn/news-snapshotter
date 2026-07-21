import { useEffect, useMemo, useState } from "react";

import { fetchAvailableHistorySites, fetchSnapshots } from "../../platform/api-client.ts";
import { Button } from "../../shared/Button.tsx";
import { CollectionControls, CollectionSummary } from "../../shared/CollectionSummary.tsx";
import { captureWindowKey, groupLabel } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import type { Snapshot, SnapshotGroup } from "../../core/types.ts";
import {
	DEFAULT_ARCHIVE_PERIOD,
	archiveStorageDates,
	periodDescription,
} from "./domain/archive-period.ts";
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

	const storageDates = archiveStorageDates(filters, now);
	const storageDateKey = storageDates.join(",");

	useEffect(() => {
		if (storageDates.length === 0) {
			setSnapshots([]);
			setError("");
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setError("");
		setLoading(true);
		fetchSnapshots(storageDates, { signal: controller.signal })
			.then(setSnapshots)
			.catch((reason: Error) => {
				if (!controller.signal.aborted) {
					setError(reason.message);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, [storageDateKey]);

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
	const filtersActive = Boolean(
		filters.brand ||
		filters.category ||
		filters.query ||
		filters.period !== DEFAULT_ARCHIVE_PERIOD.period ||
		(filters.period === "day" && filters.day),
	);

	return (
		<>
			<CollectionControls
				summary={
					<CollectionSummary
						action={
							filtersActive ? (
								<Button onClick={() => setFilters(EMPTY_FILTERS)} variant="quiet">
									Clear filters
								</Button>
							) : null
						}
						details={`${groupedSnapshots.length} pages · ${filtered.length} variants`}
						label={periodDescription(filters)}
					/>
				}
			>
				<SnapshotFilters brands={brands} filters={filters} onChange={setFilters} />
			</CollectionControls>

			{loading ? (
				<>
					<p aria-live="polite" className="sr-only">
						Loading the archive…
					</p>
					<ArchiveSkeleton />
				</>
			) : null}
			{error ? (
				<StatusMessage role="alert" tone="error">
					Could not load snapshots. {error}
				</StatusMessage>
			) : null}
			{!loading && !error && groupedSnapshots.length === 0 ? (
				<NoDataState
					action={
						<Button
							onClick={() =>
								setFilters(
									filtersActive ? EMPTY_FILTERS : { ...EMPTY_FILTERS, period: "last-24-hours" },
								)
							}
						>
							{filtersActive ? "Clear filters" : "Show the last 24 hours"}
						</Button>
					}
					description={
						filtersActive
							? "Try removing a search term or widening the selected date range."
							: "No captures have landed in the last three hours. Try a wider window."
					}
					title="No snapshots found"
				/>
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
