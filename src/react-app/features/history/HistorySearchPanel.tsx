import { useEffect, useState } from "react";

import type { HistorySearchResult } from "../../core/types.ts";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { contentHistoryPath } from "./history-routes.ts";

export function HistorySearchPanel({
	loading,
	loadingMore,
	hasMore,
	onLoadMore,
	onQuery,
	onToggleContent,
	query,
	results,
	selectedContent,
	site,
	siteName,
}: {
	hasMore: boolean;
	loading: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	onQuery: (query: string) => void;
	onToggleContent: (elementKey: string) => void;
	query: string;
	results: HistorySearchResult[];
	selectedContent: Set<string>;
	site: string;
	siteName: string;
}) {
	const [draft, setDraft] = useState(query);
	useEffect(() => setDraft(query), [query]);
	const compareSearch = new URLSearchParams();
	for (const elementKey of selectedContent) {
		compareSearch.append("element", elementKey);
	}

	return (
		<section className="research-panel research-panel--search">
			<header>
				<div>
					<p className="research-panel__kicker">Find coverage</p>
					<h2>Search page content</h2>
					<p className="research-panel__description">
						Search the headlines, summaries, sections and image descriptions captured from{" "}
						{siteName}.
					</p>
				</div>
				{selectedContent.size >= 2 ? (
					<a
						className="research-panel__action"
						href={`/history/${encodeURIComponent(site)}/compare?${compareSearch}`}
					>
						Compare {selectedContent.size} items →
					</a>
				) : null}
			</header>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					onQuery(draft.trim());
				}}
			>
				<label>
					<span>Search terms</span>
					<input
						maxLength={200}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Try a person, place, topic or phrase"
						type="search"
						value={draft}
					/>
				</label>
				<button type="submit">Search history</button>
			</form>
			{query && !loading && results.length > 0 ? (
				<div className="research-results__status">
					<strong>
						{results.length} {results.length === 1 ? "result" : "results"} {hasMore ? "loaded" : ""}
					</strong>
					<span>Select two or more items to compare how their position changed.</span>
				</div>
			) : null}
			{loading ? (
				<p aria-live="polite" className="research-empty" role="status">
					Searching the archive…
				</p>
			) : null}
			{query && !loading && results.length === 0 ? (
				<p className="research-empty">No matching observations.</p>
			) : null}
			<ul aria-busy={loading} className="research-results">
				{!loading
					? results.map((result) => (
							<li key={`${result.captureId}:${result.elementKey}`}>
								<a href={contentHistoryPath(site, result.elementKey)}>
									<strong>{result.headline ?? `Untitled ${result.kind}`}</strong>
									{result.summary ? <p>{result.summary}</p> : null}
									<div className="research-result__meta">
										<time dateTime={result.capturedAt}>{dateTimeLabel(result.capturedAt)}</time>
										<span>{displayName(result.kind)}</span>
										<span>{result.category ?? "Front page"}</span>
										<span>Page position {result.rank}</span>
									</div>
								</a>
								<label className="research-result__selection">
									<input
										checked={selectedContent.has(result.elementKey)}
										onChange={() => onToggleContent(result.elementKey)}
										type="checkbox"
									/>
									<span>Compare</span>
								</label>
							</li>
						))
					: null}
			</ul>
			{hasMore ? (
				<div className="research-pagination">
					<span>More matching content is available</span>
					<button disabled={loadingMore} onClick={onLoadMore} type="button">
						{loadingMore ? "Loading more…" : "Load more results"}
					</button>
				</div>
			) : null}
		</section>
	);
}
