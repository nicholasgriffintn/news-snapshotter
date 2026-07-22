import { useCallback, useEffect, useRef, useState } from "react";

import { jsonRecord } from "../../../core/json.ts";
import type { ComparisonStorySummary } from "./domain/contracts.ts";

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

export function useComparisonData<T>(path: string | undefined) {
	const [state, setState] = useState<{
		data?: T;
		error?: string;
		loading: boolean;
	}>({ loading: true });

	useEffect(() => {
		const controller = new AbortController();
		if (!path) {
			setState({ loading: false });
			return () => controller.abort();
		}

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

type ComparisonStoryPage = {
	cursor?: string;
	facets: {
		publishers: Array<{ displayName: string; site: string }>;
		topics: string[];
	};
	stories: ComparisonStorySummary[];
};

export function useComparisonStoryPages(path: string | undefined) {
	const generation = useRef(0);
	const [state, setState] = useState<{
		cursor?: string;
		error?: string;
		facets?: ComparisonStoryPage["facets"];
		loaded: boolean;
		loading: boolean;
		loadingMore: boolean;
		stories: ComparisonStorySummary[];
	}>({ loaded: false, loading: Boolean(path), loadingMore: false, stories: [] });

	useEffect(() => {
		const currentGeneration = ++generation.current;
		const controller = new AbortController();
		if (!path) {
			setState({ loaded: false, loading: false, loadingMore: false, stories: [] });
			return () => controller.abort();
		}
		setState({ loaded: false, loading: true, loadingMore: false, stories: [] });
		comparisonRequest<ComparisonStoryPage>(path, { signal: controller.signal })
			.then((data) => {
				if (generation.current === currentGeneration) {
					setState({
						cursor: data.cursor,
						facets: data.facets,
						loaded: true,
						loading: false,
						loadingMore: false,
						stories: data.stories,
					});
				}
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted && generation.current === currentGeneration) {
					setState({
						error: error instanceof Error ? error.message : "Comparison data could not be loaded",
						loaded: false,
						loading: false,
						loadingMore: false,
						stories: [],
					});
				}
			});
		return () => controller.abort();
	}, [path]);

	const loadMore = useCallback(async () => {
		if (!path || !state.cursor || state.loadingMore) {
			return;
		}
		const currentGeneration = generation.current;
		setState((current) => ({ ...current, error: undefined, loadingMore: true }));
		try {
			const separator = path.includes("?") ? "&" : "?";
			const page = await comparisonRequest<ComparisonStoryPage>(
				`${path}${separator}cursor=${encodeURIComponent(state.cursor)}`,
			);
			if (generation.current !== currentGeneration) {
				return;
			}
			setState((current) => {
				const seen = new Set(
					current.stories.map(({ revisionId, storyId }) => `${storyId}:${revisionId}`),
				);
				return {
					...current,
					cursor: page.cursor,
					loadingMore: false,
					stories: [
						...current.stories,
						...page.stories.filter(
							({ revisionId, storyId }) => !seen.has(`${storyId}:${revisionId}`),
						),
					],
				};
			});
		} catch (error) {
			if (generation.current === currentGeneration) {
				setState((current) => ({
					...current,
					error: error instanceof Error ? error.message : "More comparisons could not be loaded",
					loadingMore: false,
				}));
			}
		}
	}, [path, state.cursor, state.loadingMore]);

	return {
		data: state.loaded
			? { cursor: state.cursor, facets: state.facets, stories: state.stories }
			: undefined,
		error: state.error,
		loadMore,
		loading: state.loading,
		loadingMore: state.loadingMore,
	};
}
