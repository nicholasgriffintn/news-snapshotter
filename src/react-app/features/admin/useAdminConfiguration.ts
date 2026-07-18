import { useEffect, useState } from "react";

import type { CaptureProviderName, CatalogueSite } from "../../core/types.ts";
import {
	fetchCaptureProfiles,
	fetchCaptureProviders,
	fetchCatalogue,
} from "../../platform/api-client.ts";

type AdminConfiguration = {
	catalogue: CatalogueSite[];
	profiles: string[];
	providers: CaptureProviderName[];
	status: "error" | "loading" | "ready";
};

const EMPTY_CONFIGURATION: AdminConfiguration = {
	catalogue: [],
	profiles: [],
	providers: [],
	status: "loading",
};

export function useAdminConfiguration(): AdminConfiguration {
	const [configuration, setConfiguration] = useState(EMPTY_CONFIGURATION);

	useEffect(() => {
		let cancelled = false;

		Promise.all([fetchCatalogue(), fetchCaptureProfiles(), fetchCaptureProviders()])
			.then(([catalogue, profiles, providers]) => {
				if (!cancelled) {
					setConfiguration({ catalogue, profiles, providers, status: "ready" });
				}
			})
			.catch(() => {
				if (!cancelled) {
					setConfiguration({ ...EMPTY_CONFIGURATION, status: "error" });
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return configuration;
}
