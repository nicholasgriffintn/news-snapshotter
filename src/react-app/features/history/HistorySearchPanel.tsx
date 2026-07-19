import { useEffect, useState } from "react";

import type { HistorySearchResult } from "../../core/types.ts";
import { contentHistoryPath } from "./history-routes.ts";

export function HistorySearchPanel({
	loading,
	onQuery,
	onToggleContent,
	query,
	results,
	selectedContent,
	site,
}: {
	loading: boolean;
	onQuery: (query: string) => void;
	onToggleContent: (elementKey: string) => void;
	query: string;
	results: HistorySearchResult[];
	selectedContent: Set<string>;
	site: string;
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
					<h2>Search the archive</h2>
				</div>
				{selectedContent.size >= 2 ? (
					<a href={`/history/${encodeURIComponent(site)}/compare?${compareSearch}`}>
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
					<span>Headline, summary, category or image text</span>
					<input
						maxLength={200}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Election, climate, Downing Street…"
						value={draft}
					/>
				</label>
				<button type="submit">Search history</button>
			</form>
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
								<input
									aria-label={`Select ${result.headline ?? "content item"} for comparison`}
									checked={selectedContent.has(result.elementKey)}
									onChange={() => onToggleContent(result.elementKey)}
									type="checkbox"
								/>
								<a href={contentHistoryPath(site, result.elementKey)}>
									<strong>{result.headline ?? `Untitled ${result.kind}`}</strong>
									{result.summary ? <p>{result.summary}</p> : null}
									<small>
										{new Date(result.capturedAt).toLocaleString("en-GB")} · {result.kind} ·{" "}
										{result.category ?? "Front page"} · rank {result.rank}
									</small>
								</a>
							</li>
						))
					: null}
			</ul>
		</section>
	);
}
