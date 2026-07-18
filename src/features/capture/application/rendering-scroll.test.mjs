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

test("prefers the page content scroller over navigation overlays", async (context) => {
	const documentScroller = {
		clientHeight: 1_008,
		clientWidth: 1_740,
		scrollHeight: 1_008,
		scrollTop: 0,
	};
	const overlayScroller = {
		clientHeight: 1_008,
		clientWidth: 1_740,
		closest: () => null,
		querySelector: () => null,
		scrollHeight: 20_000,
		scrollTop: 0,
	};
	const contentScroller = {
		clientHeight: 1_008,
		clientWidth: 1_620,
		closest: (selector) => (selector.includes("main") ? contentScroller : null),
		querySelector: () => null,
		scrollHeight: 14_000,
		scrollTop: 0,
	};
	const originalDocument = globalThis.document;
	const originalGetComputedStyle = globalThis.getComputedStyle;
	const originalInnerHeight = globalThis.innerHeight;
	const originalScrollY = globalThis.scrollY;
	context.after(() => {
		globalThis.document = originalDocument;
		globalThis.getComputedStyle = originalGetComputedStyle;
		globalThis.innerHeight = originalInnerHeight;
		globalThis.scrollY = originalScrollY;
		delete globalThis.__snapshotterScrollTarget;
		delete globalThis.__snapshotterScrollTargetResolved;
	});
	globalThis.document = {
		documentElement: documentScroller,
		querySelectorAll: () => [overlayScroller, contentScroller],
		scrollingElement: documentScroller,
	};
	globalThis.getComputedStyle = () => ({
		display: "block",
		overflowY: "hidden",
		visibility: "visible",
	});
	globalThis.innerHeight = 1_008;
	globalThis.scrollY = 0;

	const page = {
		evaluate: async (callback, command) => {
			if (command.action === "measure") {
				return callback();
			}
			return undefined;
		},
	};

	await progressivelyRenderPage(
		page,
		{ ...config, maxSteps: 0 },
		{
			now: () => 0,
			sleep: async () => undefined,
		},
	);

	assert.equal(globalThis.__snapshotterScrollTarget, contentScroller);
});
