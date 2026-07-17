import assert from "node:assert/strict";
import test from "node:test";

import { runBotCheck } from "./bot-check.ts";

test("captures amiabot with every device from the selected profile", async () => {
	const captures = [];
	const capture = async (_env, site, device, triggeredAt) => {
		captures.push({ device, site, triggeredAt });
		return { device, key: `${device}.png`, name: site.name, status: "success" };
	};

	const result = await runBotCheck({}, "bbc", capture);

	assert.equal(result.url, "https://amiabot.app/");
	assert.equal(result.profile, "bbc");
	assert.deepEqual(
		captures.map(({ device }) => device),
		["desktop", "mobile"],
	);
	assert.ok(captures.every(({ site }) => site.profile === "bbc"));
	assert.ok(captures.every(({ site }) => site.url === "https://amiabot.app/"));
	assert.ok(captures.every(({ site }) => site.name === "amiabot-bbc"));
	assert.ok(captures.every(({ site }) => site.visibility === "admin"));
	assert.ok(captures.every(({ site }) => site.completion.selector === "#status"));
	assert.ok(captures.every(({ site }) => site.runtimeQuietMs === 12_000));
	assert.ok(captures.every(({ site }) => site.completion.textStartsWith === "Classification:"));
	assert.ok(captures.every(({ triggeredAt }) => triggeredAt === result.triggeredAt));
});

test("returns failed device results without retrying them", async () => {
	let attempts = 0;
	const capture = async (_env, site, device) => {
		attempts += 1;
		return { device, error: "detected as bot", name: site.name, status: "error" };
	};

	const result = await runBotCheck({}, "default", capture);

	assert.equal(attempts, 2);
	assert.ok(result.results.every(({ status }) => status === "error"));
});
