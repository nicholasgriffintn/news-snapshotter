import puppeteer, { type Page } from "@cloudflare/puppeteer";

import { collectAndStoreAnalysis } from "./analysis.ts";
import {
	resolveCaptureProfile,
	type ClickAction,
	type DeviceCaptureConfig,
} from "./capture-profiles.ts";
import { storeCaptureFailure } from "./capture-failures.ts";
import type { Env } from "./env";
import { errorMessage } from "./lib/errors.ts";
import { screenshotKey, thumbnailKey } from "./lib/storage-key.ts";
import { progressivelyRenderPage } from "./rendering-scroll.ts";
import type { Device, ScreenshotResult, SiteDefinition } from "./types";

class DetectedCaptureError extends Error {
	readonly reason: string;

	constructor(reason: string, message: string) {
		super(message);
		this.reason = reason;
	}
}

async function waitForImages(page: Page, timeout: number): Promise<void> {
	try {
		await page.waitForFunction(
			() => {
				const browser = globalThis as unknown as {
					document: { images: ArrayLike<{ complete: boolean }> };
				};
				return Array.from(browser.document.images).every((image) => image.complete);
			},
			{ timeout },
		);
	} catch {
		// Slow third-party images should not fail an otherwise usable page.
	}
}

type ClickContext = {
	waitForSelector: (
		selector: string,
		options: { timeout: number; visible: boolean },
	) => Promise<{ click: () => Promise<void> } | null>;
};

async function runClickAction(context: ClickContext, action: ClickAction): Promise<void> {
	try {
		const element = await context.waitForSelector(action.selector, {
			timeout: action.timeoutMs ?? 3_000,
			visible: true,
		});
		if (!element) return;
		await element.click();
		await new Promise((resolve) => setTimeout(resolve, action.waitAfterMs ?? 500));
	} catch {
		// Optional consent furniture changes often and must not fail an otherwise valid capture.
	}
}

async function runClickActions(page: Page, actions: ClickAction[]): Promise<void> {
	for (const action of actions) {
		if (!action.frameUrlIncludes?.length) {
			await runClickAction(page, action);
			continue;
		}

		const frame = page.frames().find((candidate) => {
			const url = candidate.url();
			return action.frameUrlIncludes?.some((part) => url.includes(part));
		});
		if (frame) await runClickAction(frame, action);
	}
}

async function detectFailure(
	page: Page,
	config: DeviceCaptureConfig,
	indicators: Array<{ reason: string; text: string }>,
): Promise<void> {
	for (const indicator of config.blockSelectors ?? []) {
		if (await page.$(indicator.selector)) {
			throw new DetectedCaptureError(
				indicator.reason,
				`Blocked page matched ${indicator.selector}`,
			);
		}
	}

	const pageText = await page.evaluate(() => {
		const browser = globalThis as unknown as {
			document: { body?: { innerText: string } };
		};
		return browser.document.body?.innerText.toLowerCase() ?? "";
	});
	for (const indicator of indicators) {
		if (pageText.includes(indicator.text)) {
			throw new DetectedCaptureError(indicator.reason, `Blocked page contained ${indicator.text}`);
		}
	}

	const contentState = await page.evaluate(() => {
		const browser = globalThis as unknown as {
			document: {
				body?: { innerText: string; scrollHeight: number };
				images: { length: number };
			};
		};
		return JSON.stringify({
			bodyHeight: browser.document.body?.scrollHeight ?? 0,
			images: browser.document.images.length,
			textLength: browser.document.body?.innerText.trim().length ?? 0,
		});
	});
	const content = JSON.parse(contentState) as {
		bodyHeight: number;
		images: number;
		textLength: number;
	};
	if (content.bodyHeight < 100 || (content.textLength < 20 && content.images === 0)) {
		throw new DetectedCaptureError("blank-page", "Page did not contain enough visible content");
	}
}

