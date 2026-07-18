import type { Snapshot, SnapshotGroup } from "../../../core/types.ts";

function groupKey(snapshot: Snapshot): string {
	return `${snapshot.name}\u0000${snapshot.triggeredAt}`;
}

export function groupSnapshotVariants(snapshots: Snapshot[]): SnapshotGroup[] {
	const groups = new Map<string, SnapshotGroup>();

	for (const snapshot of snapshots) {
		const key = groupKey(snapshot);
		const group = groups.get(key) ?? {
			brand: snapshot.brand,
			capturedAt: snapshot.capturedAt,
			category: snapshot.category,
			displayName: snapshot.displayName,
			name: snapshot.name,
			triggeredAt: snapshot.triggeredAt,
			url: snapshot.url,
			variants: {},
		};
		if (!group.displayName && snapshot.displayName) {
			group.displayName = snapshot.displayName;
		}
		group.variants[snapshot.device] = snapshot;
		groups.set(key, group);
	}

	return [...groups.values()].map((group) => ({
		...group,
		capturedAt: preferredVariant(group).capturedAt,
	}));
}

export function preferredVariant(group: SnapshotGroup): Snapshot {
	const variant = group.variants.desktop ?? group.variants.mobile;
	if (!variant) {
		throw new Error("Snapshot group has no captured variants");
	}
	return variant;
}
