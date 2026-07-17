import { useEffect, useState } from "react";

import type { StoryHistory } from "../../core/types.ts";
import { fetchStoryHistory } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { StoryTimelineChart } from "./StoryTimelineChart.tsx";

export function StoryComparisonPage({ site, storyIds }: { site: string; storyIds: string[] }) {
	const [stories, setStories] = useState<StoryHistory[]>([]);
	const [error, setError] = useState<string>();

	useEffect(() => {
		Promise.all(storyIds.slice(0, 10).map((storyId) => fetchStoryHistory(site, storyId)))
			.then(setStories)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not compare stories");
			});
	}, [site, storyIds.join("\n")]);

	return (
		<div className="history-page comparison-page">
			<header className="history-heading">
				<div>
					<p className="eyebrow">{displayName(site)} comparison</p>
					<h1>Story trajectories</h1>
				</div>
				<a href={`/history/${encodeURIComponent(site)}/research`}>Back to research →</a>
			</header>
			{storyIds.length < 2 ? (
				<div className="empty-state">Select at least two stories to compare.</div>
			) : null}
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			<div className="comparison-grid">
				{stories.map((story) => {
					const latest = story.observations.at(-1);
					return (
						<article key={story.storyId}>
							<p className="eyebrow">{story.observations.length} observations</p>
							<h2>{latest?.headline ?? story.storyId}</h2>
							<StoryTimelineChart observations={story.observations} />
							<a
								href={`/history/${encodeURIComponent(site)}/stories/${encodeURIComponent(story.storyId)}`}
							>
								Full story history →
							</a>
						</article>
					);
				})}
			</div>
		</div>
	);
}