async function applyPageProfile(page: Page, config: DeviceCaptureConfig): Promise<void> {
	await page.setViewport({
		...config.viewport,
		deviceScaleFactor: config.deviceScaleFactor,
		hasTouch: config.hasTouch,
		isMobile: config.isMobile,
	});

	await page.setJavaScriptEnabled(config.javaScriptEnabled ?? true);

	if (config.extraHTTPHeaders) {
		await page.setExtraHTTPHeaders(config.extraHTTPHeaders);
	}

	if (config.userAgent) {
		await page.setUserAgent(config.userAgent, config.userAgentMetadata);
	}

	if (config.hideWebdriver) {
		await page.evaluateOnNewDocument(() => {
			const browser = globalThis as unknown as { navigator: object };
			const navigatorPrototype = Object.getPrototypeOf(browser.navigator) as object | null;
			if (navigatorPrototype) {
				Reflect.deleteProperty(navigatorPrototype, "webdriver");
			}
		});
	}
	if (config.cookies?.length) {
		await page.setCookie(...config.cookies);
	}
}

async function waitForCompletion(
	page: Page,
	completion: NonNullable<SiteDefinition["completion"]>,
) {
	try {
		await page.waitForFunction(
			(selector, textStartsWith) => {
				const browser = globalThis as unknown as {
					document: { querySelector: (value: string) => { textContent?: string } | null };
				};
				const text = browser.document.querySelector(selector)?.textContent?.trim() ?? "";
				return text.startsWith(textStartsWith);
			},
			{ timeout: completion.timeoutMs },
			completion.selector,
			completion.textStartsWith,
		);
	} catch {
		throw new DetectedCaptureError(
			"completion-timeout",
			`Page did not complete within ${completion.timeoutMs}ms`,
		);
	}
}

async function navigateWithQuietRuntime(
	page: Page,
	site: SiteDefinition,
	config: DeviceCaptureConfig,
) {
	const runtime = (
		page as unknown as {
			_client: () => { send: (method: string) => Promise<unknown> };
		}
	)._client();
	const quietMs = site.runtimeQuietMs ?? config.runtimeQuietMs ?? 0;

	await runtime.send("Runtime.disable");
	try {
		const response = await page.goto(site.url, {
			waitUntil: "domcontentloaded",
			timeout: config.navigationTimeoutMs,
		});
		if (quietMs > 0) await new Promise((resolve) => setTimeout(resolve, quietMs));
		return response;
	} finally {
		await runtime.send("Runtime.enable");
	}
}

async function takeFullScreenshot(page: Page, config: DeviceCaptureConfig) {
	const screenshot = config.screenshot ?? { type: "png" as const, fullPage: true };
	if (screenshot.type === "png") {
		return page.screenshot({ fullPage: screenshot.fullPage, type: "png" });
	}
	return page.screenshot({
		fullPage: screenshot.fullPage,
		quality: screenshot.quality ?? 85,
		type: screenshot.type,
	});
}

async function expandScrollableLayout(page: Page): Promise<void> {
	await page.evaluate(
		() => {
			type BrowserElement = {
				parentElement?: BrowserElement;
				scrollHeight: number;
				style: { setProperty: (name: string, value: string, priority?: string) => void };
			};
			const browser = globalThis as unknown as {
				__snapshotterScrollTarget?: BrowserElement;
			};
			let element = browser.__snapshotterScrollTarget;
			if (!element) return;

			while (element) {
				element.style.setProperty("height", "auto", "important");
				element.style.setProperty("max-height", "none", "important");
				element.style.setProperty("overflow-y", "visible", "important");
				element = element.parentElement;
			}
		},
		{ action: "expand-scroll-layout" },
	);
}

