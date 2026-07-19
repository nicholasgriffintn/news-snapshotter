import { useCallback, useEffect, useRef, useState } from "react";

import type { ElementHistory } from "../../core/types.ts";
import { fetchElementHistory } from "../../platform/api-client.ts";
import { isAbortError } from "../../shared/errors.ts";
import { mergeElementHistoryPages } from "./domain/element-history-pages.ts";

export function useElementHistory(site: string, elementKey: string) {
	const [history, setHistory] = useState<ElementHistory>();
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(true);
	const [loadingEarlier, setLoadingEarlier] = useState(false);
	const earlierRequest = useRef<AbortController | undefined>(undefined);

	useEffect(() => {
		const controller = new AbortController();
		earlierRequest.current?.abort();
		earlierRequest.current = undefined;
		setError(undefined);
		setHistory(undefined);
		setLoading(true);
		setLoadingEarlier(false);
		fetchElementHistory(site, elementKey, { signal: controller.signal })
			.then((nextHistory) => {
				if (!controller.signal.aborted) {
					setHistory(nextHistory);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load content history");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, [elementKey, site]);

	useEffect(() => {
		return () => earlierRequest.current?.abort();
	}, []);

	const loadEarlier = useCallback(async () => {
		if (!history?.cursor || earlierRequest.current) {
			return;
		}
		const controller = new AbortController();
		earlierRequest.current = controller;
		setError(undefined);
		setLoadingEarlier(true);
		try {
			const older = await fetchElementHistory(site, elementKey, {
				cursor: history.cursor,
				signal: controller.signal,
			});
			if (!controller.signal.aborted) {
				setHistory((current) => (current ? mergeElementHistoryPages(current, older) : older));
			}
		} catch (reason) {
			if (!isAbortError(reason)) {
				setError(reason instanceof Error ? reason.message : "Could not load earlier observations");
			}
		} finally {
			if (earlierRequest.current === controller) {
				earlierRequest.current = undefined;
				setLoadingEarlier(false);
			}
		}
	}, [elementKey, history, site]);

	return { error, history, loadEarlier, loading, loadingEarlier };
}
