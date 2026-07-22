import assert from "node:assert/strict";
import test from "node:test";

import puppeteer from "@cloudflare/puppeteer";

import { captureDevice } from "./capture-device.ts";

const site = {
	brand: "example",
	captureRegion: "uk",
	category: "news",
	name: "example-home",
	runtimeQuietMs: 0,
	url: "https://example.com",
};
const triggeredAt = "2026-07-16T10:20:30.123Z";

function successfulPage(overrides = {}) {
	let evaluation = 0;
	let scrollY = 0;
	const profileCalls = [];
	const runtimeCalls = [];
	const layoutCalls = [];
	return {
		$: async () => null,
		_client: () => ({ send: async (method) => runtimeCalls.push(method) }),
		addStyleTag: async () => undefined,
		evaluateOnNewDocument: async (...args) => profileCalls.push(["evaluateOnNewDocument", ...args]),
		evaluate: async (_callback, command) => {
			if (command?.action === "expand-scroll-layout") {
				layoutCalls.push(command.action);
				return undefined;
			}
			if (command?.action === "measure") {
				layoutCalls.push(command.action);
				return { height: 2_000, viewportHeight: 1_000, y: scrollY };
			}
			if (command?.action === "move") {
				layoutCalls.push(command.action);
				scrollY = command.top;
				return undefined;
			}
			evaluation += 1;
			return evaluation === 1
				? ""
				: JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
		},
		frames: () => [],
		goto: async () => ({ status: () => 200 }),
		layoutCalls,
		on: () => undefined,
		screenshot: async (options) =>
			options.fullPage ? Buffer.from("full screenshot") : Buffer.from("thumbnail"),
		profileCalls,
		runtimeCalls,
		url: () => site.url,
		emulateTimezone: async (...args) => profileCalls.push(["emulateTimezone", ...args]),
		setCookie: async () => undefined,
		setExtraHTTPHeaders: async (...args) => profileCalls.push(["setExtraHTTPHeaders", ...args]),
		setGeolocation: async (...args) => profileCalls.push(["setGeolocation", ...args]),
		setJavaScriptEnabled: async () => undefined,
		setRequestInterception: async () => undefined,
		setUserAgent: async (...args) => profileCalls.push(["setUserAgent", ...args]),
		setViewport: async () => undefined,
		waitForFunction: async () => undefined,
		...overrides,
	};
}

function environment() {
	const archive = [];
	const events = [];
	const failures = [];
	const messages = [];
	const screenshots = [];
	return {
		env: {
			ARCHIVE_DATA: {
				put: async (...args) => {
					archive.push(args);
					events.push("archive");
				},
			},
			BROWSER: {},
			CAPTURE_FAILURES: { put: async (...args) => failures.push(args) },
			HISTORY_DB: {
				prepare: () => ({
					bind: () => ({ run: async () => undefined }),
				}),
			},
			HISTORY_INDEX_QUEUE: {
				send: async (message) => {
					messages.push(message);
					events.push("queue");
				},
			},
			SCREENSHOTS: {
				put: async (...args) => {
					screenshots.push(args);
					events.push("screenshot");
				},
			},
		},
		archive,
		events,
		failures,
		messages,
		screenshots,
	};
}

