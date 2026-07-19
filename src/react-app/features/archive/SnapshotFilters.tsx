import { useId } from "react";

import { displayName } from "../../shared/format.ts";
import type { SnapshotFilter } from "./domain/snapshot-filter.ts";
import { DateFilter } from "./DateFilter";

export type Filters = SnapshotFilter;

type SnapshotFiltersProps = {
	brands: string[];
	filters: Filters;
	onChange: (filters: Filters) => void;
};

export function SnapshotFilters({ brands, filters, onChange }: SnapshotFiltersProps) {
	const searchId = useId();
	const brandId = useId();
	const categoryId = useId();

	return (
		<section aria-label="Screenshot filters" className="filters">
			<div className="search-field filter-field">
				<label htmlFor={searchId}>Search</label>
				<div className="search-field__control">
					<svg aria-hidden="true" viewBox="0 0 24 24">
						<circle cx="11" cy="11" r="7" />
						<path d="m16 16 5 5" />
					</svg>
					<input
						id={searchId}
						onChange={(event) => onChange({ ...filters, query: event.target.value })}
						placeholder="Search snapshots"
						type="search"
						value={filters.query}
					/>
				</div>
			</div>
			<div className="filter-field">
				<label htmlFor={brandId}>Brand</label>
				<select
					id={brandId}
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
			</div>
			<div className="filter-field">
				<label htmlFor={categoryId}>Category</label>
				<select
					id={categoryId}
					onChange={(event) => onChange({ ...filters, category: event.target.value })}
					value={filters.category}
				>
					<option value="">All categories</option>
					<option value="news">News</option>
					<option value="sport">Sport</option>
				</select>
			</div>
			<DateFilter
				day={filters.day}
				onChange={(period, day = filters.day) => onChange({ ...filters, day, period })}
				period={filters.period}
			/>
		</section>
	);
}
