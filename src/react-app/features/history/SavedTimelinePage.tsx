import { useEffect, useState } from "react";

import type { SavedTimeline } from "../../core/types.ts";
import { fetchSavedTimeline } from "../../platform/api-client.ts";

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
					<p className="eyebrow">Saved archive timeline</p>
					<h1>{timeline?.name ?? "Timeline"}</h1>
				</div>
				<a href={`/history/${encodeURIComponent(site)}/research`}>Explore the archive →</a>
			</header>
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!timeline && !error ? <div className="empty-state">Loading timeline…</div> : null}
			<ol className="saved-timeline">
				{timeline?.observations.map((observation, index) => (
					<li key={`${observation.storyId}:${observation.captureId ?? index}`}>
						{observation.imageSourceUrl ? <img alt="" src={observation.imageSourceUrl} /> : null}
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
