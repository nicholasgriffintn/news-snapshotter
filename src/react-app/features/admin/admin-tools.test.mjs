import assert from "node:assert/strict";
import test from "node:test";

import {
	ADMIN_TOOL_DETAILS,
	ADMIN_TOOL_GROUPS,
	adminStateFromSearch,
	DEFAULT_ADMIN_TOOL,
} from "./admin-tools.ts";

test("groups every admin tool once in its directory order", () => {
	const groupedTools = ADMIN_TOOL_GROUPS.flatMap((group) => group.tools);
	const configuredTools = Object.keys(ADMIN_TOOL_DETAILS);

	assert.deepEqual(groupedTools, configuredTools);
	assert.equal(new Set(groupedTools).size, configuredTools.length);
	assert.ok(groupedTools.includes(DEFAULT_ADMIN_TOOL));
});

test("opens a linked admin tool with its site filter", () => {
	assert.deepEqual(adminStateFromSearch("?tool=extractors&site=bbc-home"), {
		site: "bbc-home",
		tool: "extractors",
	});
	assert.deepEqual(adminStateFromSearch("?tool=unknown"), {
		site: "",
		tool: DEFAULT_ADMIN_TOOL,
	});
});

test("describes extraction failures as part of the failure log", () => {
	assert.match(ADMIN_TOOL_DETAILS.failures.description, /capture and extraction/i);
});
