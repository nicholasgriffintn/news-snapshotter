import type { SavedTimelineObservation } from "../../core/types.ts";

export function savedTimelinesPath(site: string): string {
	return `/history/${encodeURIComponent(site)}/timelines`;
}

export function savedTimelinePath(site: string, slug: string): string {
	return `${savedTimelinesPath(site)}/${encodeURIComponent(slug)}`;
}

export type SavedTimelineObservationGroup = {
	elementKey: string;
	kind: SavedTimelineObservation["kind"];
	observations: SavedTimelineObservation[];
	position: number;
};

export function groupSavedTimelineObservations(
	observations: SavedTimelineObservation[],
): SavedTimelineObservationGroup[] {
	const groups = new Map<string, SavedTimelineObservationGroup>();
	for (const observation of observations) {
		const group = groups.get(observation.elementKey) ?? {
			elementKey: observation.elementKey,
			kind: observation.kind,
			observations: [],
			position: observation.position,
		};
		group.observations.push(observation);
		groups.set(observation.elementKey, group);
	}
	return [...groups.values()]
		.sort((left, right) => left.position - right.position)
		.map((group) => ({
			...group,
			observations: group.observations.sort((left, right) =>
				(left.capturedAt ?? "").localeCompare(right.capturedAt ?? ""),
			),
		}));
}
