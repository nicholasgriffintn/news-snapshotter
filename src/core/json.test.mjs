import assert from "node:assert/strict";
import test from "node:test";

import {
	hasOnlyKeys,
	jsonRecord,
	parseJson,
	parseJsonRecord,
	parseJsonStringArray,
} from "./json.ts";

test("safely narrows persisted JSON projections", () => {
	assert.deepEqual(parseJsonRecord('{"topic":"health"}'), { topic: "health" });
	assert.deepEqual(jsonRecord({ topic: "health" }), { topic: "health" });
	assert.equal(jsonRecord([]), undefined);
	assert.deepEqual(parseJsonStringArray('["health"]'), ["health"]);
	assert.deepEqual(parseJsonStringArray("[1]"), []);
	assert.equal(parseJson("{"), undefined);
	assert.equal(hasOnlyKeys({ topic: "health" }, ["topic"]), true);
	assert.equal(hasOnlyKeys({ extra: true, topic: "health" }, ["topic"]), false);
});
