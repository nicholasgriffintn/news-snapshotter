import assert from "node:assert/strict";
import test from "node:test";

import { takeFullScreenshot } from "./full-page-screenshot.ts";

function pageWithDimensions(dimensions) {
	const screenshotCalls = [];
	const viewportCalls = [];
	return {
		evaluate: async () => dimensions,
		screenshot: async (options) => {
			screenshotCalls.push(options);
			return Buffer.from("screenshot");
		},
		setViewport: async (viewport) => viewportCalls.push(viewport),
		screenshotCalls,
		viewportCalls,
	};
}

test("keeps native full-page capture below the raster limit", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 1, height: 8_000, width: 1_740 });

	await takeFullScreenshot(page, { screenshot: { fullPage: true, type: "png" } });

	assert.deepEqual(page.screenshotCalls, [{ fullPage: true, type: "png" }]);
});

test("scales oversized captures below the browser raster limit", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 1, height: 16_384, width: 1_740 });

	await takeFullScreenshot(page, {
		screenshot: { fullPage: true, type: "png" },
		viewport: { height: 1_008, width: 1_740 },
	});

	assert.deepEqual(page.screenshotCalls, [{ fullPage: true, type: "png" }]);
	assert.deepEqual(page.viewportCalls, [
		{
			deviceScaleFactor: 0.5,
			hasTouch: undefined,
			height: 16_384,
			isMobile: undefined,
			width: 1_740,
		},
		{
			deviceScaleFactor: undefined,
			hasTouch: undefined,
			height: 1_008,
			isMobile: undefined,
			width: 1_740,
		},
	]);
});

test("includes device pixel ratio when scaling oversized captures", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 2, height: 8_192, width: 412 });

	await takeFullScreenshot(page, {
		screenshot: { fullPage: true, quality: 80, type: "webp" },
		viewport: { height: 915, width: 412 },
	});

	assert.equal(page.screenshotCalls[0].quality, 80);
	assert.equal(page.viewportCalls[0].deviceScaleFactor, 1);
});

test("paints an oversized page in one viewport before capturing it", async () => {
	const dimensions = { deviceScaleFactor: 1, height: 13_266, width: 1_740 };
	let viewport = { height: 1_008, width: 1_740 };
	const viewportCalls = [];
	const page = {
		evaluate: async () => dimensions,
		screenshot: async () => {
			return Buffer.from(viewport.height >= dimensions.height ? "painted" : "stale");
		},
		setViewport: async (nextViewport) => {
			viewport = nextViewport;
			viewportCalls.push(nextViewport);
		},
	};

	const screenshot = await takeFullScreenshot(page, {
		screenshot: { fullPage: true, type: "png" },
		viewport: { height: 1_008, width: 1_740 },
	});

	assert.equal(screenshot.toString(), "painted");
	assert.deepEqual(viewportCalls.at(-1), {
		deviceScaleFactor: undefined,
		hasTouch: undefined,
		height: 1_008,
		isMobile: undefined,
		width: 1_740,
	});
});
