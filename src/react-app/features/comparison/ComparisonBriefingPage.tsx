import { useMemo, useState } from "react";

import { Button } from "../../shared/Button.tsx";
import { CollectionControls, CollectionSummary } from "../../shared/CollectionSummary.tsx";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { ComparisonFilters } from "./ComparisonFilters.tsx";
import { ComparisonBriefingSkeleton } from "./ComparisonBriefingSkeleton.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { ComparisonStoryCard } from "./ComparisonStoryCard.tsx";
import { useComparisonData } from "./comparison-api.ts";
import {
	EMPTY_COMPARISON_STORY_FILTERS,
	comparisonPeriodRange,
	comparisonStatusWindow,
	comparisonStoryFiltersActive,
	filterComparisonStories,
	latestPublishedWindow,
} from "./domain/comparison-period.ts";
import type { ComparisonStorySummary, ComparisonWindow, CoverageGap } from "./domain/contracts.ts";

function filterOptions(stories: readonly ComparisonStorySummary[]) {
	const publishers = new Map<string, { displayName: string; site: string }>();

	for (const story of stories) {
		for (const publisher of story.publishers) {
			publishers.set(publisher.site, publisher);
		}
	}

	return {
		publishers: [...publishers.values()].sort((left, right) =>
			left.displayName.localeCompare(right.displayName),
		),
		topics: [...new Set(stories.flatMap((story) => story.topics))].sort(),
	};
}

export function ComparisonBriefingPage() {
	const [filters, setFilters] = useState(EMPTY_COMPARISON_STORY_FILTERS);
	const windows = useComparisonData<{ windows: ComparisonWindow[] }>(
		"/api/comparison/windows?limit=24",
	);
	const latestWindow = latestPublishedWindow(windows.data?.windows ?? []);
	const statusWindow = comparisonStatusWindow(filters.period, latestWindow);
	const range = comparisonPeriodRange(filters.period, latestWindow?.endsAt, filters.date);
	const query = new URLSearchParams({ limit: "100" });

	if (range) {
		query.set("from", range.from);
		query.set("to", range.to);
	}

	const stories = useComparisonData<{ stories: ComparisonStorySummary[] }>(
		`/api/comparison/stories?${query}`,
	);
	const coverageGaps = useComparisonData<{ gaps: CoverageGap[] }>("/api/comparison/gaps?limit=100");
	const allStories = stories.data?.stories ?? [];
	const options = useMemo(() => filterOptions(allStories), [allStories]);
	const visibleStories = useMemo(
		() => filterComparisonStories(allStories, filters),
		[allStories, filters],
	);
	const filtersActive = comparisonStoryFiltersActive(filters);
	const initialLoading = stories.loading && !stories.data;
	const filtersLoading = initialLoading || (windows.loading && !windows.data);
	const showCoverageGaps = filters.period === "latest" && !filtersActive;
	const gapByRevision = useMemo(
		() =>
			new Map(
				(coverageGaps.data?.gaps ?? []).map((gap) => [`${gap.storyId}:${gap.revisionId}`, gap]),
			),
		[coverageGaps.data?.gaps],
	);

	return (
		<section className="page-stack comparison-page">
			<PageHeader
				description="See how stories, prominence and wording differed across captured UK news homepages."
				title="Compare coverage"
			/>

			<CollectionControls>
				<ComparisonFilters
					filters={filters}
					loading={filtersLoading}
					onChange={setFilters}
					publishers={options.publishers}
					topics={options.topics}
				/>

				{initialLoading || stories.data || statusWindow || filtersActive ? (
					<CollectionSummary
						action={
							filtersActive ? (
								<Button onClick={() => setFilters(EMPTY_COMPARISON_STORY_FILTERS)} variant="quiet">
									Clear filters
								</Button>
							) : null
						}
						details={
							statusWindow
								? `${statusWindow.capturedSites} of ${statusWindow.expectedSites} publishers captured · ${statusWindow.analysedSites} analysed`
								: null
						}
						label={
							initialLoading ? (
								<span aria-hidden="true" className="comparison-skeleton__summary" />
							) : stories.data ? (
								`${visibleStories.length} ${visibleStories.length === 1 ? "comparison" : "comparisons"}`
							) : (
								"Comparison status"
							)
						}
					/>
				) : null}
			</CollectionControls>

			{stories.error ? (
				<StatusMessage role="alert" tone="error">
					{stories.error}
				</StatusMessage>
			) : null}

			{initialLoading ? (
				<>
					<p aria-live="polite" className="sr-only">
						Loading comparisons…
					</p>
					<ComparisonBriefingSkeleton />
				</>
			) : null}

			{!initialLoading && showCoverageGaps && coverageGaps.error ? (
				<StatusMessage compact role="status" tone="info">
					Coverage gap indicators are currently unavailable.
				</StatusMessage>
			) : null}

			{!initialLoading && showCoverageGaps && coverageGaps.loading && !coverageGaps.data ? (
				<StatusMessage compact role="status">
					Checking coverage gaps…
				</StatusMessage>
			) : null}

			{!stories.loading && !stories.error && visibleStories.length === 0 ? (
				<NoDataState
					action={
						filtersActive ? (
							<Button onClick={() => setFilters(EMPTY_COMPARISON_STORY_FILTERS)}>
								Clear filters
							</Button>
						) : null
					}
					description={
						filtersActive
							? "Try another publisher, topic or reporting period."
							: "Published comparisons will appear here once enough captured evidence is available."
					}
					title="No coverage comparisons found"
				/>
			) : null}

			{visibleStories.length > 0 ? (
				<div className="history-site-grid comparison-story-grid">
					{visibleStories.map((story) => {
						const gap = showCoverageGaps
							? gapByRevision.get(`${story.storyId}:${story.revisionId}`)
							: undefined;

						return <ComparisonStoryCard gap={gap} key={story.storyId} story={story} />;
					})}
				</div>
			) : null}
		</section>
	);
}
