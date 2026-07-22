import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppPage } from "./app-route.ts";

test("resolves the archive only for the home route", () => {
	assert.equal(resolveAppPage("/"), "archive");
	assert.equal(resolveAppPage("/missing"), "not-found");
});

test("rejects invalid nested static routes", () => {
	assert.equal(resolveAppPage("/privacy/extra"), "not-found");
	assert.equal(resolveAppPage("/terms/extra"), "not-found");
});
