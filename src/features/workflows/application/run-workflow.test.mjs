import assert from "node:assert/strict";
import test from "node:test";

import { runSnapshotWorkflow } from "./run-workflow.ts";

const triggeredAt = "2026-07-16T10:20:30.123Z";
const sites = [
	{ brand: "bbc", category: "news", name: "bbc-home", url: "https://bbc.co.uk" },
	{ brand: "sky", category: "sport", name: "sky-sports", url: "https://skysports.com" },
];

test("runs one durable step per site and device and aggregates results", async () => {
	const stepNames = [];
	const captures = [];
	const step = {
		do: async (name, _config, callback) => {
			stepNames.push(name);
			return callback();
		},
	};
	const capture = async (_env, site, device, timestamp) => {
		captures.push({ device, name: site.name, timestamp });
		return device === "desktop"
			? {
					capturedAt: timestamp,
					device,
					key: `${site.name}-${device}.png`,
					name: site.name,
					status: "success",
					triggeredAt: timestamp,
				}
			: {
					capturedAt: timestamp,
					device,
					error: "mobile failed",
					name: site.name,
					status: "error",
					triggeredAt: timestamp,
				};
	};

	const result = await runSnapshotWorkflow({}, { triggeredAt, sites }, step, capture);

	assert.equal(result.totalSites, 2);
	assert.equal(result.totalCaptures, 4);
	assert.equal(result.successful, 2);
	assert.equal(result.failed, 2);
	assert.deepEqual(stepNames, [
		"screenshot-bbc-home-desktop",
		"screenshot-bbc-home-mobile",
		"screenshot-sky-sports-desktop",
		"screenshot-sky-sports-mobile",
	]);
	assert.ok(captures.every(({ timestamp }) => timestamp === triggeredAt));
});

test("returns an empty summary when no sites are selected", async () => {
	const step = { do: async (_name, _config, callback) => callback() };
	const result = await runSnapshotWorkflow({}, { triggeredAt, sites: [] }, step, async () => {
		throw new Error("capture should not run");
	});

	assert.deepEqual(result, {
		failed: 0,
		results: [],
		successful: 0,
		totalCaptures: 0,
		totalSites: 0,
		triggeredAt,
	});
});

test("bounds durable capture steps without retrying a timed-out browser operation", async () => {
	const configs = [];
	const step = {
		do: async (_name, config, callback) => {
			configs.push(config);
			return callback();
		},
	};
	const capture = async (_env, site, device) => ({
		capturedAt: triggeredAt,
		device,
		key: `${site.name}-${device}.png`,
		name: site.name,
		status: "success",
		triggeredAt,
	});

	await runSnapshotWorkflow({}, { triggeredAt, sites: [sites[0]] }, step, capture);

	assert.deepEqual(configs, [
		{
			retries: { backoff: "constant", delay: "1 second", limit: 0 },
			timeout: "3 minutes",
		},
		{
			retries: { backoff: "constant", delay: "1 second", limit: 0 },
			timeout: "3 minutes",
		},
	]);
});

test("delays a child runner before starting its first capture", async () => {
	const events = [];
	const step = {
		do: async (_name, _config, callback) => {
			events.push("capture");
			return callback();
		},
		sleep: async (name, duration) => {
			events.push(`${name}:${duration}`);
		},
	};
	const capture = async (_env, site, device) => ({
		device,
		key: `${site.name}-${device}.png`,
		name: site.name,
		status: "success",
	});

	await runSnapshotWorkflow(
		{},
		{ triggeredAt, sites: [sites[0]], startDelaySeconds: 3 },
		step,
		capture,
	);

	assert.equal(events[0], "stagger browser runner:3 seconds");
	assert.equal(events.filter((event) => event === "capture").length, 2);
});

test("spaces device captures when a publisher requires it", async () => {
	const events = [];
	const step = {
		do: async (name, _config, callback) => {
			events.push(name);
			return callback();
		},
		sleep: async (name, duration) => {
			events.push(`${name}:${duration}`);
		},
	};
	const capture = async (_env, site, device) => ({
		device,
		key: `${site.name}-${device}.png`,
		name: site.name,
		status: "success",
	});

	await runSnapshotWorkflow(
		{},
		{
			triggeredAt,
			sites: [{ ...sites[0], interDeviceDelaySeconds: 60 }],
		},
		step,
		capture,
	);

	assert.deepEqual(events, [
		"screenshot-bbc-home-desktop",
		"wait between bbc-home devices:60 seconds",
		"screenshot-bbc-home-mobile",
	]);
});

test("does not retry or swallow a durable step failure", async () => {
	let attempts = 0;
	const step = {
		do: async () => {
			attempts += 1;
			throw new Error("step unavailable");
		},
	};

	await assert.rejects(
		() => runSnapshotWorkflow({}, { triggeredAt, sites: [sites[0]] }, step, async () => undefined),
		/step unavailable/,
	);
	assert.equal(attempts, 1);
});
