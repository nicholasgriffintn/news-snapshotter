import { useCallback, useEffect, useRef, useState } from "react";

import type { HistoryImageObservation } from "../../core/types.ts";
import { fetchHistoryImages } from "../../platform/api-client.ts";
import { isAbortError } from "../../shared/errors.ts";
import { mergeHistoryImages } from "./domain/research-pages.ts";

export function useHistoryImages(site: string, month: string) {
	const activeRequest = useRef<AbortController | undefined>(undefined);
	const [cursor, setCursor] = useState<string>();
	const [error, setError] = useState<string>();
	const [images, setImages] = useState<HistoryImageObservation[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	useEffect(() => {
		activeRequest.current?.abort();
		const controller = new AbortController();
		activeRequest.current = controller;
		setCursor(undefined);
		setError(undefined);
		setImages([]);
		setLoading(true);
		setLoadingMore(false);
		fetchHistoryImages(site, month, { signal: controller.signal })
			.then((page) => {
				if (!controller.signal.aborted) {
					setCursor(page.cursor);
					setImages(page.images);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load image history");
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
	}, [month, site]);

	const loadMore = useCallback(() => {
		if (!cursor || loading || loadingMore || activeRequest.current) {
			return;
		}
		const controller = new AbortController();
		activeRequest.current = controller;
		setError(undefined);
		setLoadingMore(true);
		fetchHistoryImages(site, month, { cursor, signal: controller.signal })
			.then((page) => {
				if (!controller.signal.aborted) {
					setCursor(page.cursor);
					setImages((current) => mergeHistoryImages(current, page.images));
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load more images");
				}
			})
			.finally(() => {
				if (activeRequest.current === controller) {
					activeRequest.current = undefined;
					setLoadingMore(false);
				}
			});
	}, [cursor, loading, loadingMore, month, site]);

	return { error, hasMore: Boolean(cursor), images, loadMore, loading, loadingMore };
}
