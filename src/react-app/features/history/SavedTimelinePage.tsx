import { useEffect, useMemo, useState } from "react";

import type { SavedTimeline } from "../../core/types.ts";
import { fetchSavedTimeline, historyScreenshotUrl } from "../../platform/api-client.ts";
import { ButtonLink } from "../../shared/Button.tsx";
import { isAbortError } from "../../shared/errors.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { PageHeader, SectionHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { contentHistoryPath } from "./history-routes.ts";
import { groupSavedTimelineObservations, savedTimelinesPath } from "./saved-timeline.ts";

export function SavedTimelinePage({ site, slug }: { site: string; slug: string }) {
	const [timeline, setTimeline] = useState<SavedTimeline>();
	const [error, setError] = useState<string>();
	const groups = useMemo(
		() => groupSavedTimelineObservations(timeline?.observations ?? []),
		[timeline],
	);

	useEffect(() => {
		const controller = new AbortController();
		setError(undefined);
		setTimeline(undefined);
		fetchSavedTimeline(site, slug, { signal: controller.signal })
			.then((nextTimeline) => {
				if (!controller.signal.aborted) {
					setTimeline(nextTimeline);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load saved timeline");
				}
			});
		return () => controller.abort();
	}, [site, slug]);

	return (
		<div className="page-stack saved-timeline-page">
			<PageHeader
				breadcrumbs={[
					{ href: savedTimelinesPath(site), label: "Timelines" },
					{ label: timeline?.name ?? "Timeline" },
				]}
				description={timeline ? `Published ${dateTimeLabel(timeline.createdAt)}` : undefined}
				title={timeline?.name ?? "Timeline"}
				variant="detail"
			/>
			<HistoryNav current="timelines" site={site} />
			{error ? (
				<StatusMessage role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{!timeline && !error ? <StatusMessage role="status">Loading timeline…</StatusMessage> : null}
			{timeline?.truncated ? (
				<StatusMessage tone="info">
					This view is capped at the first 1,000 observations.
				</StatusMessage>
			) : null}
			{timeline && groups.length === 0 ? (
				<NoDataState
					description="The selected content does not currently have any indexed observations."
					title="No observations available"
				/>
			) : null}
			{groups.map((group) => {
				const latest = group.observations.at(-1);
				return (
					<section className="saved-timeline-group" key={group.elementKey}>
						<SectionHeader
							aside={
								<ButtonLink
									aria-label={`View history for ${latest?.headline ?? group.elementKey}`}
									href={contentHistoryPath(site, group.elementKey)}
									variant="secondary"
								>
									View content history
								</ButtonLink>
							}
							description={`${displayName(group.kind)} · ${group.observations.length} ${group.observations.length === 1 ? "observation" : "observations"}`}
							title={latest?.headline ?? group.elementKey}
						/>
						<ol className="saved-timeline">
							{group.observations.map((observation, index) => (
								<li key={`${observation.captureId ?? "capture"}:${index}`}>
									{observation.imageCropKey || observation.imageSourceUrl ? (
										<img
											alt=""
											src={
												observation.imageCropKey
													? historyScreenshotUrl(observation.imageCropKey)
													: observation.imageSourceUrl
											}
										/>
									) : null}
									<div>
										{observation.capturedAt ? (
											<time dateTime={observation.capturedAt}>
												{dateTimeLabel(observation.capturedAt)}
											</time>
										) : null}
										<strong>{observation.headline ?? observation.elementKey}</strong>
										{observation.rank !== undefined ? (
											<span>Page position {observation.rank}</span>
										) : null}
									</div>
								</li>
							))}
						</ol>
					</section>
				);
			})}
		</div>
	);
}
