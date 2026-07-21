import { Card } from "../../shared/Card.tsx";

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, index) => index);

export function HistorySiteSkeleton() {
	return (
		<div aria-busy="true" aria-hidden="true" className="history-site-grid">
			{PLACEHOLDER_CARDS.map((card) => (
				<Card className="history-site-card history-site-card--skeleton" key={card}>
					<div className="ui-card-meta__copy">
						<span className="history-site-card__title-placeholder" />
						<span className="history-site-card__meta-placeholder" />
					</div>
					<div className="ui-card-stats">
						<div>
							<span className="history-site-card__label-placeholder" />
							<span className="history-site-card__value-placeholder" />
						</div>
						<div>
							<span className="history-site-card__label-placeholder" />
							<span className="history-site-card__value-placeholder" />
						</div>
					</div>
					<div className="ui-card-actions ui-card-actions--split">
						<span />
						<span />
					</div>
				</Card>
			))}
		</div>
	);
}
