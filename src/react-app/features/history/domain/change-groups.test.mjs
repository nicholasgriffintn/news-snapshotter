import assert from "node:assert/strict";
import test from "node:test";

import { changeLabel, changeValue, groupHistoryChanges } from "./change-groups.ts";

test("groups history changes into reader-facing categories", () => {
	const grouped = groupHistoryChanges([
		{ type: "appeared" },
		{ type: "headline-changed" },
		{ type: "kind-changed" },
		{ type: "promoted" },
		{ type: "position-changed" },
	]);

	assert.equal(grouped.get("appeared").length, 1);
	assert.equal(grouped.get("content").length, 2);
	assert.equal(grouped.get("prominence").length, 1);
	assert.equal(grouped.get("position").length, 1);
});

test("formats change labels and values without losing structured evidence", () => {
	assert.equal(changeLabel("headline-changed"), "headline changed");
	assert.equal(changeValue(null), "None");
	assert.equal(changeValue({ rank: 3 }), '{"rank":3}');
});
