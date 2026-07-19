import { useMemo, useState } from "react";

import type { CatalogueSite, HistorySite } from "../../core/types.ts";
import { displayName } from "../../shared/format.ts";
import {
	filterHistorySites,
	isHistorySiteOrder,
	type HistorySiteFilters,
} from "./domain/history-site-filter.ts";
import { HistorySiteCard } from "./HistorySiteCard.tsx";

const EMPTY_FILTERS: HistorySiteFilters = {
	category: "",
	order: "latest",
	query: "",
};

export function HistorySiteDirectory({
	catalogue,
	sites,
}: {
	catalogue: ReadonlyMap<string, CatalogueSite>;
	sites: HistorySite[];
}) {
	const [filters, setFilters] = useState(EMPTY_FILTERS);
	const items = useMemo(
		() =>
			sites.map((site) => {
				const definition = catalogue.get(site.site);
				return {
					...site,
					category: definition?.category,
					displayName: displayName(site.site, definition?.displayName),
				};
			}),
		[catalogue, sites],
	);
	const categories = useMemo(
		() => [
			...new Set(
				items
					.map(({ category }) => category)
					.filter(
						(category): category is NonNullable<CatalogueSite["category"]> => Boolean(category),
					),
			),
		].sort(),
		[items],
	);
	const filtered = useMemo(() => filterHistorySites(items, filters), [filters, items]);
	const filtersActive = Boolean(filters.category || filters.query || filters.order !== "latest");

	return (
		<>
			<section aria-label="History site filters" className="filters history-site-filters">
				<label className="search-field filter-field">
					<span className="sr-only">Search site histories</span>
					<svg aria-hidden="true" viewBox="0 0 24 24">
						<circle cx="11" cy="11" r="7" />
						<path d="m16 16 5 5" />
					</svg>
					<input
						onChange={(event) => setFilters({ ...filters, query: event.target.value })}
						placeholder="Search publishers"
						type="search"
						value={filters.query}
					/>
				</label>
				<label className="filter-field">
					<span>Section</span>
					<select
						onChange={(event) => setFilters({ ...filters, category: event.target.value })}
						value={filters.category}
					>
						<option value="">All sections</option>
						{categories.map((category) => (
							<option key={category} value={category}>{displayName(category)}</option>
						))}
					</select>
				</label>
				<label className="filter-field">
					<span>Order</span>
					<select
						onChange={(event) => {
							if (isHistorySiteOrder(event.target.value)) {
								setFilters({ ...filters, order: event.target.value });
							}
						}}
						value={filters.order}
					>
						<option value="latest">Recently updated</option>
						<option value="name">Publisher name</option>
						<option value="captures">Most captures</option>
					</select>
				</label>
			</section>

			<div className="gallery-status history-site-status">
				<span><strong>{filtered.length}</strong>{filtered.length === 1 ? "history" : "histories"} available</span>
				{filtersActive ? (
					<button onClick={() => setFilters(EMPTY_FILTERS)} type="button">Clear filters</button>
				) : null}
			</div>

			{filtered.length > 0 ? (
				<div className="history-site-grid">
					{filtered.map((site) => <HistorySiteCard key={site.site} site={site} />)}
				</div>
			) : (
				<div className="empty-state">No site histories match those filters.</div>
			)}
		</>
	);
}
