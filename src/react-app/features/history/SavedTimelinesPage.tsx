import { useEffect, useState } from "react";

import type { SavedTimelineSummary } from "../../core/types.ts";
import { fetchSavedTimelines } from "../../platform/api-client.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { isAbortError } from "../../shared/errors.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { savedTimelinePath } from "./saved-timeline.ts";

export function SavedTimelinesPage({
	preferredName,
	site,
}: {
	preferredName?: string;
	site: string;
}) {
	const [timelines, setTimelines] = useState<SavedTimelineSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const siteName = displayName(site, preferredName);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(undefined);
		fetchSavedTimelines(site, { signal: controller.signal })
			.then((records) => {
				if (!controller.signal.aborted) {
					setTimelines(records);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load timelines");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, [site]);

	return (
		<div className="page-stack saved-timelines-page">
			<PageHeader
				description="Browse curated groups of related content and follow how each item appeared over time."
				title={`${siteName} timelines`}
			/>
			<HistoryNav current="timelines" site={site} />
			{loading ? <StatusMessage role="status">Loading timelines…</StatusMessage> : null}
			{error ? (
				<StatusMessage role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{!loading && !error && timelines.length === 0 ? (
				<NoDataState
					description="Curated timelines for this publisher will appear here when they are published."
					title="No timelines published"
				/>
			) : null}
			{!loading && !error && timelines.length > 0 ? (
				<div className="saved-timeline-grid">
					{timelines.map((timeline) => (
						<Card actionsAtBottom className="saved-timeline-card" key={timeline.timelineId}>
							<div className="ui-card-meta__copy">
								<h2 className="ui-card-title">{timeline.name}</h2>
								<div className="saved-timeline-card__meta">
									<time dateTime={timeline.createdAt}>{dateTimeLabel(timeline.createdAt)}</time>
									<span>
										{timeline.contentCount} {timeline.contentCount === 1 ? "item" : "items"}
									</span>
								</div>
							</div>
							<div className="ui-card-actions">
								<ButtonLink
									aria-label={`View ${timeline.name} timeline`}
									href={savedTimelinePath(site, timeline.slug)}
									layout="card"
								>
									View timeline <span aria-hidden="true">→</span>
								</ButtonLink>
							</div>
						</Card>
					))}
				</div>
			) : null}
		</div>
	);
}
