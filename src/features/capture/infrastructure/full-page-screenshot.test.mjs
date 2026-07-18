import assert from "node:assert/strict";
import test from "node:test";

import { takeFullScreenshot } from "./full-page-screenshot.ts";

function pageWithDimensions(dimensions) {
	const screenshotCalls = [];
	return {
		evaluate: async () => dimensions,
		screenshot: async (options) => {
			screenshotCalls.push(options);
			return Buffer.from("screenshot");
		},
		screenshotCalls,
	};
}

test("keeps native full-page capture below the raster limit", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 1, height: 8_000, width: 1_740 });

	await takeFullScreenshot(page, { screenshot: { fullPage: true, type: "png" } });

	assert.deepEqual(page.screenshotCalls, [{ fullPage: true, type: "png" }]);
});

test("scales oversized captures below the browser raster limit", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 1, height: 16_384, width: 1_740 });

	await takeFullScreenshot(page, { screenshot: { fullPage: true, type: "png" } });

	assert.deepEqual(page.screenshotCalls, [
		{
			captureBeyondViewport: true,
			clip: { height: 16_384, scale: 0.5, width: 1_740, x: 0, y: 0 },
			type: "png",
		},
	]);
});

test("includes device pixel ratio when scaling oversized captures", async () => {
	const page = pageWithDimensions({ deviceScaleFactor: 2, height: 8_192, width: 412 });

	await takeFullScreenshot(page, {
		screenshot: { fullPage: true, quality: 80, type: "webp" },
	});

	assert.equal(page.screenshotCalls[0].clip.scale, 0.5);
	assert.equal(page.screenshotCalls[0].quality, 80);
});
