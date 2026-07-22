import { useCallback, useEffect, useMemo, useState } from "react";

import { isAbortError } from "../../shared/errors.ts";
import {
	fetchHistoryCapture,
	fetchHistoryCaptures,
	fetchHistoryChanges,
	fetchHistoryFailures,
} from "../../platform/api-client.ts";
import type {
	HistoryCapture,
	HistoryCaptureSummary,
	HistoryChange,
	HistoryFailure,
} from "../../core/types.ts";
import { normaliseHistorySelection, type HistorySelection } from "./domain/history-selection.ts";

function urlState(): HistorySelection {
	const search = new URLSearchParams(window.location.search);
	return {
		captureId: search.get("capture") ?? undefined,
		compareId: search.get("compare") ?? undefined,
		overlay: search.get("overlay") === "1",
	};
}

function writeUrl(state: ReturnType<typeof urlState>, replace = false) {
	const url = new URL(window.location.href);
	if (state.captureId) {
		url.searchParams.set("capture", state.captureId);
	} else {
		url.searchParams.delete("capture");
	}
	if (state.compareId) {
		url.searchParams.set("compare", state.compareId);
	} else {
		url.searchParams.delete("compare");
	}
	if (state.overlay) {
		url.searchParams.set("overlay", "1");
	} else {
		url.searchParams.delete("overlay");
	}
	window.history[replace ? "replaceState" : "pushState"]({}, "", url);
}

export function useHistoryPage(site: string) {
	const [captures, setCaptures] = useState<HistoryCaptureSummary[]>([]);
	const [captureCursor, setCaptureCursor] = useState<string>();
	const [selection, setSelection] = useState(urlState);
	const [capture, setCapture] = useState<HistoryCapture>();
	const [changes, setChanges] = useState<HistoryChange[]>([]);
	const [failures, setFailures] = useState<HistoryFailure[]>([]);
	const [failureCursor, setFailureCursor] = useState<string>();
	const [loadingCaptures, setLoadingCaptures] = useState(true);
	const [loadingCapture, setLoadingCapture] = useState(false);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [loadingMoreFailures, setLoadingMoreFailures] = useState(false);
	const [error, setError] = useState("");
	const [failureError, setFailureError] = useState("");

	useEffect(() => {
		function onPopState() {
			setSelection(urlState());
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		setLoadingCaptures(true);
		setError("");
		setCaptures([]);
		setCaptureCursor(undefined);
		fetchHistoryCaptures(site, undefined, { signal: controller.signal })
			.then((capturePage) => {
				if (controller.signal.aborted) {
					return;
				}
				setCaptures(capturePage.captures);
				setCaptureCursor(capturePage.cursor);
				setSelection((current) => {
					const next = normaliseHistorySelection(current, capturePage.captures);
					if (next !== current) {
						writeUrl(next, true);
					}
					return next;
				});
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load capture history");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingCaptures(false);
				}
			});
		return () => controller.abort();
	}, [site]);

	useEffect(() => {
		const controller = new AbortController();
		setFailures([]);
		setFailureCursor(undefined);
		setFailureError("");
		fetchHistoryFailures(site, { signal: controller.signal })
			.then((page) => {
				if (!controller.signal.aborted) {
					setFailures(page.failures);
					setFailureCursor(page.cursor);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setFailureError(
						reason instanceof Error ? reason.message : "Could not load failure notices",
					);
				}
			});
		return () => controller.abort();
	}, [site]);

	useEffect(() => {
		if (!selection.captureId) {
			setCapture(undefined);
			setChanges([]);
			setLoadingCapture(false);
			return;
		}
		const controller = new AbortController();
		setLoadingCapture(true);
		setError("");
		setCapture(undefined);
		setChanges([]);
		fetchHistoryCapture(site, selection.captureId, { signal: controller.signal })
			.then(async (nextCapture) => {
				const nextChanges = await fetchHistoryChanges(site, nextCapture.capture.capturedAt, {
					signal: controller.signal,
				});
				if (controller.signal.aborted) {
					return;
				}
				setCapture(nextCapture);
				setChanges(nextChanges);
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load capture");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingCapture(false);
				}
			});
		return () => controller.abort();
	}, [selection.captureId, site]);

	const selectCapture = useCallback(
		(captureId: string) => {
			const index = captures.findIndex((candidate) => candidate.captureId === captureId);
			const next = {
				...selection,
				captureId,
				compareId: index >= 0 ? captures[index + 1]?.captureId : undefined,
			};
			setSelection(next);
			writeUrl(next);
		},
		[captures, selection],
	);

	const toggleOverlay = useCallback(() => {
		const next = { ...selection, overlay: !selection.overlay };
		setSelection(next);
		writeUrl(next, true);
	}, [selection]);

	const loadOlder = useCallback(async () => {
		if (!captureCursor) {
			return;
		}
		setLoadingOlder(true);
		try {
			const page = await fetchHistoryCaptures(site, captureCursor);
			setCaptures((current) => [...current, ...page.captures]);
			setCaptureCursor(page.cursor);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Could not load older captures");
		} finally {
			setLoadingOlder(false);
		}
	}, [captureCursor, site]);

	const loadMoreFailures = useCallback(async () => {
		if (!failureCursor || loadingMoreFailures) {
			return;
		}
		setLoadingMoreFailures(true);
		setFailureError("");
		try {
			const page = await fetchHistoryFailures(site, { cursor: failureCursor });
			if (page.cursor && page.cursor === failureCursor) {
				throw new Error("Failure pagination did not advance");
			}
			setFailures((current) => {
				const seen = new Set(
					current.map(
						({ captureId, failedAt, stage }) => `${failedAt}:${captureId ?? ""}:${stage}`,
					),
				);
				return [
					...current,
					...page.failures.filter(
						({ captureId, failedAt, stage }) =>
							!seen.has(`${failedAt}:${captureId ?? ""}:${stage}`),
					),
				];
			});
			setFailureCursor(page.cursor);
		} catch (reason) {
			setFailureError(reason instanceof Error ? reason.message : "Could not load older failures");
		} finally {
			setLoadingMoreFailures(false);
		}
	}, [failureCursor, loadingMoreFailures, site]);

	const edgeChanges = useMemo(() => {
		return changes.filter((change) => {
			return (
				change.currentCaptureId === selection.captureId &&
				(!selection.compareId || change.previousCaptureId === selection.compareId)
			);
		});
	}, [changes, selection.captureId, selection.compareId]);

	return {
		capture,
		captureCursor,
		captures,
		changes: edgeChanges,
		error,
		failureError,
		failures,
		failureCursor,
		loadOlder,
		loadMoreFailures,
		loading: loadingCaptures || loadingCapture,
		loadingMoreFailures,
		loadingOlder,
		selectCapture,
		selection,
		toggleOverlay,
	};
}
