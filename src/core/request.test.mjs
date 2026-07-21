import assert from "node:assert/strict";
import test from "node:test";

import { PayloadTooLargeError } from "./errors.ts";
import { readBoundedJson } from "./request.ts";

test("reads JSON without trusting content-length for the body limit", async () => {
	assert.deepEqual(
		await readBoundedJson(
			new Request("https://example.com", { body: '{"ok":true}', method: "POST" }),
			32,
		),
		{ ok: true },
	);
	await assert.rejects(
		readBoundedJson(new Request("https://example.com", { body: '"123456"', method: "POST" }), 4),
		PayloadTooLargeError,
	);
});
