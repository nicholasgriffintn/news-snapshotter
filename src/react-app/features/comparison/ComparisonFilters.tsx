import { useId } from "react";

import { FilterField, FilterPanel, SearchField, SelectField } from "../../shared/Filters.tsx";
import { isComparisonPeriod, type ComparisonStoryFilters } from "./domain/comparison-period.ts";

type PublisherOption = {
	displayName: string;
	site: string;
};

export function ComparisonFilters({
	filters,
	loading,
	onChange,
	publishers,
	topics,
}: {
	filters: ComparisonStoryFilters;
	loading: boolean;
	onChange: (filters: ComparisonStoryFilters) => void;
	publishers: PublisherOption[];
	topics: string[];
}) {
	const periodId = useId();
	const dateId = useId();

	return (
		<FilterPanel ariaLabel="Comparison filters" className="comparison-filters">
			<SearchField
				disabled={loading}
				onChange={(query) => onChange({ ...filters, query })}
				placeholder="Search comparisons"
				value={filters.query}
			/>
			<SelectField
				disabled={loading}
				label="Topic"
				onChange={(topic) => onChange({ ...filters, topic })}
				options={[
					{ label: "All topics", value: "" },
					...topics.map((topic) => ({ label: topic, value: topic })),
				]}
				value={filters.topic}
			/>
			<SelectField
				disabled={loading}
				label="Publisher"
				onChange={(publisher) => onChange({ ...filters, publisher })}
				options={[
					{ label: "All publishers", value: "" },
					...publishers.map((publisher) => ({
						label: publisher.displayName,
						value: publisher.site,
					})),
				]}
				value={filters.publisher}
			/>
			<FilterField className="comparison-period-field" htmlFor={periodId} label="Period">
				<select
					disabled={loading}
					id={periodId}
					onChange={(event) => {
						if (isComparisonPeriod(event.target.value)) {
							onChange({ ...filters, period: event.target.value });
						}
					}}
					value={filters.period}
				>
					<option value="latest">Latest window</option>
					<option value="6h">Last 6 hours</option>
					<option value="24h">Last 24 hours</option>
					<option value="date">Choose date</option>
				</select>
				{filters.period === "date" ? (
					<>
						<label className="sr-only" htmlFor={dateId}>
							Comparison date
						</label>
						<input
							disabled={loading}
							id={dateId}
							max={new Date().toISOString().slice(0, 10)}
							onChange={(event) => onChange({ ...filters, date: event.target.value })}
							type="date"
							value={filters.date}
						/>
					</>
				) : null}
			</FilterField>
		</FilterPanel>
	);
}
