import type { ComparisonStorySummary, ComparisonWindow } from "./contracts.ts";

export type ComparisonPeriod = "24h" | "6h" | "date" | "latest";

export type ComparisonStoryFilters = {
	date: string;
	period: ComparisonPeriod;
	publisher: string;
	query: string;
	topic: string;
};

export const EMPTY_COMPARISON_STORY_FILTERS: ComparisonStoryFilters = {
	date: "",
	period: "latest",
	publisher: "",
	query: "",
	topic: "",
};

export function isComparisonPeriod(value: string): value is ComparisonPeriod {
	return value === "latest" || value === "6h" || value === "24h" || value === "date";
}

export function latestPublishedWindow(
	windows: readonly ComparisonWindow[],
): ComparisonWindow | undefined {
	return windows.find(({ status }) => status === "complete" || status === "partial");
}

export function comparisonStatusWindow(
	period: ComparisonPeriod,
	latestWindow: ComparisonWindow | undefined,
): ComparisonWindow | undefined {
	return period === "latest" ? latestWindow : undefined;
}

export function comparisonPeriodRange(
	period: ComparisonPeriod,
	latestEndsAt: string | undefined,
	date: string,
): { from: string; to: string } | undefined {
	if (period === "latest") {
		return undefined;
	}
	if (period === "date") {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return undefined;
		}
		const from = new Date(`${date}T00:00:00.000Z`);
		if (
			!Number.isFinite(from.getTime()) ||
			from.toISOString().slice(0, 10) !== date ||
			from.getTime() > Date.now()
		) {
			return undefined;
		}
		return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() };
	}
	const end = Date.parse(latestEndsAt ?? "");
	if (!Number.isFinite(end)) {
		return undefined;
	}
	const hours = period === "6h" ? 6 : 24;
	return {
		from: new Date(end - hours * 60 * 60_000).toISOString(),
		to: new Date(end).toISOString(),
	};
}

export function filterComparisonStories(
	stories: readonly ComparisonStorySummary[],
	filters: ComparisonStoryFilters,
): ComparisonStorySummary[] {
	const query = filters.query.trim().toLocaleLowerCase("en-GB");

	return stories.filter((story) => {
		const matchesQuery =
			!query ||
			story.label.toLocaleLowerCase("en-GB").includes(query) ||
			story.topics.some((topic) => topic.toLocaleLowerCase("en-GB").includes(query)) ||
			story.publishers.some((publisher) =>
				publisher.displayName.toLocaleLowerCase("en-GB").includes(query),
			);

		const matchesPublisher =
			!filters.publisher ||
			story.publishers.some((publisher) => publisher.site === filters.publisher);

		const matchesTopic = !filters.topic || story.topics.includes(filters.topic);

		return matchesQuery && matchesPublisher && matchesTopic;
	});
}

export function comparisonStoryFiltersActive(filters: ComparisonStoryFilters): boolean {
	return Boolean(
		filters.query || filters.publisher || filters.topic || filters.period !== "latest",
	);
}
