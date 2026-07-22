import { useEffect, useState } from "react";

import type { HistorySearchResult } from "../../core/types.ts";
import { Button } from "../../shared/Button.tsx";
import { Card } from "../../shared/Card.tsx";
import { SearchField } from "../../shared/Filters.tsx";
import { dateTimeLabel, displayName } from "../../shared/format.ts";
import { NoDataState } from "../../shared/NoDataState.tsx";
import { StatusMessage } from "../../shared/StatusMessage.tsx";
import { contentHistoryPath } from "./history-routes.ts";

export function HistorySearchPanel({
	error,
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
	error?: string;
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
		<>
			<form
				className="research-search"
				aria-label="Search captured page content"
				onSubmit={(event) => {
					event.preventDefault();
					onQuery(draft.trim());
				}}
			>
				<SearchField
					label="Search terms"
					maxLength={200}
					onChange={setDraft}
					placeholder="Try a person, place, topic or phrase"
					value={draft}
				/>
				<Button disabled={loading} type="submit" variant="secondary">
					{loading ? "Searching…" : "Search history"}
				</Button>
			</form>
			<div className="research-results__container">
				{error ? (
					<StatusMessage compact role="alert" tone="error">
						{error}
					</StatusMessage>
				) : null}
				{query && !loading && results.length > 0 ? (
					<div className="research-results__status">
						<strong>
							{results.length} {results.length === 1 ? "result" : "results"}{" "}
							{hasMore ? "loaded" : ""}
						</strong>
						<span>Select two or more items to compare how their position changed.</span>
					</div>
				) : null}
				{loading ? (
					<StatusMessage compact role="status">
						Searching the archive…
					</StatusMessage>
				) : null}
				{query && !loading && !error && results.length === 0 ? (
					<NoDataState
						compact
						description="Try a broader person, place, topic or phrase."
						title="No matching observations"
					/>
				) : null}
				<ul
					aria-busy={loading}
					className={`research-results ${results?.length || loading ? "research-results--content" : ""}`}
				>
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
											aria-label={`Compare ${result.headline ?? `untitled ${result.kind}`}`}
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
						<Button disabled={loadingMore} onClick={onLoadMore} variant="secondary">
							{loadingMore ? "Loading more…" : "Load more results"}
						</Button>
					</div>
				) : null}
			</div>
		</>
	);
}
