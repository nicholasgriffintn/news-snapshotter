import { displayName } from "../../shared/format.ts";
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
		<div className="history-page research-page">
			<header className="history-heading history-heading--research">
				<div>
					<h1>{siteName} research</h1>
				</div>
				<div className="history-heading__intro">
					<p>Find coverage, see what occupied the page, and review the imagery used over time.</p>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{research.error ? <div className="history-alert">{research.error}</div> : null}
			<HistorySearchPanel
				loading={research.searching}
				onQuery={research.changeQuery}
				onToggleContent={research.toggleContent}
				query={research.query}
				results={research.results}
				selectedContent={research.selectedContent}
				siteName={siteName}
				site={site}
			/>
			<HistoryTrendPanel
				loading={research.loadingTrends}
				mode={research.mode}
				onMode={research.changeMode}
				onPeriod={research.changePeriod}
				period={research.period}
				trends={research.trends}
			/>
			<HistoryImageTimeline
				images={research.images}
				loading={research.loadingImages}
				month={research.month}
				onMonth={research.changeMonth}
				site={site}
			/>
		</div>
	);
}
