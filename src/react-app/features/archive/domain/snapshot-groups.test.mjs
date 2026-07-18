import assert from "node:assert/strict";
import test from "node:test";

import { groupSnapshotVariants, preferredVariant } from "./snapshot-groups.ts";

function snapshot(
	device,
	capturedAt = "2026-07-17T09:00:05.000Z",
	triggeredAt = "2026-07-17T09:00:01.000Z",
) {
	return {
		brand: "bbc",
		capturedAt,
		category: "news",
		device,
		displayName: "BBC",
		fullImageUrl: `/full-${device}.png`,
		key: `bbc-home-${device}-${capturedAt}`,
		name: "bbc-home",
		thumbnailUrl: `/thumb-${device}.jpg`,
		triggeredAt,
		url: "https://www.bbc.co.uk/",
	};
}

test("combines desktop and mobile variants from the same site capture", () => {
	const groups = groupSnapshotVariants([
		snapshot("mobile", "2026-07-17T09:00:20.000Z"),
		snapshot("desktop", "2026-07-17T09:00:10.000Z"),
	]);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].variants.desktop.device, "desktop");
	assert.equal(groups[0].variants.mobile.device, "mobile");
	assert.equal(preferredVariant(groups[0]).device, "desktop");
	assert.equal(groups[0].capturedAt, "2026-07-17T09:00:10.000Z");
	assert.equal(groups[0].displayName, "BBC");
});

test("keeps separate runs from the same five-minute window as separate cards", () => {
	const groups = groupSnapshotVariants([
		snapshot("desktop", "2026-07-17T09:00:05.000Z", "2026-07-17T09:00:01.000Z"),
		snapshot("desktop", "2026-07-17T09:05:02.000Z", "2026-07-17T09:04:59.000Z"),
	]);

	assert.equal(groups.length, 2);
});

test("uses mobile as the preview when it is the only captured variant", () => {
	const [group] = groupSnapshotVariants([snapshot("mobile")]);

	assert.equal(preferredVariant(group).device, "mobile");
});
