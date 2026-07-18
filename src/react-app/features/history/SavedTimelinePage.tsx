import { useEffect, useState } from "react";

import type { SavedTimeline } from "../../core/types.ts";
import { fetchSavedTimeline } from "../../platform/api-client.ts";
import { historyScreenshotUrl } from "../../platform/api-client.ts";
import { HistoryNav } from "./HistoryNav.tsx";

export function SavedTimelinePage({ site, slug }: { site: string; slug: string }) {
	const [timeline, setTimeline] = useState<SavedTimeline>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		fetchSavedTimeline(slug)
			.then(setTimeline)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not load saved timeline");
			});
	}, [slug]);

	return (
		<div className="history-page saved-timeline-page">
			<header className="history-heading">
				<div>
					<h1>{timeline?.name ?? "Timeline"}</h1>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!timeline && !error ? <div className="empty-state">Loading timeline…</div> : null}
			{timeline?.truncated ? (
				<div className="history-alert">This view is capped at the first 1,000 observations.</div>
			) : null}
			<ol className="saved-timeline">
				{timeline?.observations.map((observation, index) => (
					<li key={`${observation.storyId}:${observation.captureId ?? index}`}>
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
							<strong>{observation.headline ?? observation.storyId}</strong>
							{observation.rank ? <span>Rank {observation.rank}</span> : null}
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}
