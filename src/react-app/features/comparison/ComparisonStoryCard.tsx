import { dateTimeLabel } from "../../shared/format.ts";
import { Badge } from "../../shared/Badge.tsx";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import type { ComparisonStorySummary } from "./domain/contracts.ts";

function prominenceLabel(value: number): string {
	switch (value) {
		case 4:
			return "Lead";
		case 3:
			return "Major";
		case 2:
			return "Standard";
		case 1:
			return "Minor";
		default:
			return "Not ranked";
	}
}

export function ComparisonStoryCard({ story }: { story: ComparisonStorySummary }) {
	const storyPath =
		`/compare/stories/${encodeURIComponent(story.storyId)}` +
		`?revision=${encodeURIComponent(story.revisionId)}`;
	const actionLabel =
		story.analysisStatus === "available" ? "Compare coverage" : "Review source evidence";

	return (
		<Card actionsAtBottom className="history-site-card comparison-story-card">
			<div className="ui-card-meta__copy">
				<h2 className="ui-card-title">
					<a href={storyPath}>{story.label}</a>
				</h2>
				<span className="ui-card-description--meta">
					<time dateTime={story.lastSeenAt}>Updated {dateTimeLabel(story.lastSeenAt)}</time>
				</span>
			</div>

			<p className="ui-card-description comparison-story-card__summary">{story.summary}</p>

			<ul aria-label="Participating publishers" className="comparison-story-card__publishers">
				{story.publishers.map((publisher) => (
					<Badge as="li" key={publisher.site}>
						{publisher.displayName}
					</Badge>
				))}
			</ul>

			<dl className="ui-card-stats">
				<div>
					<dt>Publishers</dt>
					<dd>{story.sourceCount.toLocaleString("en-GB")}</dd>
				</div>

				<div>
					<dt>Highest placement</dt>
					<dd className="comparison-story-card__prominence">
						{prominenceLabel(story.maxProminence)}
					</dd>
				</div>
			</dl>

			<div className="ui-card-actions">
				<ButtonLink href={storyPath} layout="card">
					{actionLabel}
					<span aria-hidden="true">→</span>
				</ButtonLink>
			</div>
		</Card>
	);
}
