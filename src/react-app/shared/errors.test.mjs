import assert from "node:assert/strict";
import test from "node:test";

import { isAbortError } from "./errors.ts";

test("recognises aborted requests without hiding other errors", () => {
	const aborted = new Error("This operation was aborted");
	aborted.name = "AbortError";

	assert.equal(isAbortError(aborted), true);
	assert.equal(isAbortError(new Error("capture failed")), false);
	assert.equal(isAbortError("AbortError"), false);
});
