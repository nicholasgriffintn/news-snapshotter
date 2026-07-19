import { useCallback, useEffect, useRef, useState } from "react";

import type { HistorySearchResult } from "../../core/types.ts";
import { searchHistory } from "../../platform/api-client.ts";
import { isAbortError } from "../../shared/errors.ts";
import { mergeHistorySearchResults } from "./domain/research-pages.ts";

export function useHistorySearch(site: string, query: string) {
	const activeRequest = useRef<AbortController | undefined>(undefined);
	const [cursor, setCursor] = useState<string>();
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [results, setResults] = useState<HistorySearchResult[]>([]);

	useEffect(() => {
		activeRequest.current?.abort();
		setCursor(undefined);
		setError(undefined);
		setLoadingMore(false);
		setResults([]);
		if (!query) {
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		activeRequest.current = controller;
		setLoading(true);
		searchHistory({ query, site }, { signal: controller.signal })
			.then((page) => {
				if (!controller.signal.aborted) {
					setCursor(page.cursor);
					setResults(page.results);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not search history");
				}
			})
			.finally(() => {
				if (activeRequest.current === controller) {
					activeRequest.current = undefined;
					setLoading(false);
				}
			});

		return () => {
			controller.abort();
			activeRequest.current?.abort();
		};
	}, [query, site]);

	const loadMore = useCallback(() => {
		if (!cursor || loading || loadingMore || activeRequest.current) {
			return;
		}
		const controller = new AbortController();
		activeRequest.current = controller;
		setError(undefined);
		setLoadingMore(true);
		searchHistory({ query, site }, { cursor, signal: controller.signal })
			.then((page) => {
				if (!controller.signal.aborted) {
					setCursor(page.cursor);
					setResults((current) => mergeHistorySearchResults(current, page.results));
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load more results");
				}
			})
			.finally(() => {
				if (activeRequest.current === controller) {
					activeRequest.current = undefined;
					setLoadingMore(false);
				}
			});
	}, [cursor, loading, loadingMore, query, site]);

	return { error, hasMore: Boolean(cursor), loadMore, loading, loadingMore, results };
}
