import { useEffect, useState } from "react";

import { jsonRecord } from "../../../core/json.ts";

export class ComparisonRequestError extends Error {}

export async function comparisonRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	const value: unknown = await response.json();
	if (!response.ok) {
		const document = jsonRecord(value);
		const message =
			typeof document?.message === "string"
				? document.message
				: "Comparison data could not be loaded";

		throw new ComparisonRequestError(message);
	}

	return value as T;
}

export function useComparisonData<T>(path: string) {
	const [state, setState] = useState<{
		data?: T;
		error?: string;
		loading: boolean;
	}>({ loading: true });

	useEffect(() => {
		const controller = new AbortController();

		setState((current) => ({
			data: current.data,
			loading: true,
		}));

		comparisonRequest<T>(path, { signal: controller.signal })
			.then((data) => {
				setState({
					data,
					loading: false,
				});
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted) {
					setState({
						error: error instanceof Error ? error.message : "Comparison data could not be loaded",
						loading: false,
					});
				}
			});

		return () => controller.abort();
	}, [path]);

	return state;
}