async function capture(
	env: Pick<Env, "ARCHIVE_DATA" | "BROWSER" | "SCREENSHOTS">,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
): Promise<ScreenshotResult> {
	const profile = resolveCaptureProfile(site);
	const config = profile.deviceConfig[device];
	const browser = await puppeteer.launch(env.BROWSER);

	try {
		const page = await browser.newPage();
		await applyPageProfile(page, config);
		const response = await navigateWithQuietRuntime(page, site, config);

		if (response && response.status() >= 400) {
			throw new DetectedCaptureError("http-error", `Navigation returned HTTP ${response.status()}`);
		}

		await runClickActions(page, config.clickActions ?? []);

		if (config.waitForSelector) {
			await page.waitForSelector(config.waitForSelector.selector, {
				timeout: config.waitForSelector.timeoutMs,
			});
		}

		const hideSelectors = config.hideSelectors ?? [];
		const profileStyles = hideSelectors
			.map((selector) => `${selector} { display: none !important; }`)
			.join("\n");
		const styles = [profileStyles, ...(config.styles ?? []), site.requestBody?.addStyleTag]
			.filter(Boolean)
			.join("\n");
		if (styles) {
			const cleanupStyles = await page.addStyleTag({ content: styles });
			if (cleanupStyles) {
				await cleanupStyles.evaluate((node) => node.setAttribute("data-pashi-cleanup", ""));
			}
		}

		if (config.waitAfterLoadMs) {
			await new Promise((resolve) => setTimeout(resolve, config.waitAfterLoadMs));
		}

		if (config.waitForImagesMs) {
			await waitForImages(page, config.waitForImagesMs);
		}

		if (config.scroll) {
			await progressivelyRenderPage(page, config.scroll);
			await expandScrollableLayout(page);
			await waitForImages(page, config.waitForImagesMs ?? 5_000);
		}

		if (site.completion) {
			await waitForCompletion(page, site.completion);
		}

		await detectFailure(page, config, profile.failureIndicators);

		const capturedAt = new Date().toISOString();
		const extension = config.screenshot?.type ?? "png";
		const key = screenshotKey(site, triggeredAt, device, extension);
		const analysis =
			site.analysis && site.analysis.device === device
				? await collectAndStoreAnalysis({
						bucket: env.ARCHIVE_DATA,
						capturedAt,
						device,
						page,
						profile: site.profile ?? site.brand,
						screenshotKey: key,
						site,
						triggeredAt,
					})
				: undefined;
		const screenshot = await takeFullScreenshot(page, config);

		const thumbnailConfig = config.thumbnail ?? { type: "jpeg" as const, quality: 72 };
		const thumbnail = await page.screenshot({
			quality: thumbnailConfig.quality,
			type: thumbnailConfig.type,
		});

		const previewKey = thumbnailKey(key);

		const customMetadata = {
			brand: site.brand,
			capturedAt,
			category: site.category,
			device,
			name: site.name,
			triggeredAt,
			url: site.url,
			visibility: site.visibility ?? "public",
		};

		await env.SCREENSHOTS.put(previewKey, thumbnail, {
			httpMetadata: { contentType: `image/${thumbnailConfig.type}` },
			customMetadata,
		});
		await env.SCREENSHOTS.put(key, screenshot, {
			httpMetadata: { contentType: `image/${extension}` },
			customMetadata,
		});

		return { analysis, capturedAt, device, key, name: site.name, status: "success", triggeredAt };
	} finally {
		try {
			await browser.close();
		} catch (error) {
			console.error("Could not close browser session", {
				device,
				error: errorMessage(error),
				name: site.name,
			});
		}
	}
}

export async function captureDevice(
	env: Pick<Env, "ARCHIVE_DATA" | "BROWSER" | "CAPTURE_FAILURES" | "SCREENSHOTS">,
	site: SiteDefinition,
	device: Device,
	triggeredAt: string,
): Promise<ScreenshotResult> {
	try {
		return await capture(env, site, device, triggeredAt);
	} catch (error) {
		const reason = error instanceof DetectedCaptureError ? error.reason : "capture-error";
		const message = errorMessage(error);
		const capturedAt = new Date().toISOString();
		const failureKey = await storeCaptureFailure(env, {
			capturedAt,
			device,
			message,
			reason,
			site,
			triggeredAt,
		});
		return {
			capturedAt,
			device,
			error: message,
			failureKey,
			name: site.name,
			status: "error",
			triggeredAt,
		};
	}
}
