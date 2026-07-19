import assert from "node:assert/strict";
import test from "node:test";

import { contentCategory } from "./content-classification.ts";

test("keeps extracted publisher sections ahead of URL inference", () => {
	assert.equal(
		contentCategory("https://www.bbc.co.uk/news/articles/story", "UK politics"),
		"UK politics",
	);
	assert.equal(contentCategory("https://edition.cnn.com/politics/story", "politics"), "Politics");
});

test("infers useful product and desk categories from publisher URLs", () => {
	assert.equal(contentCategory("https://www.bbc.co.uk/sport/football/articles/story"), "Sport");
	assert.equal(contentCategory("https://www.bbc.co.uk/news/articles/story"), "News");
	assert.equal(contentCategory("https://www.bbc.co.uk/iplayer/episode/story"), "iPlayer");
	assert.equal(contentCategory("https://www.theguardian.com/culture/story"), "Culture");
	assert.equal(contentCategory("https://www.telegraph.co.uk/politics/story"), "Politics");
	assert.equal(contentCategory("https://www.washingtonpost.com/weather/story"), "Weather");
	assert.equal(contentCategory(undefined), "Front page");
});
