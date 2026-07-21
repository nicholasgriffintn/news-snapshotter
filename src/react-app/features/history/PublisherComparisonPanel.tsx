import { dateTimeLabel } from "../../shared/format.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { CollectionSummary } from "../../shared/CollectionSummary.tsx";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { SectionHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { useComparisonData } from "../comparison/comparison-api.ts";
import type { PublisherComparison } from "../comparison/domain/contracts.ts";

type PublisherTimelineItem = {
	captureId: string;
	capturedAt: string;
	storyId: string;
	text: string;
};

function PublisherObservationCard({
	captureId,
	capturedAt,
	description,
	label,
	metaLabel,
	site,
	storyId,
}: {
	captureId: string;
	capturedAt: string;
	description?: string;
	label: string;
	metaLabel: string;
	site: string;
	storyId: string;
}) {
	const storyPath = `/compare/stories/${encodeURIComponent(storyId)}`;
	const capturePath =
		`/history/${encodeURIComponent(site)}` + `?capture=${encodeURIComponent(captureId)}&overlay=1`;

	return (
		<Card className="comparison-publisher-card">
			<header className="ui-card-meta">
				<span className="ui-card-meta__label">{metaLabel}</span>
				<time dateTime={capturedAt}>{dateTimeLabel(capturedAt)}</time>
			</header>
			<div className="comparison-publisher-card__body">
				<h3 className="ui-card-title">
					<a href={storyPath}>{label}</a>
				</h3>
				{description ? <p className="ui-card-description">{description}</p> : null}
			</div>
			<div className="ui-card-actions comparison-publisher-card__actions">
				<ButtonLink href={capturePath} layout="card" variant="secondary">
					View capture <span aria-hidden="true">→</span>
				</ButtonLink>
			</div>
		</Card>
	);
}

function PublisherTimeline({
	description,
	emptyMessage,
	items,
	site,
	title,
}: {
	description: string;
	emptyMessage: string;
	items: PublisherTimelineItem[];
	site: string;
	title: string;
}) {
	return (
		<section className="comparison-publisher-section comparison-publisher__timing">
			<SectionHeader description={description} title={title} />

			{items.length ? (
				<div className="comparison-publisher-card-grid">
					{items.map((item) => (
						<PublisherObservationCard
							captureId={item.captureId}
							capturedAt={item.capturedAt}
							key={`${item.captureId}:${item.text}`}
							label={item.text}
							metaLabel={title === "Lead story changes" ? "Lead story" : "Lead headline"}
							site={site}
							storyId={item.storyId}
						/>
					))}
				</div>
			) : (
				<NoDataState compact title={emptyMessage} />
			)}
		</section>
	);
}

export function PublisherComparisonPanel({ site }: { site: string }) {
	const result = useComparisonData<PublisherComparison>(
		`/api/comparison/publishers/${encodeURIComponent(site)}`,
	);
	if (result.loading && !result.data) {
		return (
			<Card
				aria-busy="true"
				as="section"
				className="research-panel comparison-publisher-workspace"
				id="comparison"
			>
				<SectionHeader
					description="Compare homepage leadership, topic prominence and publication timing across the cohort."
					title="Publisher comparison"
				/>
				<StatusMessage compact role="status">
					Loading publisher comparison…
				</StatusMessage>
			</Card>
		);
	}
	if (result.error || !result.data) {
		return null;
	}
	const data = result.data;

	return (
		<Card as="section" className="research-panel comparison-publisher-workspace" id="comparison">
			<SectionHeader
				description="Compare homepage leadership, topic prominence and publication timing across the cohort."
				title="Publisher comparison"
			/>
			<CollectionSummary
				details={`${data.publisher.leadCount} lead placements · ${data.publisher.weightedProminenceHours.toFixed(1)} weighted prominence hours · ${data.publisher.cohortObservationCount} cohort observations`}
				label={`${data.publisher.observationCount} publisher observations`}
			/>

			<div className="comparison-publisher-grid">
				<PublisherTimeline
					description="Changes in the highest-prominence story on captured homepages."
					emptyMessage="No lead-story changes were observed in this period."
					items={data.publisher.leadTimeline.map((item) => ({
						captureId: item.captureId,
						capturedAt: item.capturedAt,
						storyId: item.storyId,
						text: item.label,
					}))}
					site={site}
					title="Lead story changes"
				/>

				<PublisherTimeline
					description="Changes in the exact captured wording of the lead headline."
					emptyMessage="No lead-headline changes were observed in this period."
					items={data.publisher.headlineTimeline.map((item) => ({
						captureId: item.captureId,
						capturedAt: item.capturedAt,
						storyId: item.storyId,
						text: item.headline,
					}))}
					site={site}
					title="Lead headline wording"
				/>
			</div>

			<div className="comparison-publisher-grid comparison-publisher-grid--analysis">
				<section className="comparison-publisher-section comparison-publisher__topics">
					<SectionHeader
						description="Raw homepage observations within the selected cohort."
						title="Topic mix"
					/>

					{data.publisher.topics.length ? (
						<ol className="comparison-topic-grid">
							{data.publisher.topics.map((topic) => (
								<li key={topic.topic}>
									<Card className="comparison-topic-card">
										<header className="ui-card-meta">
											<span className="ui-card-meta__label">Topic share</span>
											<strong>{Math.round(topic.publisherShare * 100)}%</strong>
										</header>
										<h3 className="ui-card-title">{topic.topic}</h3>
										<progress
											aria-label={`${topic.topic} publisher share`}
											max={1}
											value={topic.publisherShare}
										/>
										<p className="ui-card-description">
											{topic.publisherObservationCount} publisher observations ·{" "}
											{topic.cohortObservationCount} across cohort
										</p>
									</Card>
								</li>
							))}
						</ol>
					) : (
						<NoDataState compact title="No published topic observations in this period" />
					)}
				</section>

				<section className="comparison-publisher-section comparison-publisher__timing">
					<SectionHeader
						description="Compare when this publisher and its peers first showed the same story."
						title="First observed"
					/>

					{data.publisher.timings.length ? (
						<div className="comparison-publisher-card-grid">
							{data.publisher.timings.map((item) => (
								<PublisherObservationCard
									captureId={item.captureId}
									capturedAt={item.publisherFirstSeenAt}
									description={`First peer observation: ${dateTimeLabel(item.peerFirstSeenAt)}`}
									key={item.storyId}
									label={item.label}
									metaLabel={`Observed by ${data.displayName}`}
									site={site}
									storyId={item.storyId}
								/>
							))}
						</div>
					) : (
						<NoDataState compact title="No cross-publisher timing comparisons in this period" />
					)}
				</section>
			</div>
		</Card>
	);
}
