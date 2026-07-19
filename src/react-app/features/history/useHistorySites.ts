import { useEffect, useState } from "react";

import type { HistorySite } from "../../core/types.ts";
import { fetchHistorySites } from "../../platform/api-client.ts";
import { isAbortError } from "../../shared/errors.ts";

export function useHistorySites() {
	const [sites, setSites] = useState<HistorySite[]>([]);
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const controller = new AbortController();
		fetchHistorySites({ signal: controller.signal })
			.then((nextSites) => {
				if (!controller.signal.aborted) {
					setSites(nextSites);
				}
			})
			.catch((reason: unknown) => {
				if (!isAbortError(reason)) {
					setError(reason instanceof Error ? reason.message : "Could not load history sites");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, []);

	return { error, loading, sites };
}
