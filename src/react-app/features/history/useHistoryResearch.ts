import { useCallback, useEffect, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
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
import { researchStateFromSearch, type ResearchPeriod } from "./domain/research-state.ts";

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
	const [results, setResults] = useState<HistorySearchResult[]>([]);
	const [images, setImages] = useState<HistoryImageObservation[]>([]);
	const [trends, setTrends] = useState<HistoryTrends>();
	const [selectedContent, setSelectedContent] = useState(new Set<string>());
	const [searchError, setSearchError] = useState<string>();
	const [imageError, setImageError] = useState<string>();
	const [trendError, setTrendError] = useState<string>();
	const [searching, setSearching] = useState(false);
	const [loadingImages, setLoadingImages] = useState(true);
	const [loadingTrends, setLoadingTrends] = useState(true);

	useEffect(() => {
		const controller = new AbortController();
		setImageError(undefined);
		setImages([]);
		setLoadingImages(true);
		fetchHistoryImages(site, month, { signal: controller.signal })
			.then((nextImages) => {
				if (!controller.signal.aborted) {
					setImages(nextImages);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setImageError(reason instanceof Error ? reason.message : "Could not load image history");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingImages(false);
				}
			});
		return () => controller.abort();
	}, [month, site]);

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

	useEffect(() => {
		const controller = new AbortController();
		setSearchError(undefined);
		if (!query) {
			setResults([]);
			setSearching(false);
			return () => controller.abort();
		}
		setResults([]);
		setSearching(true);
		searchHistory({ query, site }, { signal: controller.signal })
			.then((nextResults) => {
				if (!controller.signal.aborted) {
					setResults(nextResults);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setSearchError(reason instanceof Error ? reason.message : "Could not search history");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setSearching(false);
				}
			});
		return () => controller.abort();
	}, [query, site]);

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
		setSelectedContent((current) => {
			const next = new Set(current);
			if (next.has(elementKey)) {
				next.delete(elementKey);
			} else {
				next.add(elementKey);
			}
			return next;
		});
	}, []);

	return {
		changeMode,
		changeMonth,
		changePeriod,
		changeQuery,
		error: [searchError, trendError, imageError].filter(Boolean).join(" · ") || undefined,
		images,
		loadingImages,
		loadingTrends,
		mode,
		month,
		period,
		query,
		results,
		searching,
		selectedContent,
		toggleContent,
		trends,
	};
}
