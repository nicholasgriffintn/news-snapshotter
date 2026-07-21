import assert from "node:assert/strict";
import test from "node:test";

import { resolvePageMetadata } from "./page-metadata.ts";

test("describes the archive and history index as distinct search results", () => {
	const archive = resolvePageMetadata("archive", "", "/");
	const history = resolvePageMetadata("history", "", "/history");

	assert.equal(archive.canonicalPath, "/");
	assert.equal(archive.indexable, true);
	assert.match(archive.title, /Today’s News/);
	assert.equal(history.canonicalPath, "/history");
	assert.equal(history.indexable, true);
	assert.match(history.description, /editorial priorities/);
});

test("gives stable publisher overviews unique indexable metadata", () => {
	const metadata = resolvePageMetadata("history", "bbc-home", "/history/bbc-home");

	assert.equal(metadata.canonicalPath, "/history/bbc-home");
	assert.equal(metadata.indexable, true);
	assert.match(metadata.title, /^BBC Home/);
});

test("keeps variable research URLs out of the index and canonicalises them to the publisher", () => {
	const metadata = resolvePageMetadata("history", "bbc-home", "/history/bbc-home/compare");

	assert.equal(metadata.canonicalPath, "/history/bbc-home");
	assert.equal(metadata.indexable, false);
});

test("keeps utility and legal routes out of the search index", () => {
	for (const page of ["admin", "privacy", "terms"]) {
		assert.equal(resolvePageMetadata(page, "", `/${page}`).indexable, false);
	}
});

test("indexes the comparison briefing but not individual generated comparisons", () => {
	const briefing = resolvePageMetadata("compare", "", "/compare");
	const story = resolvePageMetadata("compare", "", "/compare/stories/story-1");

	assert.equal(briefing.indexable, true);
	assert.equal(briefing.canonicalPath, "/compare");
	assert.equal(story.indexable, false);
	assert.equal(story.canonicalPath, "/compare/stories/story-1");
});
