import assert from "node:assert/strict";
import test from "node:test";

import { historySearchQuery } from "./search-query.ts";

test("turns user text into a bounded literal FTS prefix query", () => {
	assert.equal(historySearchQuery('Election OR "result"'), '"election"* AND "or"* AND "result"*');
	assert.throws(() => historySearchQuery("!!!"), /searchable text/);
});
