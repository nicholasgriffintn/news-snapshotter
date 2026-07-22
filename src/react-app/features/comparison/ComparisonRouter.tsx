import { ComparisonBriefingPage } from "./ComparisonBriefingPage.tsx";
import { StoryComparisonPage } from "./StoryComparisonPage.tsx";
import { ButtonLink } from "../../shared/Button.tsx";
import { NoDataState } from "../../shared/NoDataState.tsx";

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
	if (segments.length === 1) {
		return <ComparisonBriefingPage />;
	}
	return (
		<NoDataState
			action={<ButtonLink href="/compare">Return to comparisons</ButtonLink>}
			description="The requested comparison page does not exist or is no longer available."
			title="Comparison not found"
		/>
	);
}
