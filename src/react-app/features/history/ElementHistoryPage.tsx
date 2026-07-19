import { displayName } from "../../shared/format.ts";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { useElementHistory } from "./useElementHistory.ts";

export function ElementHistoryPage({
	elementKey,
	preferredName,
	site,
}: {
	elementKey: string;
	preferredName?: string;
	site: string;
}) {
	const { error, history, loadEarlier, loading, loadingEarlier } = useElementHistory(
		site,
		elementKey,
	);

	const latest = history?.observations.at(-1);
	const title = latest?.headline ?? "Content timeline";
	return (
		<div className="history-page story-history-page">
			<header className="history-heading history-heading--story">
				<div>
					<p className="eyebrow">
						{displayName(site, preferredName)} {history?.kind ?? "content"} history
					</p>
					<h1 className={title.length > 90 ? "story-title story-title--long" : "story-title"}>
						{title}
					</h1>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{error ? <div className="empty-state empty-state--error">{error}</div> : null}
			{loading && !history ? <div className="empty-state">Loading content history…</div> : null}
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
					{history.cursor ? (
						<div className="story-history__pagination">
							<span>{history.observations.length} observations loaded</span>
							<button disabled={loadingEarlier} onClick={loadEarlier} type="button">
								{loadingEarlier ? "Loading earlier observations…" : "Load earlier observations"}
							</button>
						</div>
					) : null}
				</>
			) : null}
		</div>
	);
}
