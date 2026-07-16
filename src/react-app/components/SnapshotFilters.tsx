import { displayName } from '../lib/format';

export type Filters = { brand: string; category: string; query: string };

type SnapshotFiltersProps = {
	brands: string[];
	filters: Filters;
	onChange: (filters: Filters) => void;
};

export function SnapshotFilters({ brands, filters, onChange }: SnapshotFiltersProps) {
	return (
		<div aria-label="Screenshot filters" className="filters">
			<label className="search-field">
				<span className="sr-only">Search snapshots</span>
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<circle cx="11" cy="11" r="7" />
					<path d="m16 16 5 5" />
				</svg>
				<input
					onChange={(event) => onChange({ ...filters, query: event.target.value })}
					placeholder="Search snapshots"
					type="search"
					value={filters.query}
				/>
			</label>
			<label>
				<span>Brand</span>
				<select
					onChange={(event) => onChange({ ...filters, brand: event.target.value })}
					value={filters.brand}
				>
					<option value="">All brands</option>
					{brands.map((brand) => (
						<option key={brand} value={brand}>
							{displayName(brand)}
						</option>
					))}
				</select>
			</label>
			<label>
				<span>Category</span>
				<select
					onChange={(event) => onChange({ ...filters, category: event.target.value })}
					value={filters.category}
				>
					<option value="">All categories</option>
					<option value="news">News</option>
					<option value="sport">Sport</option>
				</select>
			</label>
		</div>
	);
}
