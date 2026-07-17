import { HistoryPage } from "./HistoryPage.tsx";
import { HistoryIndexPage } from "./HistoryIndexPage.tsx";
import { HistoryResearchPage } from "./HistoryResearchPage.tsx";
import { SavedTimelinePage } from "./SavedTimelinePage.tsx";
import { StoryComparisonPage } from "./StoryComparisonPage.tsx";
import { StoryHistoryPage } from "./StoryHistoryPage.tsx";
import { storyIdFromSearch } from "./history-routes.ts";

export function HistoryRouter({ site }: { site: string }) {
	if (!site) return <HistoryIndexPage />;
	const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	const resource = segments[2];
	const identifier = segments[3];

	if (resource === "research") return <HistoryResearchPage site={site} />;
	if (resource === "compare") {
		const storyIds = [...new Set(new URLSearchParams(window.location.search).getAll("story"))];
		return <StoryComparisonPage site={site} storyIds={storyIds} />;
	}
	if (resource === "stories") {
		const storyId = storyIdFromSearch(window.location.search);
		if (storyId) return <StoryHistoryPage site={site} storyId={storyId} />;
	}
	if (resource === "timelines" && identifier) {
		return <SavedTimelinePage site={site} slug={identifier} />;
	}
	return <HistoryPage site={site} />;
}
