import { PageHeader } from "../../shared/PageHeaders.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { ContentTimelineChart } from "./ContentTimelineChart.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { useElementHistory } from "./useElementHistory.ts";

export function ElementHistoryPage({
	elementKey,
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
		<div className="page-stack story-history-page">
			<PageHeader title={title} variant="detail" />
			<HistoryNav current="research" site={site} />
			{error ? (
				<StatusMessage role="alert" tone="error">
					{error}
				</StatusMessage>
			) : null}
			{loading && !history ? (
				<StatusMessage role="status">Loading content history…</StatusMessage>
			) : null}
			{history ? (
				<>
					{history.canonicalUrl ? (
						<a
							className="ui-text-link"
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
