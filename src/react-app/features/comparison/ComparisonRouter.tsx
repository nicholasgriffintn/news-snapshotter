import { ComparisonBriefingPage } from "./ComparisonBriefingPage.tsx";
import { StoryComparisonPage } from "./StoryComparisonPage.tsx";

export function ComparisonRouter() {
	const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	if (segments[1] === "stories" && segments[2]) {
		return (
			<StoryComparisonPage
				revisionId={new URLSearchParams(window.location.search).get("revision") ?? undefined}
				storyId={segments[2]}
			/>
		);
	}
	if (segments[1] === "gaps") {
		return <ComparisonBriefingPage />;
	}
	return <ComparisonBriefingPage />;
}
