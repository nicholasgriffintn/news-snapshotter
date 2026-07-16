import { useEffect, useMemo, useState } from 'react';

import { fetchSnapshots } from '../lib/api';
import {
	DEFAULT_ARCHIVE_PERIOD,
	periodDescription,
} from '../lib/archive-period';
import { captureWindowKey, groupLabel } from '../lib/format';
import { filterSnapshots } from '../lib/snapshot-filter';
import type { Snapshot } from '../types';
import { SnapshotCard } from './SnapshotCard';
import { SnapshotFilters, type Filters } from './SnapshotFilters';
import { SnapshotModal } from './SnapshotModal';

const EMPTY_FILTERS: Filters = {
	brand: '',
	category: '',
	query: '',
	...DEFAULT_ARCHIVE_PERIOD,
};

export function SnapshotGallery() {
	const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
	const [filters, setFilters] = useState(EMPTY_FILTERS);
	const [selected, setSelected] = useState<Snapshot>();
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		fetchSnapshots()
			.then(setSnapshots)
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setLoading(false));
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
	const groups = Map.groupBy(filtered, ({ capturedAt }) => captureWindowKey(capturedAt));

	return (
		<>
			<SnapshotFilters brands={brands} filters={filters} onChange={setFilters} />
			<div className="gallery-status">
				<span>
					<strong>{periodDescription(filters)}</strong>
					{filtered.length} captures
				</span>
				<button onClick={() => setFilters(EMPTY_FILTERS)} type="button">
					Clear filters
				</button>
			</div>

			{loading ? <div className="empty-state">Loading the archive…</div> : null}
			{error ? (
				<div className="empty-state empty-state--error">Could not load snapshots. {error}</div>
			) : null}
			{!loading && !error && filtered.length === 0 ? (
				<div className="empty-state">No snapshots match those filters.</div>
			) : null}

			{[...groups].map(([capturedAt, items], groupIndex) => (
				<section
					className="capture-group"
					key={capturedAt}
					style={{ '--group-index': groupIndex } as React.CSSProperties}
				>
					<div className="capture-group__heading">
						<h2>{groupLabel(capturedAt)}</h2>
						<span>{items.length} captures</span>
					</div>
					<div className="snapshot-grid">
						{items.map((snapshot) => (
							<SnapshotCard
								key={snapshot.key}
								onSelect={() => setSelected(snapshot)}
								snapshot={snapshot}
							/>
						))}
					</div>
				</section>
			))}

			{selected ? (
				<SnapshotModal onClose={() => setSelected(undefined)} snapshot={selected} />
			) : null}
		</>
	);
}
