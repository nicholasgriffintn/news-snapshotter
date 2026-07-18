import assert from "node:assert/strict";
import test from "node:test";

import { storyCategory } from "./story-classification.ts";

test("keeps extracted publisher sections ahead of URL inference", () => {
	assert.equal(
		storyCategory("https://www.bbc.co.uk/news/articles/story", "UK politics"),
		"UK politics",
	);
	assert.equal(storyCategory("https://edition.cnn.com/politics/story", "politics"), "Politics");
});

test("infers useful product and desk categories from publisher URLs", () => {
	assert.equal(storyCategory("https://www.bbc.co.uk/sport/football/articles/story"), "Sport");
	assert.equal(storyCategory("https://www.bbc.co.uk/news/articles/story"), "News");
	assert.equal(storyCategory("https://www.bbc.co.uk/iplayer/episode/story"), "iPlayer");
	assert.equal(storyCategory("https://www.theguardian.com/culture/story"), "Culture");
	assert.equal(storyCategory("https://www.telegraph.co.uk/politics/story"), "Politics");
	assert.equal(storyCategory("https://www.washingtonpost.com/weather/story"), "Weather");
	assert.equal(storyCategory(undefined), "Front page");
});