test("stores desktop analysis independently from screenshot artefacts", async (context) => {
	let evaluation = 0;
	let scrollY = 0;
	const elements = Array.from({ length: 20 }, (_, index) => ({
		canonicalUrl: `https://www.bbc.co.uk/news/articles/${index}`,
		elementKey: `story-${index}`,
		headline: `BBC story headline ${index}`,
		kind: "story",
		position: {
			height: 100,
			left: 0,
			pageOrder: index + 1,
			top: index * 100,
			viewportDepth: index / 10,
			width: 500,
		},
		textFingerprint: `bbc story headline ${index}`,
	}));
	const page = successfulPage({
		evaluate: async (_callback, command) => {
			if (command?.action === "measure") {
				return { height: 2_000, viewportHeight: 1_000, y: scrollY };
			}
			if (command?.action === "move") {
				scrollY = command.top;
				return undefined;
			}
			if (command?.action === "expand-scroll-layout") {
				return undefined;
			}

			evaluation += 1;
			if (evaluation === 1) {
				return "";
			}
			if (evaluation === 2) {
				return JSON.stringify({ bodyHeight: 2_000, images: 2, textLength: 500 });
			}
			return JSON.stringify({
				elements,
				html: "<!doctype html><html><body>BBC</body></html>",
				pageHeight: 2_000,
				pageWidth: 1_740,
			});
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { archive, env, events, messages, screenshots } = environment();
	const analysedSite = {
		...site,
		analysis: {
			device: "desktop",
			extractor: "bbc-front-page",
			minimumElements: 20,
			version: 10,
		},
		brand: "bbc",
		name: "bbc-home",
	};

	const result = await captureDevice(env, analysedSite, "desktop", triggeredAt);

	assert.equal(result.status, "success");
	assert.equal(result.analysis.status, "stored");
	assert.equal(result.analysis.indexingStatus, "pending");
	assert.equal(archive.length, 2);
	assert.equal(screenshots.length, 2);
	assert.deepEqual(messages, [
		{
			captureId: `bbc-home:desktop:${triggeredAt}`,
			enqueueComparison: true,
			extractionKey: result.analysis.extractionKey,
			kind: "extraction",
			site: "bbc-home",
		},
	]);
	assert.deepEqual(events, ["screenshot", "screenshot", "archive", "archive", "queue"]);
});

test("captures full and thumbnail images with metadata and closes the browser", async (context) => {
	const page = successfulPage();
	let closed = false;
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => page,
	}));
	const { env, failures, screenshots } = environment();

	const result = await captureDevice(env, site, "desktop", triggeredAt);

	assert.equal(result.status, "success");
	assert.match(result.key, /brand=example\/category=news\/date=2026-07-16/);
	assert.equal(screenshots.length, 2);
	assert.match(screenshots[0][0], /-thumbnail\.jpg$/);
	assert.equal(screenshots[1][2].customMetadata.name, "example-home");
	assert.equal(screenshots[1][2].customMetadata.visibility, "public");
	assert.equal(screenshots[1][2].customMetadata.triggeredAt, triggeredAt);
	assert.notEqual(screenshots[1][2].customMetadata.capturedAt, triggeredAt);
	assert.equal(result.capturedAt, screenshots[1][2].customMetadata.capturedAt);
	assert.equal(failures.length, 0);
	assert.equal(closed, true);
	assert.ok(page.profileCalls.some(([method]) => method === "setExtraHTTPHeaders"));
	assert.deepEqual(
		page.profileCalls.find(([method]) => method === "emulateTimezone"),
		["emulateTimezone", "Europe/London"],
	);
	assert.deepEqual(
		page.profileCalls.find(([method]) => method === "setGeolocation"),
		[
			"setGeolocation",
			{
				accuracy: 20,
				latitude: 51.5074,
				longitude: -0.1278,
			},
		],
	);
	assert.ok(page.profileCalls.some(([method]) => method === "evaluateOnNewDocument"));
	const userAgentCall = page.profileCalls.find(([method]) => method === "setUserAgent");
	assert.match(userAgentCall[1], /Macintosh/);
	assert.equal(userAgentCall[2].platform, "macOS");
	assert.deepEqual(page.runtimeCalls, ["Runtime.disable", "Runtime.enable"]);
	assert.equal(page.layoutCalls[0], "expand-scroll-layout");
	assert.equal(page.layoutCalls.at(-1), "expand-scroll-layout");
});

