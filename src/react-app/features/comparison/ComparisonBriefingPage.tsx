import { useState } from "react";

import { Button } from "../../shared/Button.tsx";
import { CollectionControls, CollectionSummary } from "../../shared/CollectionSummary.tsx";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { ComparisonFilters } from "./ComparisonFilters.tsx";
import { ComparisonBriefingSkeleton } from "./ComparisonBriefingSkeleton.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { ComparisonStoryCard } from "./ComparisonStoryCard.tsx";
import { useComparisonData, useComparisonStoryPages } from "./comparison-api.ts";
import {
	EMPTY_COMPARISON_STORY_FILTERS,
	comparisonPeriodRange,
	comparisonStatusWindow,
	comparisonStoryFiltersActive,
	latestPublishedWindow,
} from "./domain/comparison-period.ts";
import type { ComparisonWindow } from "./domain/contracts.ts";

export function ComparisonBriefingPage() {
	const [filters, setFilters] = useState(EMPTY_COMPARISON_STORY_FILTERS);
	const windows = useComparisonData<{ windows: ComparisonWindow[] }>(
		"/api/comparison/windows?limit=24",
	);
	const latestWindow = latestPublishedWindow(windows.data?.windows ?? []);
	const statusWindow = comparisonStatusWindow(filters.period, latestWindow);
	const range = comparisonPeriodRange(filters.period, latestWindow?.endsAt, filters.date);
	const query = new URLSearchParams({ limit: "25" });

	if (range) {
		query.set("from", range.from);
		query.set("to", range.to);
	}
	if (filters.publisher) {
		query.set("publisher", filters.publisher);
	}
	if (filters.query.trim()) {
		query.set("q", filters.query.trim());
	}
	if (filters.topic) {
		query.set("topic", filters.topic);
	}

	const periodReady = filters.period === "latest" || Boolean(range);
	const stories = useComparisonStoryPages(
		periodReady ? `/api/comparison/stories?${query}` : undefined,
	);

	const allStories = stories.data?.stories ?? [];
	const options = stories.data?.facets ?? { publishers: [], topics: [] };
	const visibleStories = allStories;
	const filtersActive = comparisonStoryFiltersActive(filters);
	const initialLoading = stories.loading && !stories.data;
	const filtersLoading = initialLoading || (windows.loading && !windows.data);

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
			{!periodReady && !windows.loading ? (
				<StatusMessage role="status" tone="info">
					Select a valid reporting period before loading comparisons.
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

			{periodReady && !stories.loading && !stories.error && visibleStories.length === 0 ? (
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
					{visibleStories.map((story) => (
						<ComparisonStoryCard key={story.storyId} story={story} />
					))}
				</div>
			) : null}
			{stories.data?.cursor ? (
				<div className="research-pagination">
					<Button
						disabled={stories.loadingMore}
						onClick={() => void stories.loadMore()}
						variant="secondary"
					>
						{stories.loadingMore ? "Loading comparisons…" : "Load more comparisons"}
					</Button>
				</div>
			) : null}
		</section>
	);
}
