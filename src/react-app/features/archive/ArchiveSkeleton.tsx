import { Card } from "../../shared/Card.tsx";

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, index) => index);

export function ArchiveSkeleton() {
	return (
		<section aria-hidden="true" className="capture-group archive-skeleton">
			<div className="capture-group__heading archive-skeleton__heading">
				<h2>
					<span className="archive-skeleton__heading-line" />
				</h2>
				<span className="archive-skeleton__count" />
			</div>
			<div className="snapshot-grid">
				{PLACEHOLDER_CARDS.map((card) => (
					<Card className="snapshot-card snapshot-card--skeleton" key={card}>
						<div className="snapshot-card__image" />
						<div className="snapshot-card__copy">
							<span />
							<span />
							<span />
						</div>
						<span className="snapshot-card__history snapshot-card__history--placeholder" />
					</Card>
				))}
			</div>
		</section>
	);
}
