import { useCallback, useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import type { HistoryTrends } from "../../core/types.ts";
import { fetchHistoryTrends } from "../../platform/api-client.ts";
import { researchStateFromSearch, type ResearchPeriod } from "./domain/research-state.ts";
import { useHistoryImages } from "./useHistoryImages.ts";
import { useHistorySearch } from "./useHistorySearch.ts";
import { toggleContentSelection } from "./history-selection.ts";

function updateResearchUrl(values: Record<string, string>): void {
	const url = new URL(window.location.href);
	for (const [name, value] of Object.entries(values)) {
		if (value) {
			url.searchParams.set(name, value);
		} else {
			url.searchParams.delete(name);
		}
	}
	window.history.replaceState(null, "", url);
}

export function useHistoryResearch(site: string) {
	const [initial] = useState(() => researchStateFromSearch(window.location.search));
	const [query, setQuery] = useState(initial.query);
	const [period, setPeriod] = useState(initial.period);
	const [month, setMonth] = useState(initial.month);
	const [mode, setMode] = useState<HistoryTrends["mode"]>(initial.mode);
	const [trends, setTrends] = useState<HistoryTrends>();
	const [selectedContent, setSelectedContent] = useState(new Set<string>());
	const [trendError, setTrendError] = useState<string>();
	const [loadingTrends, setLoadingTrends] = useState(true);
	const imageHistory = useHistoryImages(site, month);
	const search = useHistorySearch(site, query);

	useEffect(() => {
		const controller = new AbortController();
		setTrendError(undefined);
		setTrends(undefined);
		setLoadingTrends(true);
		fetchHistoryTrends(site, period, mode, { signal: controller.signal })
			.then((nextTrends) => {
				if (!controller.signal.aborted) {
					setTrends(nextTrends);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setTrendError(reason instanceof Error ? reason.message : "Could not load trends");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingTrends(false);
				}
			});
		return () => controller.abort();
	}, [mode, period, site]);

	const changeQuery = useCallback((value: string) => {
		setQuery(value);
		updateResearchUrl({ q: value });
	}, []);
	const changeMode = useCallback((value: HistoryTrends["mode"]) => {
		setMode(value);
		updateResearchUrl({ mode: value });
	}, []);
	const changePeriod = useCallback((value: ResearchPeriod) => {
		setPeriod(value);
		updateResearchUrl({ period: value });
	}, []);
	const changeMonth = useCallback((value: string) => {
		setMonth(value);
		updateResearchUrl({ month: value });
	}, []);
	const toggleContent = useCallback((elementKey: string) => {
		setSelectedContent((current) => toggleContentSelection(current, elementKey));
	}, []);

	return {
		changeMode,
		changeMonth,
		changePeriod,
		changeQuery,
		hasMoreImages: imageHistory.hasMore,
		hasMoreResults: search.hasMore,
		imageError: imageHistory.error,
		images: imageHistory.images,
		loadMoreImages: imageHistory.loadMore,
		loadMoreResults: search.loadMore,
		loadingImages: imageHistory.loading,
		loadingMoreImages: imageHistory.loadingMore,
		loadingMoreResults: search.loadingMore,
		loadingTrends,
		mode,
		month,
		period,
		query,
		results: search.results,
		searchError: search.error,
		searching: search.loading,
		selectedContent,
		toggleContent,
		trendError,
		trends,
	};
}
