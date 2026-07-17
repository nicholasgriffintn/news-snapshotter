import { useCallback, useEffect, useMemo, useState } from "react";

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

function urlState() {
	const search = new URLSearchParams(window.location.search);
	return {
		captureId: search.get("capture") ?? undefined,
		compareId: search.get("compare") ?? undefined,
		overlay: search.get("overlay") === "1",
	};
}

function writeUrl(state: ReturnType<typeof urlState>, replace = false) {
	const url = new URL(window.location.href);
	if (state.captureId) url.searchParams.set("capture", state.captureId);
	else url.searchParams.delete("capture");
	if (state.compareId) url.searchParams.set("compare", state.compareId);
	else url.searchParams.delete("compare");
	if (state.overlay) url.searchParams.set("overlay", "1");
	else url.searchParams.delete("overlay");
	window.history[replace ? "replaceState" : "pushState"]({}, "", url);
}

export function useHistoryPage(site: string) {
	const [captures, setCaptures] = useState<HistoryCaptureSummary[]>([]);
	const [captureCursor, setCaptureCursor] = useState<string>();
	const [selection, setSelection] = useState(urlState);
	const [capture, setCapture] = useState<HistoryCapture>();
	const [changes, setChanges] = useState<HistoryChange[]>([]);
	const [failures, setFailures] = useState<HistoryFailure[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		function onPopState() {
			setSelection(urlState());
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	useEffect(() => {
		setLoading(true);
		Promise.all([fetchHistoryCaptures(site), fetchHistoryFailures(site)])
			.then(([capturePage, failurePage]) => {
				setCaptures(capturePage.captures);
				setCaptureCursor(capturePage.cursor);
				setFailures(failurePage);
				if (!selection.captureId && capturePage.captures[0]) {
					const captureId = capturePage.captures[0].captureId;
					const compareId = capturePage.captures[1]?.captureId;
					const next = { ...selection, captureId, compareId };
					setSelection(next);
					writeUrl(next, true);
				}
			})
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setLoading(false));
	}, [site]);

	useEffect(() => {
		if (!selection.captureId) return;
		setLoading(true);
		fetchHistoryCapture(site, selection.captureId)
			.then(async (nextCapture) => {
				setCapture(nextCapture);
				setChanges(await fetchHistoryChanges(site, nextCapture.capture.capturedAt));
			})
			.catch((reason: Error) => setError(reason.message))
			.finally(() => setLoading(false));
	}, [selection.captureId, site]);

	const selectedIndex = captures.findIndex(({ captureId }) => captureId === selection.captureId);
	const newer = selectedIndex > 0 ? captures[selectedIndex - 1] : undefined;
	const older = selectedIndex >= 0 ? captures[selectedIndex + 1] : undefined;

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
		if (!captureCursor) return;
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
		failures,
		loadOlder,
		loading,
		loadingOlder,
		newer,
		older,
		selectCapture,
		selection,
		toggleOverlay,
	};
}
