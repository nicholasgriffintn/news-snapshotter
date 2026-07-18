import assert from "node:assert/strict";
import test from "node:test";

import { urlsMatchIgnoringHash } from "./urls.ts";

test("compares normalised capture URLs while ignoring fragments", () => {
	assert.equal(urlsMatchIgnoringHash("https://example.com", "https://example.com/#top"), true);
	assert.equal(
		urlsMatchIgnoringHash("https://www.bbc.co.uk/news", "https://www.bbc.com/news"),
		false,
	);
	assert.equal(
		urlsMatchIgnoringHash("https://example.com/news", "https://example.com/world"),
		false,
	);
	assert.equal(
		urlsMatchIgnoringHash("https://example.com/?edition=uk", "https://example.com/"),
		false,
	);
});
