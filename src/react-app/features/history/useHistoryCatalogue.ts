import { useEffect, useMemo, useState } from "react";

import type { CatalogueSite } from "../../core/types.ts";
import { fetchCatalogue } from "../../platform/api-client.ts";

export function useHistoryCatalogue(): ReadonlyMap<string, CatalogueSite> {
	const [sites, setSites] = useState<CatalogueSite[]>([]);

	useEffect(() => {
		const controller = new AbortController();
		fetchCatalogue({ signal: controller.signal })
			.then((catalogue) => {
				if (!controller.signal.aborted) {
					setSites(catalogue);
				}
			})
			.catch(() => {
				// History remains usable with names inferred from storage identifiers.
			});

		return () => controller.abort();
	}, []);

	return useMemo(() => new Map(sites.map((site) => [site.name, site])), [sites]);
}
