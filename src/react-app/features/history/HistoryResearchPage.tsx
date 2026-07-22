import { PublisherComparisonPanel } from "./PublisherComparisonPanel.tsx";
import { displayName } from "../../shared/format.ts";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { HistoryImageTimeline } from "./HistoryImageTimeline.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistorySearchPanel } from "./HistorySearchPanel.tsx";
import { HistoryTrendPanel } from "./HistoryTrendPanel.tsx";
import { useHistoryResearch } from "./useHistoryResearch.ts";

export function HistoryResearchPage({
	preferredName,
	site,
}: {
	preferredName?: string;
	site: string;
}) {
	const research = useHistoryResearch(site);
	const siteName = displayName(site, preferredName);

	return (
		<div className="page-stack research-page">
			<PageHeader
				description="Find coverage, see what occupied the page, and review the imagery used over time."
				title={`${siteName} research`}
			/>
			<HistoryNav current="research" site={site} />
			<HistorySearchPanel
				error={research.searchError}
				hasMore={research.hasMoreResults}
				loading={research.searching}
				loadingMore={research.loadingMoreResults}
				onLoadMore={research.loadMoreResults}
				onQuery={research.changeQuery}
				onToggleContent={research.toggleContent}
				query={research.query}
				results={research.results}
				selectedContent={research.selectedContent}
				site={site}
			/>
			<HistoryTrendPanel
				error={research.trendError}
				loading={research.loadingTrends}
				mode={research.mode}
				onMode={research.changeMode}
				onPeriod={research.changePeriod}
				period={research.period}
				trends={research.trends}
			/>
			<PublisherComparisonPanel period={research.period} site={site} />
			<HistoryImageTimeline
				error={research.imageError}
				hasMore={research.hasMoreImages}
				images={research.images}
				loading={research.loadingImages}
				loadingMore={research.loadingMoreImages}
				month={research.month}
				onLoadMore={research.loadMoreImages}
				onMonth={research.changeMonth}
				site={site}
			/>
		</div>
	);
}
