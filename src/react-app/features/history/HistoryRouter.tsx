import { HistoryPage } from "./HistoryPage.tsx";
import { ElementHistoryPage } from "./ElementHistoryPage.tsx";
import { HistoryIndexPage } from "./HistoryIndexPage.tsx";
import { HistoryResearchPage } from "./HistoryResearchPage.tsx";
import { SavedTimelinePage } from "./SavedTimelinePage.tsx";
import { ContentComparisonPage } from "./ContentComparisonPage.tsx";
import { contentKeyFromSearch } from "./history-routes.ts";

export function HistoryRouter({ site }: { site: string }) {
	if (!site) {
		return <HistoryIndexPage />;
	}
	const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	const resource = segments[2];
	const identifier = segments[3];

	if (resource === "research") {
		return <HistoryResearchPage site={site} />;
	}
	if (resource === "compare") {
		const elementKeys = [...new Set(new URLSearchParams(window.location.search).getAll("element"))];
		return <ContentComparisonPage elementKeys={elementKeys} site={site} />;
	}
	if (resource === "content") {
		const elementKey = contentKeyFromSearch(window.location.search);
		if (elementKey) {
			return <ElementHistoryPage elementKey={elementKey} site={site} />;
		}
	}
	if (resource === "timelines" && identifier) {
		return <SavedTimelinePage site={site} slug={identifier} />;
	}
	return <HistoryPage site={site} />;
}
