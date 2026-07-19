import type { Page } from "@cloudflare/puppeteer";

import type { DeviceCaptureConfig } from "../domain/profiles.ts";

const MAX_RASTER_DIMENSION = 8_192;

type PageDimensions = {
	deviceScaleFactor: number;
	height: number;
	width: number;
};

async function measurePage(page: Page): Promise<PageDimensions> {
	return page.evaluate(() => {
		type BrowserElement = { scrollHeight: number; scrollWidth: number };
		const browser = globalThis as unknown as {
			devicePixelRatio: number;
			document: { body?: BrowserElement; documentElement: BrowserElement };
		};
		const body = browser.document.body;
		const root = browser.document.documentElement;
		return {
			deviceScaleFactor: browser.devicePixelRatio,
			height: Math.max(body?.scrollHeight ?? 0, root.scrollHeight),
			width: Math.max(body?.scrollWidth ?? 0, root.scrollWidth),
		};
	});
}

export async function takeFullScreenshot(page: Page, config: DeviceCaptureConfig) {
	const screenshot = config.screenshot ?? { type: "png" as const, fullPage: true };
	const format =
		screenshot.type === "png"
			? { type: screenshot.type }
			: { quality: screenshot.quality ?? 85, type: screenshot.type };
	if (!screenshot.fullPage) {
		return page.screenshot({ ...format, fullPage: false });
	}

	const dimensions = await measurePage(page);
	const scale = Math.min(
		1,
		MAX_RASTER_DIMENSION / (dimensions.height * dimensions.deviceScaleFactor),
		MAX_RASTER_DIMENSION / (dimensions.width * dimensions.deviceScaleFactor),
	);
	if (scale === 1) {
		return page.screenshot({ ...format, fullPage: true });
	}

	const originalViewport = {
		...config.viewport,
		deviceScaleFactor: config.deviceScaleFactor,
		hasTouch: config.hasTouch,
		isMobile: config.isMobile,
	};

	await page.setViewport({
		...originalViewport,
		deviceScaleFactor: dimensions.deviceScaleFactor * scale,
		height: Math.ceil(dimensions.height),
	});

	try {
		await page.evaluate(() => {
			const browser = globalThis as unknown as {
				requestAnimationFrame: (callback: () => void) => number;
			};
			return new Promise<void>((resolve) => {
				browser.requestAnimationFrame(() => browser.requestAnimationFrame(resolve));
			});
		});
		return await page.screenshot({ ...format, fullPage: true });
	} finally {
		await page.setViewport(originalViewport);
	}
}
