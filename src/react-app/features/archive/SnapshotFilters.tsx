import { displayName } from "../../shared/format.ts";
import { FilterPanel, SearchField, SelectField } from "../../shared/Filters.tsx";
import type { SnapshotFilter } from "./domain/snapshot-filter.ts";
import { DateFilter } from "./DateFilter";

export type Filters = SnapshotFilter;

type SnapshotFiltersProps = {
	brands: string[];
	filters: Filters;
	onChange: (filters: Filters) => void;
};

export function SnapshotFilters({ brands, filters, onChange }: SnapshotFiltersProps) {
	return (
		<FilterPanel ariaLabel="Screenshot filters">
			<SearchField
				onChange={(query) => onChange({ ...filters, query })}
				placeholder="Search snapshots"
				value={filters.query}
			/>
			<SelectField
				label="Brand"
				onChange={(brand) => onChange({ ...filters, brand })}
				options={[
					{ label: "All brands", value: "" },
					...brands.map((brand) => ({ label: displayName(brand), value: brand })),
				]}
				value={filters.brand}
			/>
			<SelectField
				label="Category"
				onChange={(category) => onChange({ ...filters, category })}
				options={[
					{ label: "All categories", value: "" },
					{ label: "News", value: "news" },
					{ label: "Sport", value: "sport" },
				]}
				value={filters.category}
			/>
			<DateFilter
				day={filters.day}
				onChange={(period, day = filters.day) => onChange({ ...filters, day, period })}
				period={filters.period}
			/>
		</FilterPanel>
	);
}
