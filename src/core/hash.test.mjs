import assert from "node:assert/strict";
import test from "node:test";

import { sha256 } from "./hash.ts";

test("creates stable lowercase SHA-256 identifiers", async () => {
	assert.equal(
		await sha256("news-snapshotter"),
		"609d15f9dc640f4110114fc95eddd050a1f58a77a41b1d130bf44f003c23d6e2",
	);
});
