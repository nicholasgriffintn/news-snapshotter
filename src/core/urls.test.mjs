import assert from "node:assert/strict";
import test from "node:test";

import { isWebUrl, urlsMatchIgnoringHash } from "./urls.ts";

test("accepts HTTP publisher URLs and rejects executable targets", () => {
	assert.equal(isWebUrl("https://example.com/story"), true);
	assert.equal(isWebUrl("http://example.com/story"), true);
	assert.equal(isWebUrl("javascript:openPrivacySettings()"), false);
	assert.equal(isWebUrl("data:image/png;base64,abc"), false);
});

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
