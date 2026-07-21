import { useMemo, useState } from "react";

import type { CatalogueSite, HistorySite } from "../../core/types.ts";
import { Button } from "../../shared/Button.tsx";
import { CollectionControls, CollectionSummary } from "../../shared/CollectionSummary.tsx";
import { FilterPanel, SearchField, SelectField } from "../../shared/Filters.tsx";
import { displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import {
	filterHistorySites,
	isHistorySiteOrder,
	type HistorySiteFilters,
} from "./domain/history-site-filter.ts";
import { HistorySiteCard } from "./HistorySiteCard.tsx";
import { HistorySiteSkeleton } from "./HistorySiteSkeleton.tsx";

const EMPTY_FILTERS: HistorySiteFilters = {
	category: "",
	order: "latest",
	query: "",
};

export function HistorySiteDirectory({
	catalogue,
	loading,
	sites,
}: {
	catalogue: ReadonlyMap<string, CatalogueSite>;
	loading: boolean;
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
		() =>
			[
				...new Set(
					items
						.map(({ category }) => category)
						.filter((category): category is NonNullable<CatalogueSite["category"]> =>
							Boolean(category),
						),
				),
			].sort(),
		[items],
	);
	const filtered = useMemo(() => filterHistorySites(items, filters), [filters, items]);
	const filtersActive = Boolean(filters.category || filters.query || filters.order !== "latest");
	const clearFilters = () => setFilters(EMPTY_FILTERS);

	return (
		<>
			<CollectionControls>
				<FilterPanel ariaLabel="History site filters" className="history-site-filters">
					<SearchField
						disabled={loading}
						onChange={(query) => setFilters({ ...filters, query })}
						placeholder="Search publishers"
						value={filters.query}
					/>
					<SelectField
						disabled={loading}
						label="Section"
						onChange={(category) => setFilters({ ...filters, category })}
						options={[
							{ label: "All sections", value: "" },
							...categories.map((category) => ({
								label: displayName(category),
								value: category,
							})),
						]}
						value={filters.category}
					/>
					<SelectField
						disabled={loading}
						label="Order"
						onChange={(order) => {
							if (isHistorySiteOrder(order)) {
								setFilters({ ...filters, order });
							}
						}}
						options={[
							{ label: "Recently updated", value: "latest" },
							{ label: "Publisher name", value: "name" },
							{ label: "Most captures", value: "captures" },
						]}
						value={filters.order}
					/>
				</FilterPanel>

				<CollectionSummary
					action={
						filtersActive ? (
							<Button onClick={clearFilters} variant="quiet">
								Clear filters
							</Button>
						) : null
					}
					label={
						loading ? (
							<span aria-hidden="true" className="history-site-summary-skeleton" />
						) : (
							`${filtered.length} ${filtered.length === 1 ? "history" : "histories"}`
						)
					}
				/>
			</CollectionControls>

			{loading ? <HistorySiteSkeleton /> : null}
			{!loading && filtered.length > 0 ? (
				<div className="history-site-grid">
					{filtered.map((site) => (
						<HistorySiteCard key={site.site} site={site} />
					))}
				</div>
			) : !loading ? (
				<NoDataState
					action={filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : null}
					description="Try another publisher name or remove one of the active filters."
					title="No publisher histories found"
				/>
			) : null}
		</>
	);
}
