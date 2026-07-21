import { dateTimeLabel } from "../../shared/format.ts";
import { Badge } from "../../shared/Badge.tsx";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import type { ComparisonStorySummary, CoverageGap } from "./domain/contracts.ts";

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

export function ComparisonStoryCard({
	gap,
	story,
}: {
	gap?: CoverageGap;
	story: ComparisonStorySummary;
}) {
	const storyPath =
		`/compare/stories/${encodeURIComponent(story.storyId)}` +
		`?revision=${encodeURIComponent(story.revisionId)}`;
	const actionLabel =
		story.analysisStatus === "available" ? "Compare coverage" : "Review source evidence";
	const gapDetail = gap
		? `: not observed on ${gap.missingPublishers.map(({ displayName }) => displayName).join(", ")}`
		: "";

	return (
		<Card
			actionsAtBottom
			className={`history-site-card comparison-story-card${gap ? " comparison-story-card--gap" : ""}`}
		>
			<div className="ui-card-meta__copy">
				<h2 className="ui-card-title">
					<a href={storyPath}>{story.label}</a>
				</h2>
				<span className="ui-card-description--meta">
					<time dateTime={story.lastSeenAt}>Updated {dateTimeLabel(story.lastSeenAt)}</time>
					{gap ? (
						<>
							{' '}
							<Badge className="comparison-story-card__gap" tone="warning">
								<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
									<path d="M12 3 22 20H2L12 3Z" />
									<path d="M12 9v5" />
									<path d="M12 17h.01" />
								</svg>
								<span>Coverage gap</span>
								<span className="sr-only">{gapDetail}</span>
							</Badge>
						</>
					) : null}
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
