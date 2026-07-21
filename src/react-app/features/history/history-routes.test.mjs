import assert from "node:assert/strict";
import test from "node:test";

import {
	contentHistoryPath,
	contentKeyFromSearch,
	publisherResearchPath,
} from "./history-routes.ts";

const contentKey = "https://www.bbc.co.uk/sounds/play/m002ym7v";

test("keeps every content identity out of path segments", () => {
	const path = contentHistoryPath("bbc-home", contentKey);
	const url = new URL(path, "https://archive.example");
	assert.equal(url.pathname, "/history/bbc-home/content");
	assert.equal(url.searchParams.get("element"), contentKey);
	assert.equal(contentKeyFromSearch(url.search), contentKey);
});

test("links publisher evidence to the comparison section of publisher research", () => {
	assert.equal(publisherResearchPath("times/com"), "/history/times%2Fcom/research#comparison");
});
