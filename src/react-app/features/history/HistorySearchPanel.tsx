import { useEffect, useState } from "react";

import type { HistorySearchResult } from "../../core/types.ts";

export function HistorySearchPanel({
	onQuery,
	onToggleStory,
	query,
	results,
	selectedStories,
	site,
}: {
	onQuery: (query: string) => void;
	onToggleStory: (storyId: string) => void;
	query: string;
	results: HistorySearchResult[];
	selectedStories: Set<string>;
	site: string;
}) {
	const [draft, setDraft] = useState(query);
	useEffect(() => setDraft(query), [query]);
	const compareSearch = new URLSearchParams();
	for (const storyId of selectedStories) compareSearch.append("story", storyId);

	return (
		<section className="research-panel research-panel--search">
			<header>
				<div>
					<p className="eyebrow">Stories and language</p>
					<h2>Search the archive</h2>
				</div>
				{selectedStories.size >= 2 ? (
					<a href={`/history/${encodeURIComponent(site)}/compare?${compareSearch}`}>
						Compare {selectedStories.size} stories →
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
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Election, climate, Downing Street…"
						value={draft}
					/>
				</label>
				<button type="submit">Search history</button>
			</form>
			{query && results.length === 0 ? (
				<p className="research-empty">No matching observations.</p>
			) : null}
			<ul className="research-results">
				{results.map((result) => (
					<li key={`${result.captureId}:${result.storyId}`}>
						<input
							aria-label={`Select ${result.headline ?? "story"} for comparison`}
							checked={selectedStories.has(result.storyId)}
							onChange={() => onToggleStory(result.storyId)}
							type="checkbox"
						/>
						<a
							href={`/history/${encodeURIComponent(site)}/stories/${encodeURIComponent(result.storyId)}`}
						>
							<strong>{result.headline ?? "Untitled story"}</strong>
							{result.summary ? <p>{result.summary}</p> : null}
							<small>
								{new Date(result.capturedAt).toLocaleString("en-GB")} ·{" "}
								{result.category ?? "Front page"} · rank {result.rank}
							</small>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}
