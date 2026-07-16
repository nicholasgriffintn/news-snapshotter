import { useEffect, useMemo, useState } from 'react';

import { fetchSnapshots } from '../lib/api';
import { groupLabel } from '../lib/format';
import type { Snapshot } from '../types';
import { SnapshotCard } from './SnapshotCard';
import { SnapshotFilters, type Filters } from './SnapshotFilters';
import { SnapshotModal } from './SnapshotModal';

const EMPTY_FILTERS: Filters = { brand: '', category: '', query: '' };

export function SnapshotGallery() {
	const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
	const [filters, setFilters] = useState(EMPTY_FILTERS);
	const [selected, setSelected] = useState<Snapshot>();
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchSnapshots()
			.then(setSnapshots)
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setLoading(false));
	}, []);

	const filtered = useMemo(() => {
		return snapshots.filter((snapshot) => {
			const query = filters.query.trim().toLowerCase();
			const matchesBrand = !filters.brand || snapshot.brand === filters.brand;
			const matchesCategory = !filters.category || snapshot.category === filters.category;
			const matchesQuery = !query || `${snapshot.name} ${snapshot.brand}`.includes(query);

			return matchesBrand && matchesCategory && matchesQuery;
		});
	}, [filters, snapshots]);

	const brands = useMemo(() => {
		return [...new Set(snapshots.map(({ brand }) => brand))].sort();
	}, [snapshots]);
	const groups = Map.groupBy(filtered, ({ capturedAt }) => capturedAt);

	return (
		<>
			<SnapshotFilters brands={brands} filters={filters} onChange={setFilters} />
			<div className="gallery-status">
				<span>{filtered.length} captures</span>
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
