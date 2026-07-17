import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorised } from "./auth.ts";

test("authorises an exact bearer token", () => {
	assert.equal(isAuthorised("Bearer correct-secret", "correct-secret"), true);
});

test("rejects missing, malformed, empty, and incorrect credentials", () => {
	assert.equal(isAuthorised(null, "correct-secret"), false);
	assert.equal(isAuthorised("correct-secret", "correct-secret"), false);
	assert.equal(isAuthorised("Bearer correct-secret", ""), false);
	assert.equal(isAuthorised("Bearer wrong-secret", "correct-secret"), false);
	assert.equal(isAuthorised("Bearer correct-secret-extra", "correct-secret"), false);
});
