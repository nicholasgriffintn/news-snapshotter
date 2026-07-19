import assert from "node:assert/strict";
import test from "node:test";

import { mergeHistoryImages, mergeHistorySearchResults } from "./research-pages.ts";

test("merges research pages without repeating records at a page boundary", () => {
	assert.deepEqual(
		mergeHistorySearchResults(
			[
				{ elementKey: "story-1", site: "bbc-home" },
				{ elementKey: "story-2", site: "bbc-home" },
			],
			[
				{ elementKey: "story-2", site: "bbc-home" },
				{ elementKey: "story-3", site: "bbc-home" },
			],
		),
		[
			{ elementKey: "story-1", site: "bbc-home" },
			{ elementKey: "story-2", site: "bbc-home" },
			{ elementKey: "story-3", site: "bbc-home" },
		],
	);

	assert.deepEqual(
		mergeHistoryImages(
			[{ imageId: "image-1" }, { imageId: "image-2" }],
			[{ imageId: "image-2" }, { imageId: "image-3" }],
		),
		[{ imageId: "image-1" }, { imageId: "image-2" }, { imageId: "image-3" }],
	);
});
