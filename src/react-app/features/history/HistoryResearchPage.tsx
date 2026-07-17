import { useEffect, useState } from "react";

import type {
	HistoryImageObservation,
	HistorySearchResult,
	HistoryTrends,
} from "../../core/types.ts";
import {
	fetchHistoryImages,
	fetchHistoryTrends,
	searchHistory,
} from "../../platform/api-client.ts";
import { displayName } from "../../shared/format.ts";
import { HistoryImageTimeline } from "./HistoryImageTimeline.tsx";
import { HistoryNav } from "./HistoryNav.tsx";
import { HistorySearchPanel } from "./HistorySearchPanel.tsx";
import { HistoryTrendPanel } from "./HistoryTrendPanel.tsx";

function initialMonth(): string {
	return new Date().toISOString().slice(0, 7);
}

function updateUrl(values: Record<string, string>): void {
	const url = new URL(window.location.href);
	for (const [name, value] of Object.entries(values)) {
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
	}
	window.history.replaceState(null, "", url);
}

export function HistoryResearchPage({ site }: { site: string }) {
	const initial = new URLSearchParams(window.location.search);
	const [query, setQuery] = useState(initial.get("q") ?? "");
	const [period, setPeriod] = useState(initial.get("period") ?? "30d");
	const [month, setMonth] = useState(initial.get("month") ?? initialMonth());
	const [mode, setMode] = useState<HistoryTrends["mode"]>("category");
	const [results, setResults] = useState<HistorySearchResult[]>([]);
	const [images, setImages] = useState<HistoryImageObservation[]>([]);
	const [trends, setTrends] = useState<HistoryTrends>();
	const [selectedStories, setSelectedStories] = useState(new Set<string>());
	const [error, setError] = useState<string>();

	useEffect(() => {
		fetchHistoryImages(site, month)
			.then(setImages)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not load image history");
			});
	}, [month, site]);

	useEffect(() => {
		fetchHistoryTrends(site, period, mode)
			.then(setTrends)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not load trends");
			});
	}, [mode, period, site]);

	useEffect(() => {
		if (!query) {
			setResults([]);
			return;
		}
		searchHistory({ query, site })
			.then(setResults)
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : "Could not search history");
			});
	}, [query, site]);

	return (
		<div className="history-page research-page">
			<header className="history-heading history-heading--research">
				<div>
					<p className="eyebrow">Archive research</p>
					<h1>{displayName(site)} research</h1>
				</div>
				<div className="history-heading__intro">
					<p>Search stories, compare their prominence, and trace the imagery used over time.</p>
				</div>
			</header>
			<HistoryNav current="research" site={site} />
			{error ? <div className="history-alert">{error}</div> : null}
			<HistorySearchPanel
				onQuery={(value) => {
					setQuery(value);
					updateUrl({ q: value });
				}}
				onToggleStory={(storyId) => {
					setSelectedStories((current) => {
						const next = new Set(current);
						if (next.has(storyId)) next.delete(storyId);
						else next.add(storyId);
						return next;
					});
				}}
				query={query}
				results={results}
				selectedStories={selectedStories}
				site={site}
			/>
			<HistoryTrendPanel
				mode={mode}
				onMode={(value) => {
					setMode(value);
					updateUrl({ mode: value });
				}}
				onPeriod={(value) => {
					setPeriod(value);
					updateUrl({ period: value });
				}}
				period={period}
				trends={trends}
			/>
			<HistoryImageTimeline
				images={images}
				month={month}
				onMonth={(value) => {
					setMonth(value);
					updateUrl({ month: value });
				}}
				site={site}
			/>
		</div>
	);
}
