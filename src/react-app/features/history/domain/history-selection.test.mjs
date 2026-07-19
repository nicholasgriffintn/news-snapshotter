import assert from "node:assert/strict";
import test from "node:test";

import { normaliseHistorySelection } from "./history-selection.ts";

const captures = [
	{ captureId: "bbc-home:desktop:latest" },
	{ captureId: "bbc-home:desktop:previous" },
];

test("selects the latest desktop edge when URL state is empty", () => {
	assert.deepEqual(normaliseHistorySelection({ overlay: false }, captures), {
		captureId: "bbc-home:desktop:latest",
		compareId: "bbc-home:desktop:previous",
		overlay: false,
	});
});

test("replaces a legacy mobile comparison with the adjacent desktop capture", () => {
	assert.deepEqual(
		normaliseHistorySelection(
			{
				captureId: "bbc-home:desktop:latest",
				compareId: "bbc-home:mobile:legacy",
				overlay: true,
			},
			captures,
		),
		{
			captureId: "bbc-home:desktop:latest",
			compareId: "bbc-home:desktop:previous",
			overlay: true,
		},
	);
});
