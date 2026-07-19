import assert from "node:assert/strict";
import test from "node:test";

import { environmentBadge } from "./site-environment.ts";

test("keeps the live brand mark unbadged", () => {
	assert.equal(environmentBadge("production"), undefined);
});

test("uses distinct badges for development, preview, and test builds", () => {
	assert.deepEqual(environmentBadge("development"), {
		label: "Development",
		tone: "development",
	});
	assert.deepEqual(environmentBadge("staging"), { label: "Preview", tone: "preview" });
	assert.deepEqual(environmentBadge("test"), { label: "Test", tone: "test" });
});
