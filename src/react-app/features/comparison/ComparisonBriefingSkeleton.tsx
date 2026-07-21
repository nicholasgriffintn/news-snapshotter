import { Card } from "../../shared/Card.tsx";

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, index) => index);

export function ComparisonBriefingSkeleton() {
	return (
		<div aria-busy="true" aria-hidden="true" className="history-site-grid comparison-story-grid">
			{PLACEHOLDER_CARDS.map((card) => (
				<Card
					actionsAtBottom
					className="history-site-card comparison-story-card comparison-story-card--skeleton"
					key={card}
				>
					<div className="ui-card-meta__copy">
						<span className="comparison-skeleton__line comparison-skeleton__line--card-title" />
						<span className="comparison-skeleton__line comparison-skeleton__line--card-meta" />
					</div>

					<div className="comparison-story-card__summary">
						<span className="comparison-skeleton__line comparison-skeleton__line--copy" />
						<span className="comparison-skeleton__line comparison-skeleton__line--copy" />
						<span className="comparison-skeleton__line comparison-skeleton__line--copy-short" />
					</div>

					<div className="comparison-story-card__publishers">
						<span className="comparison-skeleton__badge" />
						<span className="comparison-skeleton__badge" />
						<span className="comparison-skeleton__badge comparison-skeleton__badge--short" />
					</div>

					<div className="ui-card-stats">
						<div>
							<span className="comparison-skeleton__line comparison-skeleton__line--stat-label" />
							<span className="comparison-skeleton__line comparison-skeleton__line--stat-value" />
						</div>
						<div>
							<span className="comparison-skeleton__line comparison-skeleton__line--stat-label" />
							<span className="comparison-skeleton__line comparison-skeleton__line--stat-value-long" />
						</div>
					</div>

					<div className="ui-card-actions">
						<span className="comparison-skeleton__action" />
					</div>
				</Card>
			))}
		</div>
	);
}