test("runs optional profile clicks before applying cleanup styles", async (context) => {
	const events = [];
	const page = successfulPage({
		addStyleTag: async () => {
			events.push("styles");
			return undefined;
		},
		waitForSelector: async (selector) => {
			if (!selector.includes("cassie-accept-all")) {
				return null;
			}
			return { click: async () => events.push("click") };
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: "itv", name: "itv-home" },
		"desktop",
		triggeredAt,
	);

	assert.equal(result.status, "success");
	assert.deepEqual(events.slice(0, 2), ["click", "styles"]);
});

test("acknowledges CNN legal terms before capturing the page", async (context) => {
	const clicked = [];
	const page = successfulPage({
		url: () => "https://edition.cnn.com/",
		waitForSelector: async (selector) => {
			if (!selector.includes('div[role="dialog"][aria-modal="true"]')) {
				return null;
			}
			return { click: async () => clicked.push(selector) };
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: "cnn", name: "cnn-com", url: "https://edition.cnn.com/" },
		"desktop",
		triggeredAt,
	);

	assert.equal(result.status, "success");
	assert.deepEqual(clicked, ['div[role="dialog"][aria-modal="true"] > a[role="button"][href="#"]']);
});

test("unlocks the document layout before progressively scrolling a full-page capture", async (context) => {
	const appliedStyles = [];
	const page = successfulPage({
		addStyleTag: async ({ content }) => {
			appliedStyles.push(content);
			return undefined;
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(env, site, "desktop", triggeredAt);

	assert.equal(result.status, "success");
	assert.match(
		appliedStyles[0],
		/html, body \{ height: auto !important; max-height: none !important; overflow-y: visible !important; \}/,
	);
	assert.match(appliedStyles[0], /body \* \{ content-visibility: visible !important; \}/);
	assert.equal(appliedStyles.length, 2);
	assert.equal(appliedStyles[1], appliedStyles[0]);
});

test("runs consent actions inside matching iframes", async (context) => {
	const clicked = [];
	const emptyConsentFrame = {
		url: () => "https://privacy.example/consent-shell",
		waitForSelector: async () => null,
	};
	const consentFrame = {
		url: () => "https://privacy.example/consent",
		waitForSelector: async (selector) => ({
			click: async () => clicked.push(selector),
		}),
	};
	const page = successfulPage({
		frames: () => [emptyConsentFrame, consentFrame],
		waitForSelector: async () => null,
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: "financialtimes", name: "financial-times-home" },
		"desktop",
		triggeredAt,
	);

	assert.equal(result.status, "success");
	assert.deepEqual(clicked, ['button[title="Reject"]']);
});

test("retries unresolved top-level consent actions after progressive rendering", async (context) => {
	const clicked = [];
	let legalTermsReads = 0;
	const legalTermsSelector = 'div[role="dialog"][aria-modal="true"] > a[role="button"][href="#"]';
	const page = successfulPage({
		url: () => "https://edition.cnn.com/",
		waitForSelector: async (selector) => {
			if (selector !== legalTermsSelector) {
				return null;
			}
			legalTermsReads += 1;
			return legalTermsReads === 1 ? null : { click: async () => clicked.push(selector) };
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: "cnn", name: "cnn-com", url: "https://edition.cnn.com/" },
		"desktop",
		triggeredAt,
	);

	assert.equal(result.status, "success");
	assert.deepEqual(clicked, [legalTermsSelector]);
});

test("retries framed consent actions after progressive rendering reveals the iframe", async (context) => {
	const clicked = [];
	let framesRead = 0;
	const consentFrame = {
		url: () => "https://privacy.example/consent",
		waitForSelector: async (selector) => ({
			click: async () => clicked.push(selector),
		}),
	};
	const page = successfulPage({
		frames: () => {
			framesRead += 1;
			return framesRead === 1 ? [] : [consentFrame];
		},
		waitForSelector: async () => null,
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env } = environment();

	const result = await captureDevice(
		env,
		{ ...site, brand: "financialtimes", name: "financial-times-home" },
		"desktop",
		triggeredAt,
	);

	assert.equal(result.status, "success");
	assert.deepEqual(clicked, ['button[title="Reject"]']);
});

test("records HTTP capture failures without retrying or writing screenshots", async (context) => {
	let closed = false;
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => {
			closed = true;
		},
		newPage: async () => ({
			_client: () => ({ send: async () => undefined }),
			emulateTimezone: async () => undefined,
			evaluateOnNewDocument: async () => undefined,
			goto: async () => ({ status: () => 503 }),
			setExtraHTTPHeaders: async () => undefined,
			setGeolocation: async () => undefined,
			setJavaScriptEnabled: async () => undefined,
			setUserAgent: async () => undefined,
			setViewport: async () => undefined,
		}),
	}));
	const { env, failures, screenshots } = environment();

	const result = await captureDevice(env, site, "desktop", triggeredAt);

	assert.equal(result.status, "error");
	assert.equal(result.error, "Navigation returned HTTP 503");
	assert.match(result.failureKey, /^failures\/date=\d{4}-\d{2}-\d{2}\//);
	assert.equal(failures.length, 1);
	const failure = JSON.parse(failures[0][1]);
	assert.equal(failure.reason, "http-error");
	assert.equal(failure.triggeredAt, triggeredAt);
	assert.notEqual(failure.capturedAt, triggeredAt);
	assert.equal(screenshots.length, 0);
	assert.equal(closed, true);
});

test("rejects a capture when navigation finishes on a different regional URL", async (context) => {
	const page = successfulPage({ url: () => "https://www.bbc.com/" });
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env, failures, screenshots } = environment();
	const bbcSite = { ...site, brand: "bbc", name: "bbc-home", url: "https://www.bbc.co.uk/" };

	const result = await captureDevice(env, bbcSite, "desktop", triggeredAt);

	assert.equal(result.status, "error");
	assert.equal(
		result.error,
		"Navigation loaded https://www.bbc.com/ instead of https://www.bbc.co.uk/",
	);
	assert.equal(JSON.parse(failures[0][1]).reason, "unexpected-url");
	assert.equal(screenshots.length, 0);
});

test("records launch errors as capture failures", async (context) => {
	context.mock.method(puppeteer, "launch", async () =>
		Promise.reject(new Error("browser unavailable")),
	);
	const { env, failures } = environment();

	const result = await captureDevice(env, site, "mobile", triggeredAt);

	assert.equal(result.status, "error");
	assert.equal(result.error, "browser unavailable");
	assert.equal(JSON.parse(failures[0][1]).reason, "capture-error");
});

test("waits for configured completion text before storing a capture", async (context) => {
	const completionWaits = [];
	const page = successfulPage({
		waitForFunction: async (_predicate, options, ...args) => {
			if (args.length > 0) {
				completionWaits.push({ args, options });
			}
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env, screenshots } = environment();
	const completion = {
		selector: "#status",
		textStartsWith: "Classification:",
		timeoutMs: 30_000,
	};

	const result = await captureDevice(env, { ...site, completion }, "desktop", triggeredAt);

	assert.equal(result.status, "success");
	assert.deepEqual(completionWaits, [
		{ args: ["#status", "Classification:"], options: { timeout: 30_000 } },
	]);
	assert.equal(screenshots.length, 2);
});

test("records a completion timeout without storing a partial screenshot", async (context) => {
	const page = successfulPage({
		waitForFunction: async (_predicate, _options, ...args) => {
			if (args.length > 0) {
				throw new Error("timeout");
			}
		},
	});
	context.mock.method(puppeteer, "launch", async () => ({
		close: async () => undefined,
		newPage: async () => page,
	}));
	const { env, failures, screenshots } = environment();
	const completion = {
		selector: "#status",
		textStartsWith: "Classification:",
		timeoutMs: 30_000,
	};

	const result = await captureDevice(env, { ...site, completion }, "desktop", triggeredAt);

	assert.equal(result.status, "error");
	assert.equal(result.error, "Page did not complete within 30000ms");
	assert.equal(JSON.parse(failures[0][1]).reason, "completion-timeout");
	assert.equal(screenshots.length, 0);
});
