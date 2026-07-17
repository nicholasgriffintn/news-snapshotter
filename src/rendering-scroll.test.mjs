import assert from "node:assert/strict";
import test from "node:test";

import { progressivelyRenderPage } from "./rendering-scroll.ts";

function fakePage(states) {
	const behaviors = [];
	const positions = [];
	let index = 0;
	return {
		evaluate: async (_callback, command) => {
			if (command.action === "measure") {
				const state = states[Math.min(index, states.length - 1)];
				index += 1;
				return state;
			}
			behaviors.push(command.behavior);
			positions.push(command.top);
			return undefined;
		},
		behaviors,
		positions,
	};
}

const config = {
	maxDurationMs: 10_000,
	maxSteps: 20,
	minDelayMs: 80,
	settleDelayMs: 300,
	viewportRatio: { max: 0.85, min: 0.6 },
};

test("progressively renders expanding pages before returning to the top", async () => {
	const page = fakePage([
		{ height: 2_000, viewportHeight: 1_000, y: 0 },
		{ height: 2_000, viewportHeight: 1_000, y: 700 },
		{ height: 3_000, viewportHeight: 1_000, y: 1_000 },
		{ height: 3_000, viewportHeight: 1_000, y: 1_700 },
		{ height: 3_000, viewportHeight: 1_000, y: 2_000 },
	]);
	const delays = [];

	await progressivelyRenderPage(page, config, {
		now: () => 0,
		seed: 42,
		sleep: async (duration) => delays.push(duration),
	});

	assert.equal(page.positions.at(-1), 0);
	assert.equal(page.behaviors.at(-1), "auto");
	assert.ok(page.positions.slice(0, -1).every((position) => position > 0));
	assert.ok(delays.some((duration) => duration > config.minDelayMs));
	assert.equal(delays.at(-1), config.settleDelayMs);
});

test("stops bounded rendering when scrolling cannot make progress", async () => {
	const page = fakePage([
		{ height: 10_000, viewportHeight: 1_000, y: 0 },
		{ height: 10_000, viewportHeight: 1_000, y: 0 },
		{ height: 10_000, viewportHeight: 1_000, y: 0 },
		{ height: 10_000, viewportHeight: 1_000, y: 0 },
	]);
	let sleeps = 0;

	await progressivelyRenderPage(page, config, {
		now: () => 0,
		seed: 42,
		sleep: async () => {
			sleeps += 1;
		},
	});

	assert.equal(sleeps, 4);
	assert.equal(page.positions.at(-1), 0);
});

test("continues when content appears after first reaching the bottom", async () => {
	const page = fakePage([
		{ height: 2_000, viewportHeight: 1_000, y: 0 },
		{ height: 2_000, viewportHeight: 1_000, y: 1_000 },
		{ height: 3_000, viewportHeight: 1_000, y: 1_000 },
		{ height: 3_000, viewportHeight: 1_000, y: 2_000 },
		{ height: 3_000, viewportHeight: 1_000, y: 2_000 },
	]);

	await progressivelyRenderPage(page, config, {
		now: () => 0,
		seed: 42,
		sleep: async () => undefined,
	});

	assert.equal(page.positions.filter((position) => position > 0).length, 2);
	assert.equal(page.positions.at(-1), 0);
});

test("allows lazy content a full settle delay when reaching the bottom", async () => {
	const page = fakePage([
		{ height: 2_000, viewportHeight: 1_000, y: 0 },
		{ height: 2_000, viewportHeight: 1_000, y: 1_000 },
		{ height: 2_000, viewportHeight: 1_000, y: 1_000 },
	]);
	const delays = [];

	await progressivelyRenderPage(page, config, {
		now: () => 0,
		seed: 42,
		sleep: async (duration) => delays.push(duration),
	});

	assert.ok(delays.includes(config.settleDelayMs));
	assert.equal(page.positions.at(-1), 0);
});
