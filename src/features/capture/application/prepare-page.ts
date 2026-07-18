import type { Page } from "@cloudflare/puppeteer";

import { CAPTURE_REGIONS } from "../domain/regions.ts";
import type { ClickAction, DeviceCaptureConfig } from "../domain/profiles.ts";
import { progressivelyRenderPage } from "./rendering-scroll.ts";
import type { SiteDefinition } from "../../../core/domain.ts";
import { urlsMatchIgnoringHash } from "../../../core/urls.ts";

export class DetectedCaptureError extends Error {
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

async function applyPageProfile(
	page: Page,
	config: DeviceCaptureConfig,
	regionName: SiteDefinition["captureRegion"],
	providerManagesFingerprint: boolean,
): Promise<void> {
	const region = CAPTURE_REGIONS[regionName];

	await page.setViewport({
		...config.viewport,
		deviceScaleFactor: config.deviceScaleFactor,
		hasTouch: config.hasTouch,
		isMobile: config.isMobile,
	});
	await page.setJavaScriptEnabled(config.javaScriptEnabled ?? true);
	await page.setExtraHTTPHeaders({
		...config.extraHTTPHeaders,
		"accept-language": region.acceptLanguage,
	});
	await page.emulateTimezone(region.timezone);

	if (region.geolocation) await page.setGeolocation(region.geolocation);
	if (!providerManagesFingerprint && config.userAgent) {
		await page.setUserAgent(config.userAgent, config.userAgentMetadata);
	}
	if (!providerManagesFingerprint && config.hideWebdriver) {
		await page.evaluateOnNewDocument(() => {
			const browser = globalThis as unknown as { navigator: object };
			const navigatorPrototype = Object.getPrototypeOf(browser.navigator) as object | null;
			if (navigatorPrototype) Reflect.deleteProperty(navigatorPrototype, "webdriver");
		});
	}
	if (config.cookies?.length) await page.setCookie(...config.cookies);
}

async function waitForCompletion(
	page: Page,
	completion: NonNullable<SiteDefinition["completion"]>,
): Promise<void> {
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

async function applyResponseOverrides(page: Page, config: DeviceCaptureConfig): Promise<void> {
	if (!config.responseOverrides?.length) return;

	await page.setRequestInterception(true);
	page.on("request", async (request) => {
		const override = config.responseOverrides?.find(({ url }) => url === request.url());
		if (!override) {
			await request.continue();
			return;
		}
		await request.respond({
			body: JSON.stringify(override.body),
			contentType: "application/json; charset=utf-8",
			status: 200,
		});
	});
}

async function navigateWithQuietRuntime(
	page: Page,
	site: SiteDefinition,
	config: DeviceCaptureConfig,
) {
	const runtime = (
		page as unknown as { _client: () => { send: (method: string) => Promise<unknown> } }
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

async function expandScrollableLayout(page: Page): Promise<void> {
	await page.evaluate(
		() => {
			type BrowserElement = {
				parentElement?: BrowserElement;
				scrollHeight: number;
				style: { setProperty: (name: string, value: string, priority?: string) => void };
			};
			const browser = globalThis as unknown as { __snapshotterScrollTarget?: BrowserElement };
			let element = browser.__snapshotterScrollTarget;
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

export async function preparePageForCapture(input: {
	config: DeviceCaptureConfig;
	failureIndicators: Array<{ reason: string; text: string }>;
	page: Page;
	providerManagesFingerprint: boolean;
	site: SiteDefinition;
}): Promise<void> {
	const { config, failureIndicators, page, providerManagesFingerprint, site } = input;
	await applyPageProfile(page, config, site.captureRegion, providerManagesFingerprint);
	await applyResponseOverrides(page, config);
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

	const profileStyles = (config.hideSelectors ?? [])
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

	if (config.waitAfterLoadMs)
		await new Promise((resolve) => setTimeout(resolve, config.waitAfterLoadMs));
	if (config.waitForImagesMs) await waitForImages(page, config.waitForImagesMs);
	if (config.scroll) {
		await progressivelyRenderPage(page, config.scroll);
		await expandScrollableLayout(page);
		await waitForImages(page, config.waitForImagesMs ?? 5_000);
	}
	if (site.completion) await waitForCompletion(page, site.completion);
	const loadedUrl = page.url();
	if (!urlsMatchIgnoringHash(site.url, loadedUrl)) {
		throw new DetectedCaptureError(
			"unexpected-url",
			`Navigation loaded ${loadedUrl} instead of ${site.url}`,
		);
	}
	await detectFailure(page, config, failureIndicators);
}
