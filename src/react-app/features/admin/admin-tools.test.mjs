import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_TOOL_DETAILS, ADMIN_TOOL_GROUPS, DEFAULT_ADMIN_TOOL } from "./admin-tools.ts";

test("groups every admin tool once in its directory order", () => {
	const groupedTools = ADMIN_TOOL_GROUPS.flatMap((group) => group.tools);
	const configuredTools = Object.keys(ADMIN_TOOL_DETAILS);

	assert.deepEqual(groupedTools, configuredTools);
	assert.equal(new Set(groupedTools).size, configuredTools.length);
	assert.ok(groupedTools.includes(DEFAULT_ADMIN_TOOL));
});
