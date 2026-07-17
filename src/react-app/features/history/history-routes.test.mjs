import assert from "node:assert/strict";
import test from "node:test";

import { storyHistoryPath, storyIdFromSearch } from "./history-routes.ts";

const storyId = "bbc-home:https://www.bbc.co.uk/sounds/play/m002ym7v";

test("keeps story URLs out of path segments", () => {
	const path = storyHistoryPath("bbc-home", storyId);
	const url = new URL(path, "https://archive.example");
	assert.equal(url.pathname, "/history/bbc-home/stories");
	assert.equal(url.searchParams.get("story"), storyId);
	assert.equal(storyIdFromSearch(url.search), storyId);
});
