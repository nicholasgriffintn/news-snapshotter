import { useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { ElementHistory } from "../../core/types.ts";
import { fetchElementHistory } from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { HistoryNav } from "./HistoryNav.tsx";

export function ElementHistoryPage({ elementKey, site }: { elementKey: string; site: string }) {
	const [history, setHistory] = useState<ElementHistory>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		const controller = new AbortController();
		setError(undefined);
		setHistory(undefined);
		fetchElementHistory(site, elementKey, { signal: controller.signal })
			.then((nextHistory) => {
				if (!controller.signal.aborted) {
					setHistory(nextHistory);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load content history");
				}
			});
		return () => controller.abort();
	}, [elementKey, site]);

	const latest = history?.observations.at(-1);
	const title = latest?.headline ?? "Content timeline";
	return (
		<div className="history-page story-history-page">
			<header className="history-heading history-heading--story">
				<div>
					<p className="eyebrow">
						{displayName(site)} {history?.kind ?? "content"} history
					</p>
					<h1 className={title.length > 90 ? "story-title story-title--long" : "story-title"}>
						{title}
					</h1>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{!history && !error ? <div className="empty-state">Loading content history…</div> : null}
			{history ? (
				<>
					{history.canonicalUrl ? (
						<a
							className="history-text-link"
							href={history.canonicalUrl}
							rel="noreferrer"
							target="_blank"
						>
							Visit publisher {history.kind} ↗
						</a>
					) : null}
					<ContentTimelineChart observations={history.observations} />
					<ol className="story-observations">
						{[...history.observations].reverse().map((observation) => (
							<li key={observation.captureId}>
								<div className="story-observation-time">
									<time dateTime={observation.capturedAt}>
										{new Date(observation.capturedAt).toLocaleString("en-GB")}
									</time>
									<span>
										Rank {observation.rank} · {observation.prominence ?? "standard"} ·{" "}
										{observation.viewportDepth.toFixed(1)} pages down
									</span>
								</div>
								<div>
									<strong>{observation.headline ?? `Untitled ${history.kind}`}</strong>
									{observation.category || observation.section ? (
										<p>{observation.category ?? observation.section}</p>
									) : null}
								</div>
							</li>
						))}
					</ol>
				</>
			) : null}
		</div>
	);
}
