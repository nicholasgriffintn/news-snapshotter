import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppPage } from "./app-route.ts";

test("routes the history index and nested history pages", () => {
	assert.equal(resolveAppPage("/history"), "history");
	assert.equal(resolveAppPage("/history/bbc-home"), "history");
	assert.equal(resolveAppPage("/history-research"), "archive");
});
