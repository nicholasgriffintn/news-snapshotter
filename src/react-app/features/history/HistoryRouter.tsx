import { HistoryPage } from "./HistoryPage.tsx";
import { ElementHistoryPage } from "./ElementHistoryPage.tsx";
import { HistoryIndexPage } from "./HistoryIndexPage.tsx";
import { HistoryResearchPage } from "./HistoryResearchPage.tsx";
import { SavedTimelinePage } from "./SavedTimelinePage.tsx";
import { ContentComparisonPage } from "./ContentComparisonPage.tsx";
import { contentKeyFromSearch } from "./history-routes.ts";
import { useHistoryCatalogue } from "./useHistoryCatalogue.ts";

export function HistoryRouter({ site }: { site: string }) {
	const catalogue = useHistoryCatalogue();
	const preferredName = catalogue.get(site)?.displayName;

	if (!site) {
		return <HistoryIndexPage catalogue={catalogue} />;
	}
	const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	const resource = segments[2];
	const identifier = segments[3];

	if (resource === "research") {
		return <HistoryResearchPage preferredName={preferredName} site={site} />;
	}
	if (resource === "compare") {
		const elementKeys = [...new Set(new URLSearchParams(window.location.search).getAll("element"))];
		return <ContentComparisonPage elementKeys={elementKeys} site={site} />;
	}
	if (resource === "content") {
		const elementKey = contentKeyFromSearch(window.location.search);
		if (elementKey) {
			return <ElementHistoryPage elementKey={elementKey} preferredName={preferredName} site={site} />;
		}
	}
	if (resource === "timelines" && identifier) {
		return <SavedTimelinePage site={site} slug={identifier} />;
	}
	return <HistoryPage preferredName={preferredName} site={site} />;
}
