import { useEffect, useState } from "react";

import type { StoryHistory } from "../../core/types.ts";
import { fetchStoryHistory } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { HistoryNav } from "./HistoryNav.tsx";
import { StoryTimelineChart } from "./StoryTimelineChart.tsx";

export function StoryHistoryPage({ site, storyId }: { site: string; storyId: string }) {
	const [story, setStory] = useState<StoryHistory>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		setError(undefined);
		fetchStoryHistory(site, storyId)
			.then(setStory)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not load story history");
			});
	}, [site, storyId]);

	const latest = story?.observations.at(-1);
	return (
		<div className="history-page story-history-page">
			<header className="history-heading history-heading--story">
				<div>
					<p className="eyebrow">{displayName(site)} story history</p>
					<h1>{latest?.headline ?? "Story timeline"}</h1>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!story && !error ? <div className="empty-state">Loading story history…</div> : null}
			{story ? (
				<>
					{story.canonicalUrl ? (
						<a
							className="history-text-link"
							href={story.canonicalUrl}
							rel="noreferrer"
							target="_blank"
						>
							Visit publisher story ↗
						</a>
					) : null}
					<StoryTimelineChart observations={story.observations} />
					<ol className="story-observations">
						{[...story.observations].reverse().map((observation) => (
							<li key={observation.captureId}>
								<div className="story-observation-time">
									<time dateTime={observation.capturedAt}>
										{new Date(observation.capturedAt).toLocaleString("en-GB")}
									</time>
									<span>
										Rank {observation.rank} · {observation.viewportDepth.toFixed(1)} pages down
									</span>
								</div>
								<div>
									<strong>{observation.headline ?? "Untitled observation"}</strong>
									{observation.summary ? <p>{observation.summary}</p> : null}
								</div>
							</li>
						))}
					</ol>
				</>
			) : null}
		</div>
	);
}
