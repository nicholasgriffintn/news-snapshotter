import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { SavedTimeline } from "../../core/types.ts";
import { fetchSavedTimeline } from "../../platform/api-client.ts";
import { historyScreenshotUrl } from "../../platform/api-client.ts";
import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { HistoryNav } from "./HistoryNav.tsx";

export function SavedTimelinePage({ site, slug }: { site: string; slug: string }) {
	const [timeline, setTimeline] = useState<SavedTimeline>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		const controller = new AbortController();
		setError(undefined);
		setTimeline(undefined);
		fetchSavedTimeline(slug, { signal: controller.signal })
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
	}, [slug]);

	return (
		<div className="page-stack saved-timeline-page">
			<PageHeader title={timeline?.name ?? "Timeline"} />
			<HistoryNav current="research" site={site} />
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
			<ol className="saved-timeline">
				{timeline?.observations.map((observation, index) => (
					<li key={`${observation.elementKey}:${observation.captureId ?? index}`}>
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
									{new Date(observation.capturedAt).toLocaleString("en-GB")}
								</time>
							) : null}
							<strong>{observation.headline ?? observation.elementKey}</strong>
							{observation.rank ? <span>Rank {observation.rank}</span> : null}
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}
