import assert from "node:assert/strict";
import test from "node:test";

import { researchStateFromSearch } from "./research-state.ts";

const now = new Date("2026-07-19T14:00:00.000Z");

test("restores a valid shareable research state", () => {
	assert.deepEqual(
		researchStateFromSearch("?q=Burnham&mode=main-headline-words&period=90d&month=2026-06", now),
		{
			mode: "main-headline-words",
			month: "2026-06",
			period: "90d",
			query: "Burnham",
		},
	);
});

test("replaces invalid research filters with usable defaults", () => {
	assert.deepEqual(researchStateFromSearch("?mode=unknown&period=forever&month=2026-99", now), {
		mode: "category",
		month: "2026-07",
		period: "30d",
		query: "",
	});
});
