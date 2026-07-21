import { Button } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { PageHeader, SectionHeader } from "../../shared/PageHeaders.tsx";

const FINDING_ROWS = Array.from({ length: 3 }, (_, index) => index);
const EVIDENCE_CARDS = Array.from({ length: 4 }, (_, index) => index);

export function StoryComparisonSkeleton() {
	return (
		<article aria-busy="true" className="page-stack comparison-page comparison-detail">
			<p aria-live="polite" className="sr-only">
				Loading story evidence…
			</p>

			<PageHeader
				aside={
					<div aria-hidden="true" className="comparison-detail-skeleton__aside">
						<span className="comparison-skeleton__line" />
						<span className="comparison-skeleton__line" />
						<span className="comparison-skeleton__line" />
					</div>
				}
				breadcrumbs={[{ href: "/compare", label: "All comparisons" }, { label: "Story evidence" }]}
				description={
					<span aria-hidden="true" className="comparison-detail-skeleton__description">
						<span className="comparison-skeleton__line" />
						<span className="comparison-skeleton__line" />
					</span>
				}
				title={
					<>
						<span className="sr-only">Story comparison</span>
						<span aria-hidden="true" className="comparison-detail-skeleton__title">
							<span className="comparison-skeleton__line" />
							<span className="comparison-skeleton__line" />
							<span className="comparison-skeleton__line" />
						</span>
					</>
				}
			/>

			<div aria-hidden="true" className="status-message status-message--compact status-message--info">
				<span className="comparison-skeleton__line comparison-detail-skeleton__status" />
			</div>

			<section className="comparison-findings comparison-detail-skeleton">
				<section className="comparison-finding-section">
					<h2>Shared ground</h2>
					<div aria-hidden="true" className="comparison-detail-skeleton__findings">
						{FINDING_ROWS.map((row) => (
							<div key={row}>
								<span className="comparison-skeleton__line comparison-detail-skeleton__finding" />
								<span className="comparison-skeleton__line comparison-detail-skeleton__citation" />
							</div>
						))}
					</div>
				</section>

				<section className="comparison-finding-section">
					<h2>How coverage differs</h2>
					<div aria-hidden="true" className="comparison-detail-skeleton__findings">
						{FINDING_ROWS.map((row) => (
							<div key={row}>
								<span className="comparison-skeleton__line comparison-detail-skeleton__finding" />
								<span className="comparison-skeleton__line comparison-detail-skeleton__citation" />
							</div>
						))}
					</div>
				</section>
			</section>

			<section className="comparison-evidence">
				<SectionHeader
					aside={
						<span
							aria-hidden="true"
							className="comparison-skeleton__line comparison-detail-skeleton__observation-count"
						/>
					}
					description="Read the captured wording behind the published comparison."
					title="Source evidence"
				/>

				<div aria-hidden="true" className="comparison-evidence__rail">
					{EVIDENCE_CARDS.map((card) => (
						<Card className="comparison-evidence-card comparison-evidence-card--skeleton" key={card}>
							<header className="ui-card-meta">
								<span className="comparison-skeleton__line comparison-detail-skeleton__publisher" />
								<span className="comparison-skeleton__line comparison-detail-skeleton__placement" />
							</header>
							<div className="comparison-evidence-card__body">
								<span className="comparison-skeleton__line comparison-detail-skeleton__evidence-title" />
								<span className="comparison-skeleton__line comparison-detail-skeleton__evidence-copy" />
								<span className="comparison-skeleton__line comparison-detail-skeleton__evidence-copy-short" />
							</div>
							<div className="ui-card-actions ui-card-actions--split comparison-evidence__actions">
								<span className="comparison-skeleton__action" />
								<span className="comparison-skeleton__action" />
							</div>
						</Card>
					))}
				</div>
			</section>

			<section className="comparison-report">
				<header className="comparison-report__header">
					<div>
						<h2>Spot an issue?</h2>
						<p>Feedback is reviewed by a person and helps improve future comparisons.</p>
					</div>
					<Button
						aria-controls="comparison-report-content"
						aria-expanded="false"
						disabled
						variant="secondary"
					>
						Share feedback
					</Button>
				</header>
				<div id="comparison-report-content" />
			</section>
		</article>
	);
}
