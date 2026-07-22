import { HistoryPage } from "./HistoryPage.tsx";
import { ElementHistoryPage } from "./ElementHistoryPage.tsx";
import { HistoryIndexPage } from "./HistoryIndexPage.tsx";
import { HistoryResearchPage } from "./HistoryResearchPage.tsx";
import { SavedTimelinePage } from "./SavedTimelinePage.tsx";
import { SavedTimelinesPage } from "./SavedTimelinesPage.tsx";
import { ContentComparisonPage } from "./ContentComparisonPage.tsx";
import { contentKeyFromSearch } from "./history-routes.ts";
import { useHistoryCatalogue } from "./useHistoryCatalogue.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { NoDataState } from "../../shared/NoDataState.tsx";

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
		return (
			<ContentComparisonPage elementKeys={elementKeys} preferredName={preferredName} site={site} />
		);
	}
	if (resource === "content") {
		const elementKey = contentKeyFromSearch(window.location.search);
		if (elementKey) {
			return (
				<ElementHistoryPage elementKey={elementKey} preferredName={preferredName} site={site} />
			);
		}
	}
	if (resource === "timelines") {
		return identifier ? (
			<SavedTimelinePage site={site} slug={identifier} />
		) : (
			<SavedTimelinesPage preferredName={preferredName} site={site} />
		);
	}
	if (!resource) {
		return <HistoryPage preferredName={preferredName} site={site} />;
	}
	return (
		<NoDataState
			action={
				<ButtonLink href={`/history/${encodeURIComponent(site)}`}>
					Return to site history
				</ButtonLink>
			}
			description="The requested history page does not exist or is no longer available."
			title="History page not found"
		/>
	);
}
